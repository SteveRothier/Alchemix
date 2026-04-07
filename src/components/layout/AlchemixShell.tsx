import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CHARACTER_SIP_ID,
  CharacterSipZone,
} from '../character/CharacterSipZone'
import { clientRectToCanvasPercent } from '../game/labGeometry'
import type { LabDragData, LabPlacedVial } from '../game/labTypes'
import { LAB_CANVAS_ID, LabCanvas } from '../game/LabCanvas'
import { InventoryPanel } from '../inventory/InventoryPanel'
import { VialChip } from '../vial/VialChip'
import { resolveFusionProduct } from '../../lib/fusion'
import { tierFromDiscoveryCount } from '../../lib/progression'
import { useAlchemixStore, selectDiscoveryCount } from '../../store/useAlchemixStore'
import styles from './AlchemixShell.module.css'

const labCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  const vialTargets = hits.filter((c) => String(c.id).startsWith('lab-target-'))
  if (vialTargets.length > 0) return vialTargets
  const characterHit = hits.filter((c) => String(c.id) === CHARACTER_SIP_ID)
  if (characterHit.length > 0) return characterHit
  if (hits.length > 0) return hits
  return rectIntersection(args)
}

export function AlchemixShell() {
  const vialsById = useAlchemixStore((s) => s.vials)
  const resetToStarters = useAlchemixStore((s) => s.resetToStarters)
  const discoveryCount = useAlchemixStore(selectDiscoveryCount)
  const tier = tierFromDiscoveryCount(discoveryCount)

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
  const [activeDragVialId, setActiveDragVialId] = useState<string | null>(null)
  const [dragSource, setDragSource] = useState<'inventory' | 'lab' | null>(
    null,
  )
  const [sipHint, setSipHint] = useState<string | null>(null)
  const sipTimerRef = useRef(0)

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

  const canvasRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const activeDragVial = activeDragVialId
    ? (vialsById[activeDragVialId] ?? null)
    : null

  const onDragStart = (event: DragStartEvent) => {
    const d = event.active.data.current as LabDragData | undefined
    setActiveDragVialId(d?.vialId ?? null)
    setDragSource(d?.kind === 'lab' ? 'lab' : d?.kind === 'inventory' ? 'inventory' : null)
  }

  const onDragCancel = () => {
    setActiveDragVialId(null)
    setDragSource(null)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDragVialId(null)
    setDragSource(null)
    const { active, over } = event
    const activeData = active.data.current as LabDragData | undefined
    if (!activeData) return

    if (!over) return

    const overId = String(over.id)

    if (overId === CHARACTER_SIP_ID) {
      const vialId = activeData.vialId
      const store = useAlchemixStore.getState()
      const vial = store.vials[vialId]
      if (!vial || vial.type !== 'spell') {
        showSipHint('Seuls les sorts peuvent être bus.')
        return
      }
      const result = store.feedSpellToCharacter(vialId)
      if (activeData.kind === 'lab') {
        setPlaced((prev) =>
          prev.filter((p) => p.instanceId !== activeData.instanceId),
        )
      }
      if (result.ok) {
        showSipHint(`${result.creature.name} apparaît !`)
      } else if (result.reason === 'no_creature') {
        showSipHint('Aucune créature ne répond à ce sort.')
      } else if (result.reason === 'already_owned') {
        showSipHint('Créature déjà manifestée.')
      }
      return
    }

    const canvasEl = canvasRef.current
    if (!canvasEl) return

    const tr =
      active.rect.current.translated ?? active.rect.current.initial
    if (!tr) return

    const rectCanvas = canvasEl.getBoundingClientRect()
    const pos = clientRectToCanvasPercent(tr, rectCanvas)

    if (overId.startsWith('lab-target-')) {
      const targetInstanceId = overId.slice('lab-target-'.length)

      if (
        activeData.kind === 'lab' &&
        activeData.instanceId === targetInstanceId
      ) {
        setPlaced((prev) =>
          prev.map((p) =>
            p.instanceId === targetInstanceId ? { ...p, ...pos } : p,
          ),
        )
        return
      }

      if (activeData.kind === 'inventory') {
        setPlaced((prev) => {
          const targetPlaced = prev.find(
            (p) => p.instanceId === targetInstanceId,
          )
          if (!targetPlaced) return prev
          const { vials, addVial, recordFusion } = useAlchemixStore.getState()
          const va = vials[targetPlaced.vialId]
          const vb = vials[activeData.vialId]
          if (!va || !vb) return prev
          const { vial: result, wasNew } = resolveFusionProduct(va, vb, vials)
          if (wasNew) addVial(result)
          recordFusion()
          return prev
            .filter((p) => p.instanceId !== targetInstanceId)
            .concat({
              instanceId: crypto.randomUUID(),
              vialId: result.id,
              xPct: targetPlaced.xPct,
              yPct: targetPlaced.yPct,
            })
        })
        return
      }

      if (activeData.kind === 'lab') {
        setPlaced((prev) => {
          const targetPlaced = prev.find(
            (p) => p.instanceId === targetInstanceId,
          )
          const sourcePlaced = prev.find(
            (p) => p.instanceId === activeData.instanceId,
          )
          if (!targetPlaced || !sourcePlaced) return prev
          const { vials, addVial, recordFusion } = useAlchemixStore.getState()
          const va = vials[targetPlaced.vialId]
          const vb = vials[sourcePlaced.vialId]
          if (!va || !vb) return prev
          const { vial: result, wasNew } = resolveFusionProduct(va, vb, vials)
          if (wasNew) addVial(result)
          recordFusion()
          const xPct = (targetPlaced.xPct + sourcePlaced.xPct) / 2
          const yPct = (targetPlaced.yPct + sourcePlaced.yPct) / 2
          return prev
            .filter(
              (p) =>
                p.instanceId !== targetInstanceId &&
                p.instanceId !== activeData.instanceId,
            )
            .concat({
              instanceId: crypto.randomUUID(),
              vialId: result.id,
              xPct,
              yPct,
            })
        })
      }
      return
    }

    if (overId === LAB_CANVAS_ID) {
      if (activeData.kind === 'inventory') {
        setPlaced((prev) => [
          ...prev,
          {
            instanceId: crypto.randomUUID(),
            vialId: activeData.vialId,
            ...pos,
          },
        ])
        return
      }
      if (activeData.kind === 'lab') {
        setPlaced((prev) =>
          prev.map((p) =>
            p.instanceId === activeData.instanceId ? { ...p, ...pos } : p,
          ),
        )
      }
    }
  }

  const removePlaced = (instanceId: string) => {
    setPlaced((prev) => prev.filter((p) => p.instanceId !== instanceId))
  }

  const handleReset = () => {
    if (
      !window.confirm(
        'Réinitialiser la progression ? L’inventaire reviendra aux 7 éléments de départ et le laboratoire sera vidé.',
      )
    ) {
      return
    }
    resetToStarters()
    setPlaced([])
  }

  return (
    <div className={styles.viewport}>
      <DndContext
        sensors={sensors}
        collisionDetection={labCollision}
        onDragStart={onDragStart}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
      >
        <div className={styles.shell}>
          <div className={styles.main}>
            <section className={styles.gameZone} aria-label="Zone de jeu">
              <LabCanvas
                placed={placed}
                vialsById={vialsById}
                canvasRef={canvasRef}
                onRemovePlaced={removePlaced}
              />
            </section>
            <section className={styles.characterZone} aria-label="Personnage">
              <CharacterSipZone hint={sipHint} />
            </section>
            <aside className={styles.quickStats} aria-label="Statistiques rapides">
              <p className={styles.statsLine}>Découvertes : {discoveryCount}</p>
              <p className={styles.statsLine}>Tier : {tier}/10</p>
            </aside>
          </div>
          <aside className={styles.inventory} aria-label="Inventaire">
            <header className={styles.inventoryHeader}>
              <h2 className={styles.inventoryTitle}>Inventaire</h2>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={handleReset}
                title="Réinitialiser la progression"
                aria-label="Réinitialiser : inventaire de départ et laboratoire vide"
              >
                Reset
              </button>
            </header>
            <InventoryPanel
              elements={inventoryGroups.elements}
              spells={inventoryGroups.spells}
              creatures={inventoryGroups.creatures}
            />
          </aside>
        </div>
        <DragOverlay dropAnimation={null} zIndex={12000}>
          {activeDragVial ? (
            dragSource === 'lab' ? (
              <VialChip vial={activeDragVial} lab />
            ) : (
              <VialChip vial={activeDragVial} inventory />
            )
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
