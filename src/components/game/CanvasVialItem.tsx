import { gsap } from 'gsap'
import type { Draggable as DraggableInstance } from 'gsap/Draggable'
import { useEffect, useRef } from 'react'
import { resolveLabVialDisplayName } from '../../lib/legacyVialIdRenames'
import type { Vial } from '../../types'
import { Draggable, registerGsapDraggable } from '../../lib/registerGsapDraggable'
import {
  clearLabOfferDragHover,
  collectLabFusionDropTargets,
  fusionDragRectOverlapsTargetChip,
  updateLabOfferDragHoverFromRect,
  type LabFusionDropTarget,
} from './labGeometry'
import { useLabDrag } from './LabDragContext'
import { useLabSelection } from './LabSelectionContext'
import type { LabPlacedVial } from './labTypes'
import { VialChip } from '../vial/VialChip'

/** Désactive le dégradé ::before au survol pendant le drag plateau (carte déplacée + cibles). */
const HTML_ATTR_CANVAS_CHIP_DRAG = 'data-lab-canvas-chip-drag'

type CanvasVialItemProps = {
  placed: LabPlacedVial
  vial: Vial
  zIndex: number
  isSelected: boolean
  onRemove: (instanceId: string) => void
  /** Clic droit sur une carte déjà sélectionnée : retirer toute la sélection du labo. */
  onRemoveSelectedPlaced: () => void
  onDuplicate: (source: LabPlacedVial) => void
}

