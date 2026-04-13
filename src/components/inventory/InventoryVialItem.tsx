import { useEffect, useRef } from 'react'
import { remapSvgIdsInClonedSubtree } from '../../lib/remapSvgIdsForDomClone'
import {
  collectLabFusionDropTargets,
  fusionDragRectOverlapsTargetChip,
  type LabFusionDropTarget,
} from '../game/labGeometry'
import type { Vial } from '../../types'
import { useLabDrag, type LabDragContextValue } from '../game/LabDragContext'
import { VialChip } from '../vial/VialChip'

const MIN_MOVE_PX = 6

type InventoryVialItemProps = {
  vial: Vial
}

/**
 * Drag inventaire : clone fixed + translate3d, pointer events natifs (sans GSAP).
 */
export function InventoryVialItem({ vial }: InventoryVialItemProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const labDrag = useLabDrag()

  useEffect(() => {
    if (!wrapRef.current || !labDrag) return
    const el = wrapRef.current as HTMLDivElement
    const ctx = labDrag as LabDragContextValue

    let activePointerId: number | null = null
    let dragActive = false
    let startX = 0
    let startY = 0
    let grabDx = 0
    let grabDy = 0
    let ghostEl: HTMLDivElement | null = null
    let lastOverDropHit: HTMLElement | null = null
    let ghostW = 0
    let ghostH = 0
    let fusionHoverRaf = 0
    let fusionDropTargets: LabFusionDropTarget[] = []
    let labElCached: HTMLElement | null = null
    let ghostChipEl: HTMLElement | null = null

    const refreshFusionTargets = () => {
      const canvasRoot =
        ctx.labCanvasRef.current ??
        (document.querySelector('.alchemix-lab .lab-canvas') as HTMLElement | null)
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
    }

    const updateFusionHoverFromGhost = () => {
      const g = ghostEl
      if (!g) return
      const chip =
        ghostChipEl?.isConnected === true
          ? ghostChipEl
          : (g.querySelector('.lab-chipInventory') as HTMLElement | null)
      if (!(chip instanceof HTMLElement)) return

      const dragRect = chip.getBoundingClientRect()
      let nextHit: HTMLElement | null = null
      for (const t of fusionDropTargets) {
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
    }

    const scheduleFusionHoverFromGhost = () => {
      if (fusionHoverRaf) return
      fusionHoverRaf = requestAnimationFrame(() => {
        fusionHoverRaf = 0
        updateFusionHoverFromGhost()
      })
    }

    const removeGhost = () => {
      clearFusionHover()
      labElCached = null
      ctx.setInventoryGhostDragging(false)
      if (ghostEl?.isConnected) ghostEl.remove()
      ghostEl = null
      ghostChipEl = null
      ghostW = 0
      ghostH = 0
      ctx.grabOffsetRef.current = null
    }

    const detachDocument = () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerEnd)
      document.removeEventListener('pointercancel', onPointerEnd)
    }

    function clampToLab(clientX: number, clientY: number) {
      const g = ghostEl
      if (!g) return
      const labEl =
        labElCached ?? (document.querySelector('.alchemix-lab') as HTMLElement | null)
      if (!(labEl instanceof HTMLElement)) return
      const lab = labEl.getBoundingClientRect()
      const w = ghostW > 0 ? ghostW : g.getBoundingClientRect().width
      const h = ghostH > 0 ? ghostH : g.getBoundingClientRect().height
      let left = clientX - grabDx
      let top = clientY - grabDy
      left = Math.min(Math.max(lab.left, left), lab.right - w)
      top = Math.min(Math.max(lab.top, top), lab.bottom - h)
      g.style.transform = `translate3d(${left}px, ${top}px, 0)`
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerId !== activePointerId) return

      if (!dragActive) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < MIN_MOVE_PX)
          return
        dragActive = true
        e.preventDefault()

        const r = el.getBoundingClientRect()
        ghostEl = el.cloneNode(true) as HTMLDivElement
        ghostEl.classList.add('lab-invDragGhost')
        ghostEl.setAttribute('aria-hidden', 'true')
        ghostEl.style.position = 'fixed'
        ghostEl.style.left = '0'
        ghostEl.style.top = '0'
        ghostEl.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`
        /* Pas de largeur figée : en labo le style IC + police plus large que l’inventaire ; sinon ellipsis « Mag… ». */
        ghostEl.style.margin = '0'
        ghostEl.style.boxSizing = 'border-box'
        ghostEl.style.zIndex = '10050'
        ghostEl.style.pointerEvents = 'none'

        remapSvgIdsInClonedSubtree(ghostEl)
        document.body.appendChild(ghostEl)
        ctx.setInventoryGhostDragging(true)
        labElCached = document.querySelector(
          '.alchemix-lab',
        ) as HTMLElement | null
        refreshFusionTargets()
        void ghostEl.offsetWidth
        const ghostBox = ghostEl.getBoundingClientRect()
        ghostW = ghostBox.width
        ghostH = ghostBox.height
        /* Placer sous le pointeur avant grabOffsetRef : sinon le centre puce / souris est faux. */
        const firstMoves =
          typeof e.getCoalescedEvents === 'function' &&
          e.getCoalescedEvents().length > 0
            ? e.getCoalescedEvents()
            : [e]
        const firstLast = firstMoves[firstMoves.length - 1]!
        const px = firstLast.clientX
        const py = firstLast.clientY
        clampToLab(px, py)
        scheduleFusionHoverFromGhost()

        ghostChipEl = ghostEl.querySelector(
          '.lab-chipInventory',
        ) as HTMLElement | null
        const chip = ghostChipEl
        if (chip) {
          const cr = chip.getBoundingClientRect()
          ctx.grabOffsetRef.current = {
            dx: cr.left + cr.width / 2 - px,
            dy: cr.top + cr.height / 2 - py,
          }
        } else {
          ctx.grabOffsetRef.current = null
        }
        return
      }

      e.preventDefault()
      const moves =
        typeof e.getCoalescedEvents === 'function' && e.getCoalescedEvents().length > 0
          ? e.getCoalescedEvents()
          : [e]
      /* Une mise à jour synchrone par lot coalescé : la carte suit le tracé du pointeur sans attendre la rAF. */
      for (const ev of moves) {
        clampToLab(ev.clientX, ev.clientY)
      }
      /* Un seul hit-test fusion par événement pointer (scheduleFusionHover déduplique déjà par rAF). */
      scheduleFusionHoverFromGhost()
    }

    function onPointerEnd(e: PointerEvent) {
      if (e.pointerId !== activePointerId) return
      detachDocument()
      activePointerId = null

      if (dragActive && ghostEl) {
        clampToLab(e.clientX, e.clientY)
        clearFusionHover()
        const moved =
          Math.hypot(e.clientX - startX, e.clientY - startY) >= 2
        if (moved) {
          const pending = ctx.completeInventoryDrag(vial.id, {
            target: ghostEl,
            pointerX: e.clientX,
            pointerY: e.clientY,
          })
          if (pending instanceof Promise) {
            pending.finally(() => removeGhost())
          } else {
            removeGhost()
          }
        } else {
          removeGhost()
        }
      } else if (
        e.button === 0 &&
        Math.hypot(e.clientX - startX, e.clientY - startY) < MIN_MOVE_PX
      ) {
        /* Clic gauche sans drag : une instance sur le plateau, aléatoire autour du centre. */
        ctx.placeInventoryVialNearLabCenter(vial.id)
      }
      dragActive = false
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      const r = el.getBoundingClientRect()
      startX = e.clientX
      startY = e.clientY
      grabDx = e.clientX - r.left
      grabDy = e.clientY - r.top
      activePointerId = e.pointerId
      document.addEventListener('pointermove', onPointerMove, { passive: false })
      document.addEventListener('pointerup', onPointerEnd)
      document.addEventListener('pointercancel', onPointerEnd)
    }

    el.addEventListener('pointerdown', onPointerDown)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      detachDocument()
      cancelFusionHoverRaf()
      removeGhost()
    }
  }, [vial.id, labDrag])

  return (
    <div ref={wrapRef} className="lab-invItemWrap touch-none">
      <VialChip vial={vial} inventory />
    </div>
  )
}
