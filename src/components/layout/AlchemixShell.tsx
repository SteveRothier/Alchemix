import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CharacterSipZone } from '../character/CharacterSipZone'
import { LabDragContext, type InventoryDragEndInfo } from '../game/LabDragContext'
import {
  clientPointInCanvasPlacement,
  clientPointToCanvasPercent,
  fusionCardsOverlap,
  grabCenterClient,
} from '../game/labGeometry'
import type { LabPlacedVial } from '../game/labTypes'
import { LabCanvas } from '../game/LabCanvas'
import { InventoryPanel } from '../inventory/InventoryPanel'
import { resolveFusionProduct } from '../../lib/fusion'
import type { DrinkSpellResult } from '../../lib/drinkSpell'
import {
  Draggable,
  gsap,
  registerGsapDraggable,
} from '../../lib/registerGsapDraggable'
import { useAlchemixStore } from '../../store/useAlchemixStore'
import '../lab/alchemixLab.css'

registerGsapDraggable()

function chipFromDragTarget(target: HTMLElement): HTMLElement | null {
  return (target.querySelector('.lab-chipInventory') as HTMLElement | null) ?? target
}

function chipOverlapsInventoryColumn(chip: HTMLElement): boolean {
  const inv = document.querySelector('.lab-inventoryColumn')
  if (!(inv instanceof HTMLElement)) return false
  const ir = inv.getBoundingClientRect()
  const cr = chip.getBoundingClientRect()
  return (
    cr.right > ir.left &&
    cr.left < ir.right &&
    cr.bottom > ir.top &&
    cr.top < ir.bottom
  )
}

/** Réduction + disparition avant retrait du state (clic droit, retour inventaire). */
function shrinkRemoveLabVial(
  el: HTMLElement | null | undefined,
  onComplete: () => void,
) {
  if (!el) {
    onComplete()
    return
  }
  gsap.killTweensOf(el)
  gsap.to(el, {
    scale: 0,
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
    transformOrigin: '50% 50%',
    onComplete,
  })
}

/** Même principe que la suppression : les deux cartes rétrécissent puis disparition. */
function animateFusionShrinkPair(
  elA: HTMLElement | null | undefined,
  elB: HTMLElement | null | undefined,
  onComplete: () => void,
) {
  const nodes = [elA, elB].filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  )
  if (nodes.length === 0) {
    onComplete()
    return
  }
  for (const el of nodes) {
    gsap.killTweensOf(el)
  }
  const tl = gsap.timeline({ onComplete })
  for (const el of nodes) {
    tl.to(
      el,
      {
        scale: 0,
        opacity: 0,
        duration: 0.16,
        ease: 'power2.in',
        transformOrigin: '50% 50%',
      },
      0,
    )
  }
}

