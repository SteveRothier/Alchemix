import { List } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { requestOpenRecipesBookToVial } from '../../lib/recipesBookEvents'
import { remapSvgIdsInClonedSubtree } from '../../lib/remapSvgIdsForDomClone'
import {
  clearLabOfferDragHover,
  collectLabFusionDropTargets,
  fusionDragRectOverlapsTargetChip,
  updateLabOfferDragHoverFromRect,
  type LabFusionDropTarget,
} from '../game/labGeometry'
import type { Vial } from '../../types'
import { useLabDrag, type LabDragContextValue } from '../game/LabDragContext'
import { LAB_MESSAGES } from '../lab/labMessages'
import { VialChip } from '../vial/VialChip'

const MIN_MOVE_PX = 6

/** Position fixe sous la carte (alignée à gauche), repli au-dessus si pas assez de place en bas. */
function computeRecipeContextMenuPosition(cardEl: HTMLElement): { left: number; top: number } {
  const r = cardEl.getBoundingClientRect()
  const gap = 3
  const estW = 118
  const estH = 28
  const pad = 6
  let left = r.left
  let top = r.bottom + gap
  left = Math.max(pad, Math.min(left, window.innerWidth - estW - pad))
  if (top + estH > window.innerHeight - pad) {
    top = Math.max(pad, r.top - estH - gap)
  } else {
    top = Math.max(pad, top)
  }
  return { left, top }
}

type InventoryVialItemProps = {
  vial: Vial
}

/**
 * Drag inventaire : clone fixed + translate3d, pointer events natifs (sans GSAP).
 */
export function InventoryVialItem({ vial }: InventoryVialItemProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const labDrag = useLabDrag()
  const [ctxMenu, setCtxMenu] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!ctxMenu) return
    const focusRaf = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]')?.focus()
    })
    const close = () => setCtxMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      close()
    }
    const onScroll = () => close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      cancelAnimationFrame(focusRaf)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [ctxMenu])

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
      clearLabOfferDragHover()
    }

    const updateFusionHoverFromGhost = () => {
      const g = ghostEl
      if (!g) {
        clearLabOfferDragHover()
        return
      }
      const chip =
        ghostChipEl?.isConnected === true
          ? ghostChipEl
          : (g.querySelector('.lab-chipInventory') as HTMLElement | null)
      if (!(chip instanceof HTMLElement)) {
        clearLabOfferDragHover()
        return
      }

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
      updateLabOfferDragHoverFromRect(dragRect)
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
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerEnd, true)
      document.removeEventListener('pointercancel', onPointerEnd, true)
    }

    const releaseCaptureIfAny = (pointerId: number) => {
      try {
        if (
          typeof el.hasPointerCapture === 'function' &&
          el.hasPointerCapture(pointerId)
        ) {
          el.releasePointerCapture(pointerId)
        }
      } catch {
        /* navigateurs / shadow DOM */
      }
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

        const moves =
          typeof e.getCoalescedEvents === 'function' &&
          e.getCoalescedEvents().length > 0
            ? e.getCoalescedEvents()
            : [e]
        const lastEv = moves[moves.length - 1]!

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
        ghostChipEl = ghostEl.querySelector(
          '.lab-chipInventory',
        ) as HTMLElement | null
        const chip = ghostChipEl
        /*
         * Point de prise = centre de la carte dans le fantôme (pas le coin du wrap).
         * Le clone reçoit les styles « plateau » (carte plus large que la colonne inventaire) :
         * si grabDx/grabDy restent basés sur le wrap d’origine, le centre de la fiche dérive du curseur
         * et le dépôt sur le labo est légèrement décalé par rapport au rendu du fantôme.
         */
        if (chip) {
          const cr = chip.getBoundingClientRect()
          const wr = ghostEl.getBoundingClientRect()
          grabDx = cr.left + cr.width / 2 - wr.left
          grabDy = cr.top + cr.height / 2 - wr.top
        } else {
          grabDx = lastEv.clientX - r.left
          grabDy = lastEv.clientY - r.top
        }
        for (const ev of moves) {
          clampToLab(ev.clientX, ev.clientY)
        }
        scheduleFusionHoverFromGhost()

        if (chip) {
          const cr = chip.getBoundingClientRect()
          ctx.grabOffsetRef.current = {
            dx: cr.left + cr.width / 2 - lastEv.clientX,
            dy: cr.top + cr.height / 2 - lastEv.clientY,
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
      releaseCaptureIfAny(e.pointerId)
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
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* élément non eligible */
      }
      /* capture: true — certains cibles sous le curseur peuvent stopper la propagation avant document. */
      document.addEventListener('pointermove', onPointerMove, {
        passive: false,
        capture: true,
      })
      document.addEventListener('pointerup', onPointerEnd, { capture: true })
      document.addEventListener('pointercancel', onPointerEnd, { capture: true })
    }

    el.addEventListener('pointerdown', onPointerDown)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      if (activePointerId !== null) {
        releaseCaptureIfAny(activePointerId)
      }
      detachDocument()
      cancelFusionHoverRaf()
      removeGhost()
    }
  }, [vial.id, labDrag])

  const ctxPortal =
    ctxMenu &&
    createPortal(
      <div
        ref={menuRef}
        className="lab-invRecipeContextMenu"
        role="menu"
        aria-label={LAB_MESSAGES.inventory.viewRecipesContextMenuLabel}
        style={{ left: ctxMenu.left, top: ctxMenu.top }}
      >
        <button
          type="button"
          role="menuitem"
          className="lab-invRecipeContextMenu-item"
          onClick={() => {
            requestOpenRecipesBookToVial(vial.id)
            setCtxMenu(null)
          }}
        >
          <List size={14} strokeWidth={2} aria-hidden className="shrink-0" />
          <span>{LAB_MESSAGES.inventory.viewRecipesMenuItem}</span>
        </button>
      </div>,
      document.body,
    )

  return (
    <>
      <div
        ref={wrapRef}
        className="lab-invItemWrap touch-none"
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const wrap = wrapRef.current
          if (!wrap) return
          setCtxMenu(computeRecipeContextMenuPosition(wrap))
        }}
      >
        <VialChip vial={vial} inventory />
      </div>
      {ctxPortal}
    </>
  )
}