export function CanvasVialItem({
  placed,
  vial,
  zIndex,
  isSelected,
  onRemove,
  onRemoveSelectedPlaced,
  onDuplicate,
}: CanvasVialItemProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const dragLayerRef = useRef<HTMLDivElement>(null)
  const labDrag = useLabDrag()
  const labSelection = useLabSelection()
  const zIndexRef = useRef(zIndex)
  zIndexRef.current = zIndex

  useEffect(() => {
    registerGsapDraggable()
    const dragLayer = dragLayerRef.current
    const outer = outerRef.current
    if (!dragLayer || !outer || !labDrag) return

    let lastOverDropHit: HTMLElement | null = null
    let fusionHoverRaf = 0
    let fusionDropTargets: LabFusionDropTarget[] = []
    let groupPeerDragLayers: HTMLElement[] = []
    const chipFound = dragLayer.querySelector('.lab-chipInventory')
    const dragChipEl = chipFound instanceof HTMLElement ? chipFound : null

    const refreshFusionDropTargets = () => {
      const canvasRoot =
        labDrag.labCanvasRef.current ??
        (dragLayer.closest('.lab-canvas') as HTMLElement | null)
      fusionDropTargets =
        canvasRoot instanceof HTMLElement
          ? collectLabFusionDropTargets(canvasRoot)
          : []
    }

    const cancelFusionHoverRaf = () => {
      if (fusionHoverRaf) {
        cancelAnimationFrame(fusionHoverRaf)
        fusionHoverRaf = 0
      }
    }

    const clearFusionHover = () => {
      cancelFusionHoverRaf()
      if (lastOverDropHit) {
        lastOverDropHit.removeAttribute('data-over-target')
        lastOverDropHit = null
      }
      clearLabOfferDragHover()
    }

    const updateFusionHover = () => {
      if (!dragChipEl) {
        clearLabOfferDragHover()
        return
      }

      const dragRect = dragChipEl.getBoundingClientRect()
      let nextHit: HTMLElement | null = null
      for (const t of fusionDropTargets) {
        if (t.instanceId === placed.instanceId) continue
        if (fusionDragRectOverlapsTargetChip(dragRect, t.chip)) {
          nextHit = t.host
          break
        }
      }

      if (nextHit !== lastOverDropHit) {
        if (lastOverDropHit) lastOverDropHit.removeAttribute('data-over-target')
        if (nextHit) nextHit.setAttribute('data-over-target', '')
        lastOverDropHit = nextHit
      }
      updateLabOfferDragHoverFromRect(dragRect)
    }

    const scheduleFusionHover = () => {
      if (fusionHoverRaf) return
      fusionHoverRaf = requestAnimationFrame(() => {
        fusionHoverRaf = 0
        updateFusionHover()
      })
    }

    gsap.set(dragLayer, { x: 0, y: 0 })

    const d = Draggable.create(dragLayer, {
      type: 'x,y',
      bounds: '.alchemix-lab',
      inertia: false,
      /* 0 : le défaut GSAP (2) met à zéro xChange/yChange tant que |delta| < 2px depuis le press,
       * ce qui donne une zone morte par axe et une sensation de « grille » / pas collants. */
      minimumMovement: 0,
      zIndexBoost: false,
      allowContextMenu: true,
      allowNativeTouchScrolling: false,
      dragResistance: 0,
      edgeResistance: 0,
      onPress(this: DraggableInstance) {
        groupPeerDragLayers = []
        const sel = labSelection?.selectedIdsRef.current
        const root = labDrag.labCanvasRef.current
        if (
          sel &&
          sel.size > 1 &&
          sel.has(placed.instanceId) &&
          root instanceof HTMLElement
        ) {
          for (const host of root.querySelectorAll('[data-lab-canvas-vial]')) {
            if (!(host instanceof HTMLElement)) continue
            const id = host.getAttribute('data-lab-canvas-vial')
            if (!id || id === placed.instanceId || !sel.has(id)) continue
            const layer = host.querySelector('.lab-canvasVialDragLayer')
            if (layer instanceof HTMLElement) groupPeerDragLayers.push(layer)
          }
        }
        refreshFusionDropTargets()
        document.documentElement.setAttribute(HTML_ATTR_CANVAS_CHIP_DRAG, '')
        const chip = dragChipEl
        if (chip) {
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
      /* Draggable ne pousse le rendu transform qu’au tick GSAP : on applique x/y tout de suite pour coller au curseur. */
      onMove(this: DraggableInstance) {
        gsap.set(dragLayer, { x: this.x, y: this.y })
        for (const el of groupPeerDragLayers) {
          gsap.set(el, { x: this.x, y: this.y })
        }
      },
      onDrag() {
        scheduleFusionHover()
      },
      onRelease(this: DraggableInstance) {
        clearFusionHover()
        document.documentElement.removeAttribute(HTML_ATTR_CANVAS_CHIP_DRAG)
        if (outer) gsap.set(outer, { zIndex: zIndexRef.current })
        const moved = Math.hypot(this.x, this.y) >= 2
        const skipDragLayerReset =
          moved && labDrag.completeLabDrag(placed.instanceId, placed.vialId, this)
        /* Si skip (fusion / retour inventaire / etc.), ne pas remettre les pairs à 0 :
         * sinon les cartes du groupe sautent à leur ancienne position pendant shrinkRemoveLabVial. */
        if (!skipDragLayerReset) {
          for (const el of groupPeerDragLayers) {
            gsap.set(el, { x: 0, y: 0 })
          }
        }
        groupPeerDragLayers = []
        labDrag.grabOffsetRef.current = null
        if (!skipDragLayerReset) {
          gsap.set(dragLayer, { x: 0, y: 0 })
        }
      },
    })[0]

    return () => {
      cancelFusionHoverRaf()
      clearLabOfferDragHover()
      document.documentElement.removeAttribute(HTML_ATTR_CANVAS_CHIP_DRAG)
      d.kill()
    }
  }, [labDrag, placed.instanceId, placed.vialId, placed.xPct, placed.yPct])

  return (
    <div
      ref={outerRef}
      className="absolute touch-none"
      data-lab-canvas-vial={placed.instanceId}
      style={{
        left: `${placed.xPct}%`,
        top: `${placed.yPct}%`,
        transform: 'translate(-50%, -50%)',
        zIndex,
      }}
    >
      <div className="lab-canvasVialPivot inline-flex max-w-full touch-none">
        <div
          ref={dragLayerRef}
          className="lab-canvasVialDragLayer inline-flex max-w-full touch-none"
        >
          <div
            className="lab-dropHit"
            data-lab-drop-target={placed.instanceId}
            {...(isSelected ? { 'data-lab-selected': '' } : {})}
          >
            <div
              className="lab-invItemWrap lab-dragSurface"
              aria-label={`${resolveLabVialDisplayName(vial)} — drag to move, double-click to duplicate, right-click to remove from the bench (multi-select: drag on the background, then right-click a selected card to remove all)`}
              onDoubleClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDuplicate(placed)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (isSelected) {
                  onRemoveSelectedPlaced()
                } else {
                  onRemove(placed.instanceId)
                }
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