function canvasChipForInstance(
  canvasRoot: HTMLElement | null | undefined,
  instanceId: string,
): HTMLElement | null {
  if (!canvasRoot) return null
  const host = canvasRoot.querySelector(
    `[data-lab-canvas-vial="${CSS.escape(instanceId)}"]`,
  )
  if (!(host instanceof HTMLElement)) return null
  const chip = host.querySelector('.lab-chipInventory')
  return chip instanceof HTMLElement ? chip : null
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
  const [inventoryGhostActive, setInventoryGhostActive] = useState(false)
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

  useEffect(() => {
    if (!inventoryGhostActive) return
    document.body.classList.add('lab-invGhostDrag')
    return () => {
      document.body.classList.remove('lab-invGhostDrag')
    }
  }, [inventoryGhostActive])

  const findHitPlacedVial = useCallback(
    (chip: Element, excludeInstanceId?: string): LabPlacedVial | null => {
      for (const p of placedRef.current) {
        if (excludeInstanceId && p.instanceId === excludeInstanceId) continue
        const el = document.querySelector(
          `[data-lab-drop-target="${CSS.escape(p.instanceId)}"]`,
        )
        if (
          chip instanceof HTMLElement &&
          el instanceof HTMLElement &&
          fusionCardsOverlap(chip, el)
        ) {
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
        const { vials, addVial, recordFusion } = useAlchemixStore.getState()
        const va = vials[hitVial.vialId]
        const vb = vials[vialId]
        if (!va || !vb) return
        const outcome = resolveFusionProduct(va, vb, vials)
        if (!outcome.ok) {
          showSipHint('Ce mélange reste inerte.')
          return
        }
        const { vial: result, wasNew } = outcome
        if (wasNew) addVial(result)
        recordFusion()
        const targetInstanceId = hitVial.instanceId
        const targetChip = canvasChipForInstance(canvasEl, targetInstanceId)
        const newEntry: LabPlacedVial = {
          instanceId: crypto.randomUUID(),
          vialId: result.id,
          xPct: hitVial.xPct,
          yPct: hitVial.yPct,
        }
        const applyFusion = () =>
          setPlaced((cur) => {
            const hasTarget = cur.some((p) => p.instanceId === targetInstanceId)
            if (!hasTarget) return cur
            return cur
              .filter((p) => p.instanceId !== targetInstanceId)
              .concat(newEntry)
          })

        if (targetChip) {
          return new Promise<void>((resolve) => {
            animateFusionShrinkPair(chip, targetChip, () => {
              applyFusion()
              resolve()
            })
          })
        }
        applyFusion()
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
    (instanceId: string, vialId: string, drag: Draggable): boolean => {
      const target = drag.target as HTMLElement
      const chip = chipFromDragTarget(target)
      const canvasEl = canvasRef.current
      if (!chip || !canvasEl) return false

      const hitVial = findHitPlacedVial(chip, instanceId)
      if (hitVial) {
        const targetInstanceId = hitVial.instanceId
        const targetPlaced = placedRef.current.find(
          (p) => p.instanceId === targetInstanceId,
        )
        const sourcePlaced = placedRef.current.find(
          (p) => p.instanceId === instanceId,
        )
        if (!targetPlaced || !sourcePlaced) return false
        const { vials, addVial, recordFusion } = useAlchemixStore.getState()
        const va = vials[targetPlaced.vialId]
        const vb = vials[vialId]
        if (!va || !vb) return false
        const outcome = resolveFusionProduct(va, vb, vials)
        if (!outcome.ok) {
          showSipHint('Ce mélange reste inerte.')
          return false
        }
        const { vial: result, wasNew } = outcome
        if (wasNew) addVial(result)
        recordFusion()
        const newEntry: LabPlacedVial = {
          instanceId: crypto.randomUUID(),
          vialId: result.id,
          xPct: targetPlaced.xPct,
          yPct: targetPlaced.yPct,
        }
        const sourceChip = chip
        const targetChip = canvasChipForInstance(canvasEl, targetInstanceId)
        const applyFusion = () =>
          setPlaced((cur) => {
            const hasBoth =
              cur.some((p) => p.instanceId === targetInstanceId) &&
              cur.some((p) => p.instanceId === instanceId)
            if (!hasBoth) return cur
            return cur
              .filter(
                (p) =>
                  p.instanceId !== targetInstanceId &&
                  p.instanceId !== instanceId,
              )
              .concat(newEntry)
          })

        if (sourceChip && targetChip) {
          animateFusionShrinkPair(sourceChip, targetChip, applyFusion)
          return true
        }
        applyFusion()
        return false
      }

      if (tryCharacterSip(vialId, instanceId, chip)) return false

      if (chipOverlapsInventoryColumn(chip)) {
        const canvasRoot = canvasEl
        if (chip instanceof HTMLElement && canvasRoot.contains(chip)) {
          shrinkRemoveLabVial(chip, () => {
            setPlaced((prev) => prev.filter((p) => p.instanceId !== instanceId))
          })
          return true
        }
        setPlaced((prev) => prev.filter((p) => p.instanceId !== instanceId))
        return false
      }

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
      return false
    },
    [findHitPlacedVial, showSipHint, tryCharacterSip],
  )

  const labDragValue = useMemo(
    () => ({
      grabOffsetRef,
      labCanvasRef: canvasRef,
      completeInventoryDrag,
      completeLabDrag,
      setInventoryGhostDragging: setInventoryGhostActive,
    }),
    [completeInventoryDrag, completeLabDrag],
  )

  const removePlaced = useCallback((instanceId: string) => {
    const root = canvasRef.current
    const host = root?.querySelector(
      `[data-lab-canvas-vial="${CSS.escape(instanceId)}"]`,
    ) as HTMLElement | null
    const chipEl = host?.querySelector(
      '.lab-chipInventory',
    ) as HTMLElement | null
    shrinkRemoveLabVial(chipEl, () => {
      setPlaced((prev) => prev.filter((p) => p.instanceId !== instanceId))
    })
  }, [])

  const duplicatePlaced = useCallback((source: LabPlacedVial) => {
    /** Décalage centre → centre pour l’empilement visuel (bas-droite), en px CSS. */
    const stepPx = 18
    const canvasEl = canvasRef.current
    const rect = canvasEl?.getBoundingClientRect()
    let dxPct = 3.2
    let dyPct = 2.8
    if (rect && rect.width > 0 && rect.height > 0) {
      dxPct = (stepPx / rect.width) * 100
      dyPct = (stepPx / rect.height) * 100
    }
    setPlaced((prev) => [
      ...prev,
      {
        instanceId: crypto.randomUUID(),
        vialId: source.vialId,
        xPct: Math.min(94, Math.max(6, source.xPct + dxPct)),
        yPct: Math.min(90, Math.max(10, source.yPct + dyPct)),
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
          <div className="relative z-10 h-full min-h-0 min-w-0 border-r border-[color:var(--border)] bg-[color:var(--panel-bg,var(--code-bg))]">
            <section
              className="absolute inset-0 overflow-visible"
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
            className="lab-inventoryColumn relative z-0 flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
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
