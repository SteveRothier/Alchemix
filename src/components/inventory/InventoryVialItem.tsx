import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Vial } from '../../types'
import { VialChip } from '../vial/VialChip'

type InventoryVialItemProps = {
  vial: Vial
}

export function InventoryVialItem({ vial }: InventoryVialItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `inv-${vial.id}`,
    data: { kind: 'inventory' as const, vialId: vial.id },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="lab-invItemWrap"
      {...listeners}
      {...attributes}
    >
      <VialChip vial={vial} inventory />
    </div>
  )
}
