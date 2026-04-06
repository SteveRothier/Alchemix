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
import { useMemo, useRef, useState } from 'react'
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
  if (hits.length > 0) return hits
  return rectIntersection(args)
}

export function AlchemixShell() {
  const vialsById = useAlchemixStore((s) => s.vials)
  const discoveryCount = useAlchemixStore(selectDiscoveryCount)
  const tier = tierFromDiscoveryCount(discoveryCount)

  const inventoryList = useMemo(
    () =>
      Object.values(vialsById).sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
      ),
    [vialsById],
  )

  const [placed, setPlaced] = useState<LabPlacedVial[]>([])
  const [activeDragVialId, setActiveDragVialId] = useState<string | null>(null)

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
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDragVialId(null)
    const { active, over } = event
    const canvasEl = canvasRef.current
    const activeData = active.data.current as LabDragData | undefined
    if (!activeData || !canvasEl) return

    const tr =
      active.rect.current.translated ?? active.rect.current.initial
    if (!tr) return

    const rectCanvas = canvasEl.getBoundingClientRect()
    const pos = clientRectToCanvasPercent(tr, rectCanvas)

    if (!over) return

    const overId = String(over.id)

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

  return (
    <div className={styles.viewport}>
      <DndContext
        sensors={sensors}
        collisionDetection={labCollision}
        onDragStart={onDragStart}
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
              <p className={styles.characterPlaceholder}>
                Personnage — sorts (à venir)
              </p>
            </section>
            <aside className={styles.quickStats} aria-label="Statistiques rapides">
              <p className={styles.statsLine}>Découvertes : {discoveryCount}</p>
              <p className={styles.statsLine}>Tier : {tier}/10</p>
            </aside>
          </div>
          <aside className={styles.inventory} aria-label="Inventaire">
            <header className={styles.inventoryHeader}>
              <h2 className={styles.inventoryTitle}>Inventaire</h2>
            </header>
            <InventoryPanel vials={inventoryList} />
          </aside>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDragVial ? <VialChip vial={activeDragVial} inventory /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
