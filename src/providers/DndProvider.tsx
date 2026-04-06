import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { ReactNode } from 'react'

type DndProviderProps = {
  children: ReactNode
  onDragEnd?: (event: DragEndEvent) => void
}

export function DndProvider({ children, onDragEnd }: DndProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  )
}
