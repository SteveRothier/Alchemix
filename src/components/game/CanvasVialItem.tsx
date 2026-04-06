import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Vial } from '../../types'
import { VialChip } from '../vial/VialChip'
import type { LabPlacedVial } from './labTypes'
import styles from './CanvasVialItem.module.css'

type CanvasVialItemProps = {
  placed: LabPlacedVial
  vial: Vial
  zIndex: number
  onRemove: (instanceId: string) => void
}

export function CanvasVialItem({
  placed,
  vial,
  zIndex,
  onRemove,
}: CanvasVialItemProps) {
  const dragId = `lab-drag-${placed.instanceId}`
  const dropId = `lab-target-${placed.instanceId}`

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: dragId,
    data: {
      kind: 'lab' as const,
      instanceId: placed.instanceId,
      vialId: placed.vialId,
    },
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: dropId,
    data: { instanceId: placed.instanceId, vialId: placed.vialId },
  })

  const setRefs = (node: HTMLDivElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }

  const dragT = CSS.Translate.toString(transform)
  const style = {
    left: `${placed.xPct}%`,
    top: `${placed.yPct}%`,
    zIndex,
    transform: dragT
      ? `translate(-50%, -50%) ${dragT}`
      : 'translate(-50%, -50%)',
    opacity: isDragging ? 0.25 : 1,
  } as const

  return (
    <div
      ref={setRefs}
      className={styles.placed}
      style={style}
      data-over-target={isOver || undefined}
    >
      <div
        className={styles.dragSurface}
        title="Clic droit pour retirer du labo"
        aria-label={`${vial.name} — glisser pour déplacer, clic droit pour retirer du labo`}
        {...listeners}
        {...attributes}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onRemove(placed.instanceId)
        }}
      >
        <VialChip vial={vial} compact />
      </div>
    </div>
  )
}
