import { gsap } from 'gsap'
import type { Draggable as DraggableInstance } from 'gsap/Draggable'
import { useEffect, useRef } from 'react'
import type { Vial } from '../../types'
import { Draggable, registerGsapDraggable } from '../../lib/registerGsapDraggable'
import { useLabDrag } from './LabDragContext'
import type { LabPlacedVial } from './labTypes'
import { VialChip } from '../vial/VialChip'

type CanvasVialItemProps = {
  placed: LabPlacedVial
  vial: Vial
  zIndex: number
  onRemove: (instanceId: string) => void
  onDuplicate: (source: LabPlacedVial) => void
}

export function CanvasVialItem({
  placed,
  vial,
  zIndex,
  onRemove,
  onDuplicate,
}: CanvasVialItemProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const dragLayerRef = useRef<HTMLDivElement>(null)
  const labDrag = useLabDrag()
  const zIndexRef = useRef(zIndex)
  zIndexRef.current = zIndex

  useEffect(() => {
    registerGsapDraggable()
    const dragLayer = dragLayerRef.current
    const outer = outerRef.current
    if (!dragLayer || !outer || !labDrag) return

    const d = Draggable.create(dragLayer, {
      type: 'left,top',
      bounds: '.lab-canvas',
      inertia: false,
      minimumMovement: 6,
      zIndexBoost: false,
      allowContextMenu: true,
      allowNativeTouchScrolling: false,
      autoRound: false,
      edgeResistance: 0,
      onPress(this: DraggableInstance) {
        const chip = dragLayer.querySelector('.lab-chipInventory')
        if (chip instanceof HTMLElement) {
          const r = chip.getBoundingClientRect()
          labDrag.grabOffsetRef.current = {
            dx: r.left + r.width / 2 - this.pointerX,
            dy: r.top + r.height / 2 - this.pointerY,
          }
        } else {
          labDrag.grabOffsetRef.current = null
        }
        if (outer) gsap.set(outer, { zIndex: 920 })
      },
      onRelease(this: DraggableInstance) {
        if (outer) gsap.set(outer, { zIndex: zIndexRef.current })
        const moved = Math.hypot(this.x, this.y) >= 2
        if (moved) {
          labDrag.completeLabDrag(placed.instanceId, placed.vialId, this)
        }
        labDrag.grabOffsetRef.current = null
        gsap.set(dragLayer, { left: 0, top: 0, clearProps: 'transform' })
      },
    })[0]

    return () => {
      d.kill()
    }
  }, [
    labDrag,
    placed.instanceId,
    placed.vialId,
    placed.xPct,
    placed.yPct,
  ])

  return (
    <div
      ref={outerRef}
      className="absolute touch-none"
      style={{
        left: `${placed.xPct}%`,
        top: `${placed.yPct}%`,
        zIndex,
      }}
    >
      <div
        className="lab-canvasVialPivot inline-flex max-w-full touch-none"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <div
          ref={dragLayerRef}
          className="lab-canvasVialDragLayer inline-flex max-w-full touch-none"
        >
          <div
            className="lab-dropHit"
            data-lab-drop-target={placed.instanceId}
          >
            <div
              className="lab-invItemWrap lab-dragSurface"
              aria-label={`${vial.name} — glisser pour déplacer, double-clic pour dupliquer, clic droit pour retirer du labo`}
              onDoubleClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDuplicate(placed)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onRemove(placed.instanceId)
              }}
            >
              <VialChip vial={vial} inventory />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
