import { useEffect, useRef } from 'react'
import type { Vial } from '../../types'
import { useLabDrag, type LabDragContextValue } from '../game/LabDragContext'
import { VialChip } from '../vial/VialChip'

const MIN_MOVE_PX = 6

type InventoryVialItemProps = {
  vial: Vial
}

/**
 * Drag inventaire : Pointer Events + left/top en pixels (flottants), sans GSAP.
 * Évite l’effet « grille » des transforms / calques sur la colonne inventaire.
 */
export function InventoryVialItem({ vial }: InventoryVialItemProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const placeholderRef = useRef<HTMLDivElement | null>(null)
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

    const removePlaceholder = () => {
      const ph = placeholderRef.current
      if (ph?.isConnected) ph.remove()
      placeholderRef.current = null
    }

    const detachDocument = () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerEnd)
      document.removeEventListener('pointercancel', onPointerEnd)
    }

    const resetInlineStyles = () => {
      removePlaceholder()
      if (el.isConnected) el.removeAttribute('style')
      ctx.grabOffsetRef.current = null
    }

    function clampToLab(clientX: number, clientY: number) {
      const labEl = document.querySelector('.alchemix-lab')
      if (!(labEl instanceof HTMLElement)) return
      const lab = labEl.getBoundingClientRect()
      const br = el.getBoundingClientRect()
      const w = br.width
      const h = br.height
      let left = clientX - grabDx
      let top = clientY - grabDy
      left = Math.min(Math.max(lab.left, left), lab.right - w)
      top = Math.min(Math.max(lab.top, top), lab.bottom - h)
      el.style.left = `${left}px`
      el.style.top = `${top}px`
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerId !== activePointerId) return

      if (!dragActive) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < MIN_MOVE_PX) return
        dragActive = true
        const r = el.getBoundingClientRect()
        const ph = document.createElement('div')
        ph.className = 'lab-invDragPlaceholder'
        ph.style.flexShrink = '0'
        ph.style.width = `${r.width}px`
        ph.style.height = `${r.height}px`
        ph.style.boxSizing = 'border-box'
        ph.setAttribute('aria-hidden', 'true')
        el.parentElement?.insertBefore(ph, el)
        placeholderRef.current = ph

        el.style.position = 'fixed'
        el.style.left = `${r.left}px`
        el.style.top = `${r.top}px`
        el.style.width = `${r.width}px`
        el.style.margin = '0'
        el.style.boxSizing = 'border-box'
        el.style.zIndex = '10050'

        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }

        const chip = el.querySelector('.lab-chipInventory')
        if (chip instanceof HTMLElement) {
          const cr = chip.getBoundingClientRect()
          ctx.grabOffsetRef.current = {
            dx: cr.left + cr.width / 2 - e.clientX,
            dy: cr.top + cr.height / 2 - e.clientY,
          }
        } else {
          ctx.grabOffsetRef.current = null
        }
      }

      e.preventDefault()
      clampToLab(e.clientX, e.clientY)
    }

    function onPointerEnd(e: PointerEvent) {
      if (e.pointerId !== activePointerId) return
      detachDocument()
      activePointerId = null

      if (dragActive) {
        try {
          el.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        const moved =
          Math.hypot(e.clientX - startX, e.clientY - startY) >= 2
        if (moved) {
          ctx.completeInventoryDrag(vial.id, {
            target: el,
            pointerX: e.clientX,
            pointerY: e.clientY,
          })
        }
        resetInlineStyles()
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
      removePlaceholder()
      if (el.isConnected) el.removeAttribute('style')
      ctx.grabOffsetRef.current = null
    }
  }, [vial.id, labDrag])

  return (
    <div ref={wrapRef} className="lab-invItemWrap touch-none">
      <VialChip vial={vial} inventory />
    </div>
  )
}
