import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CharacterSipZone } from '../character/CharacterSipZone'
import { LabDragContext, type InventoryDragEndInfo } from '../game/LabDragContext'
import {
  clientPointInCanvasPlacement,
  clientPointToCanvasPercent,
  grabCenterClient,
} from '../game/labGeometry'
import type { LabPlacedVial } from '../game/labTypes'
import { LabCanvas } from '../game/LabCanvas'
import { InventoryPanel } from '../inventory/InventoryPanel'
import { resolveFusionProduct } from '../../lib/fusion'
import type { DrinkSpellResult } from '../../lib/drinkSpell'
import { Draggable, registerGsapDraggable } from '../../lib/registerGsapDraggable'
import { useAlchemixStore } from '../../store/useAlchemixStore'
import '../lab/alchemixLab.css'

registerGsapDraggable()

function chipFromDragTarget(target: HTMLElement): HTMLElement | null {
  return (target.querySelector('.lab-chipInventory') as HTMLElement | null) ?? target
}

export function AlchemixShell() {
  const vialsById = useAlchemixStore((s) => s.vials)
  const resetToStarters = useAlchemixStore((s) => s.resetToStarters)
  const sortName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })

  const inventoryGroups = useMemo(() => {
    const list = Object.values(vialsById)
    return {
      elements: list.filter((v) => v.type === 'element').sort(sortName),
      spells: list.filter((v) => v.type === 'spell').sort(sortName),
      creatures: list.filter((v) => v.type === 'creature').sort(sortName),
    }
  }, [vialsById])

  const [placed, setPlaced] = useState<LabPlacedVial[]>([])
  const [sipHint, setSipHint] = useState<string | null>(null)
  const sipTimerRef = useRef(0)

  const canvasRef = useRef<HTMLDivElement>(null)
  const characterSipRef = useRef<HTMLDivElement>(null)
  const grabOffsetRef = useRef<{ dx: number; dy: number } | null>(null)
  const placedRef = useRef(placed)
  placedRef.current = placed

  const showSipHint = useCallback((msg: string) => {
    window.clearTimeout(sipTimerRef.current)
    setSipHint(msg)
    sipTimerRef.current = window.setTimeout(() => setSipHint(null), 3200)
  }, [])

  useEffect(
    () => () => {
      window.clearTimeout(sipTimerRef.current)
    },
    [],
  )

  const findHitPlacedVial = useCallback(
    (chip: Element, excludeInstanceId?: string): LabPlacedVial | null => {
      for (const p of placedRef.current) {
        if (excludeInstanceId && p.instanceId === excludeInstanceId) continue
        const el = document.querySelector(
          `[data-lab-drop-target="${CSS.escape(p.instanceId)}"]`,
        )
        if (el instanceof HTMLElement && Draggable.hitTest(chip, el, '38%')) {
          return p
        }
      }
      return null
    },
    [],
  )

  const tryCharacterSip = useCallback(
    (vialId: string, instanceId: string | undefined, chip: HTMLElement) => {
      const sipEl = characterSipRef.current
      const canvasEl = canvasRef.current
      if (!sipEl || !canvasEl) return false
      if (!Draggable.hitTest(chip, sipEl, '30%')) return false

      const store = useAlchemixStore.getState()
      const vial = store.vials[vialId]
      if (!vial || vial.type !== 'spell') {
        showSipHint('Seuls les sorts peuvent être bus.')
        return true
      }
      const result: DrinkSpellResult = store.feedSpellToCharacter(vialId)
      if (instanceId) {
        setPlaced((prev) => prev.filter((p) => p.instanceId !== instanceId))
      }
      switch (result.ok) {
        case true:
          showSipHint(`${result.creature.name} apparaît !`)
          break
        case false: {
          const { reason } = result
          if (reason === 'no_creature') {
            showSipHint('Aucune créature ne répond à ce sort.')
          } else if (reason === 'already_owned') {
            showSipHint('Créature déjà manifestée.')
          }
          break
        }
      }
      return true
    },
    [showSipHint],
  )

  const completeInventoryDrag = useCallback(
    (vialId: string, info: InventoryDragEndInfo) => {
      const target = info.target
      const chip = chipFromDragTarget(target)
      const canvasEl = canvasRef.current
      if (!chip || !canvasEl) return

      const grab = grabOffsetRef.current

      const hitVial = findHitPlacedVial(chip)
      if (hitVial) {
        setPlaced((prev) => {
          const { vials, addVial, recordFusion } = useAlchemixStore.getState()
          const va = vials[hitVial.vialId]
          const vb = vials[vialId]
          if (!va || !vb) return prev
          const outcome = resolveFusionProduct(va, vb, vials)
          if (!outcome.ok) {
            showSipHint('Ce mélange reste inerte.')
            return prev
          }
          const { vial: result, wasNew } = outcome
          if (wasNew) addVial(result)
          recordFusion()
          return prev
            .filter((p) => p.instanceId !== hitVial.instanceId)
            .concat({
              instanceId: crypto.randomUUID(),
              vialId: result.id,
              xPct: hitVial.xPct,
              yPct: hitVial.yPct,
            })
        })
        return
      }

      if (tryCharacterSip(vialId, undefined, chip)) return

      const { cx, cy } = grabCenterClient(info, grab, chip)
      if (clientPointInCanvasPlacement(canvasEl, cx, cy)) {
        const pos = clientPointToCanvasPercent(canvasEl, cx, cy)
        setPlaced((prev) => [
          ...prev,
          {
            instanceId: crypto.randomUUID(),
            vialId,
            ...pos,
          },
        ])
      }
    },
    [findHitPlacedVial, showSipHint, tryCharacterSip],
  )

  const completeLabDrag = useCallback(
    (instanceId: string, vialId: string, drag: Draggable) => {
      const target = drag.target as HTMLElement
      const chip = chipFromDragTarget(target)
      const canvasEl = canvasRef.current
      if (!chip || !canvasEl) return

      const hitVial = findHitPlacedVial(chip, instanceId)
      if (hitVial) {
        const targetInstanceId = hitVial.instanceId

        setPlaced((prev) => {
          const targetPlaced = prev.find((p) => p.instanceId === targetInstanceId)
          const sourcePlaced = prev.find((p) => p.instanceId === instanceId)
          if (!targetPlaced || !sourcePlaced) return prev
          const { vials, addVial, recordFusion } = useAlchemixStore.getState()
          const va = vials[targetPlaced.vialId]
          const vb = vials[vialId]
          if (!va || !vb) return prev
          const outcome = resolveFusionProduct(va, vb, vials)
          if (!outcome.ok) {
            showSipHint('Ce mélange reste inerte.')
            return prev
          }
          const { vial: result, wasNew } = outcome
          if (wasNew) addVial(result)
          recordFusion()
          return prev
            .filter(
              (p) =>
                p.instanceId !== targetInstanceId &&
                p.instanceId !== instanceId,
            )
            .concat({
              instanceId: crypto.randomUUID(),
              vialId: result.id,
              xPct: targetPlaced.xPct,
              yPct: targetPlaced.yPct,
            })
        })
        return
      }

      if (tryCharacterSip(vialId, instanceId, chip)) return

      const grab = grabOffsetRef.current
      const { cx, cy } = grabCenterClient(drag, grab, chip)
      if (clientPointInCanvasPlacement(canvasEl, cx, cy)) {
        const pos = clientPointToCanvasPercent(canvasEl, cx, cy)
        setPlaced((prev) =>
          prev.map((p) =>
            p.instanceId === instanceId ? { ...p, ...pos } : p,
          ),
        )
      }
    },
    [findHitPlacedVial, showSipHint, tryCharacterSip],
  )

  const labDragValue = useMemo(
    () => ({
      grabOffsetRef,
      completeInventoryDrag,
      completeLabDrag,
    }),
    [completeInventoryDrag, completeLabDrag],
  )

  const removePlaced = (instanceId: string) => {
    setPlaced((prev) => prev.filter((p) => p.instanceId !== instanceId))
  }

  const duplicatePlaced = useCallback((source: LabPlacedVial) => {
    setPlaced((prev) => [
      ...prev,
      {
        instanceId: crypto.randomUUID(),
        vialId: source.vialId,
        xPct: Math.min(94, Math.max(6, source.xPct + 7)),
        yPct: Math.min(90, Math.max(10, source.yPct + 6)),
      },
    ])
  }, [])

  const handleReset = () => {
    if (
      !window.confirm(
        'Réinitialiser la progression ? L’inventaire reviendra aux 5 éléments de départ et le laboratoire sera vidé.',
      )
    ) {
      return
    }
    resetToStarters()
    setPlaced([])
  }

  return (
    <div className="alchemix-lab flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <LabDragContext.Provider value={labDragValue}>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(220px,19.5rem)] gap-0 text-left max-[560px]:grid-cols-[minmax(0,1fr)_minmax(140px,36vw)]">
          <div className="relative h-full min-h-0 min-w-0 border-r border-[color:var(--border)] bg-[color:var(--panel-bg,var(--code-bg))]">
            <section
              className="absolute inset-0 overflow-hidden"
              aria-label="Zone de jeu"
            >
              <LabCanvas
                placed={placed}
                vialsById={vialsById}
                canvasRef={canvasRef}
                onRemovePlaced={removePlaced}
                onDuplicatePlaced={duplicatePlaced}
              />
            </section>
            <div
              className="lab-leftHudCharacter pointer-events-none absolute inset-x-0 bottom-0 z-30 p-[0.85rem] pt-12"
              aria-label="Personnage"
            >
              <div className="pointer-events-auto mx-auto w-full max-w-xl">
                <CharacterSipZone ref={characterSipRef} hint={sipHint} />
              </div>
            </div>
          </div>
          <aside
            className="lab-inventoryColumn flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
            aria-label="Inventaire"
          >
            <header className="lab-inventoryColumn-header flex shrink-0 items-center justify-between gap-2 border-b px-[0.65rem] py-2">
              <h2 className="lab-inventoryTitle">Inventaire</h2>
              <div className="flex shrink-0 items-center gap-[0.35rem]">
                <button
                  type="button"
                  className="lab-resetBtn"
                  onClick={handleReset}
                  title="Réinitialiser la progression"
                  aria-label="Réinitialiser : inventaire de départ et laboratoire vide"
                >
                  Reset
                </button>
              </div>
            </header>
            <InventoryPanel
              elements={inventoryGroups.elements}
              spells={inventoryGroups.spells}
              creatures={inventoryGroups.creatures}
            />
          </aside>
        </div>
      </LabDragContext.Provider>
    </div>
  )
}
