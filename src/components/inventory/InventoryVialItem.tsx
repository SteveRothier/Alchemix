import { useEffect, useRef } from 'react'
import { remapSvgIdsInClonedSubtree } from '../../lib/remapSvgIdsForDomClone'
import type { Vial } from '../../types'
import { useLabDrag, type LabDragContextValue } from '../game/LabDragContext'
import { VialChip } from '../vial/VialChip'

const MIN_MOVE_PX = 6

type InventoryVialItemProps = {
  vial: Vial
}

/**
 * Drag inventaire : clone en position fixed (la carte liste reste en place),
 * Pointer Events + left/top, sans GSAP.
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

    const removeGhost = () => {
      if (ghostEl?.isConnected) ghostEl.remove()
      ghostEl = null
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
      const labEl = document.querySelector('.alchemix-lab')
      if (!(labEl instanceof HTMLElement)) return
      const lab = labEl.getBoundingClientRect()
      const br = g.getBoundingClientRect()
      const w = br.width
      const h = br.height
      let left = clientX - grabDx
      let top = clientY - grabDy
      left = Math.min(Math.max(lab.left, left), lab.right - w)
      top = Math.min(Math.max(lab.top, top), lab.bottom - h)
      g.style.left = `${left}px`
      g.style.top = `${top}px`
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerId !== activePointerId) return

      if (!dragActive) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < MIN_MOVE_PX)
          return
        dragActive = true

        const r = el.getBoundingClientRect()
        ghostEl = el.cloneNode(true) as HTMLDivElement
        ghostEl.classList.add('lab-invDragGhost')
        ghostEl.setAttribute('aria-hidden', 'true')
        ghostEl.style.position = 'fixed'
        ghostEl.style.left = `${r.left}px`
        ghostEl.style.top = `${r.top}px`
        ghostEl.style.width = `${r.width}px`
        ghostEl.style.height = `${r.height}px`
        ghostEl.style.margin = '0'
        ghostEl.style.boxSizing = 'border-box'
        ghostEl.style.zIndex = '10050'
        ghostEl.style.pointerEvents = 'none'

        remapSvgIdsInClonedSubtree(ghostEl)
        document.body.appendChild(ghostEl)

        const chip = ghostEl.querySelector('.lab-chipInventory')
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

      if (dragActive && ghostEl) {
        const moved =
          Math.hypot(e.clientX - startX, e.clientY - startY) >= 2
        if (moved) {
          ctx.completeInventoryDrag(vial.id, {
            target: ghostEl,
            pointerX: e.clientX,
            pointerY: e.clientY,
          })
        }
        removeGhost()
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
      removeGhost()
    }
  }, [vial.id, labDrag])

  return (
    <div ref={wrapRef} className="lab-invItemWrap touch-none">
      <VialChip vial={vial} inventory />
    </div>
  )
}
