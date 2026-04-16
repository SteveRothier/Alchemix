import type { RefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LAB_MESSAGES } from '../lab/labMessages'
import type { Vial } from '../../types'
import { CanvasVialItem } from './CanvasVialItem'
import { LabConstellationBackground } from './LabConstellationBackground'
import { rectsIntersect } from './labGeometry'
import { useLabSelection } from './LabSelectionContext'
import type { LabPlacedVial } from './labTypes'

type MarqueeBox = { x1: number; y1: number; x2: number; y2: number }

type MarqueeHitTarget = {
  instanceId: string
  chip: HTMLElement
}

type LabCanvasProps = {
  placed: LabPlacedVial[]
  vialsById: Record<string, Vial>
  canvasRef: RefObject<HTMLDivElement | null>
  onRemovePlaced: (instanceId: string) => void
  onRemoveSelectedPlaced: () => void
  onDuplicatePlaced: (source: LabPlacedVial) => void
}

export function LabCanvas({
  placed,
  vialsById,
  canvasRef,
  onRemovePlaced,
  onRemoveSelectedPlaced,
  onDuplicatePlaced,
}: LabCanvasProps) {
  const labSelection = useLabSelection()
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null)
  const marqueeActiveRef = useRef(false)
  const marqueeStartRef = useRef({ x: 0, y: 0 })
  const marqueeTargetsRef = useRef<MarqueeHitTarget[]>([])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      marqueeTargetsRef.current = []
      return
    }
    const next: MarqueeHitTarget[] = []
    for (const host of canvas.querySelectorAll('[data-lab-canvas-vial]')) {
      if (!(host instanceof HTMLElement)) continue
      const id = host.getAttribute('data-lab-canvas-vial')
      if (!id) continue
      const chip = host.querySelector('.lab-chipInventory')
      if (!(chip instanceof HTMLElement)) continue
      next.push({ instanceId: id, chip })
    }
    marqueeTargetsRef.current = next
  }, [placed, canvasRef])

  const collectIdsIntersectingMarquee = useCallback((box: MarqueeBox): string[] => {
    const left = Math.min(box.x1, box.x2)
    const top = Math.min(box.y1, box.y2)
    const w = Math.abs(box.x2 - box.x1)
    const h = Math.abs(box.y2 - box.y1)
    if (w < 1 || h < 1) return []
    const mr = new DOMRect(left, top, w, h)
    const out: string[] = []
    for (const { instanceId, chip } of marqueeTargetsRef.current) {
      if (rectsIntersect(mr, chip.getBoundingClientRect())) out.push(instanceId)
    }
    return out
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const sel = labSelection
    if (!canvas || !sel) return

    const onPointerDownCapture = (e: PointerEvent) => {
      if (e.button !== 0) return
      const t = e.target
      if (!(t instanceof Element)) return
      if (t.closest('[data-lab-canvas-vial]')) return
      if (t.closest('a[href]')) return
      if (t.closest('button')) return
      e.preventDefault()
      marqueeStartRef.current = { x: e.clientX, y: e.clientY }
      marqueeActiveRef.current = true
      setMarquee({
        x1: e.clientX,
        y1: e.clientY,
        x2: e.clientX,
        y2: e.clientY,
      })
      canvas.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!marqueeActiveRef.current) return
      const s = marqueeStartRef.current
      setMarquee({
        x1: s.x,
        y1: s.y,
        x2: e.clientX,
        y2: e.clientY,
      })
    }

    const endMarquee = (e: PointerEvent) => {
      if (!marqueeActiveRef.current) return
      marqueeActiveRef.current = false
      setMarquee(null)
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* capture déjà relâché */
      }

      const s = marqueeStartRef.current
      const w = Math.abs(e.clientX - s.x)
      const h = Math.abs(e.clientY - s.y)
      if (w < 4 && h < 4) {
        if (!e.shiftKey) sel.clearSelection()
        return
      }

      const ids = collectIdsIntersectingMarquee({
        x1: s.x,
        y1: s.y,
        x2: e.clientX,
        y2: e.clientY,
      })
      sel.setMarqueeSelection(ids, e.shiftKey ? 'add' : 'replace')
    }

    canvas.addEventListener('pointerdown', onPointerDownCapture, { capture: true })
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', endMarquee)
    canvas.addEventListener('pointercancel', endMarquee)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDownCapture, {
        capture: true,
      })
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endMarquee)
      canvas.removeEventListener('pointercancel', endMarquee)
    }
  }, [canvasRef, labSelection, collectIdsIntersectingMarquee])

  const marqueeStyle =
    marquee === null
      ? null
      : (() => {
          const left = Math.min(marquee.x1, marquee.x2)
          const top = Math.min(marquee.y1, marquee.y2)
          const w = Math.abs(marquee.x2 - marquee.x1)
          const h = Math.abs(marquee.y2 - marquee.y1)
          return {
            position: 'fixed' as const,
            left,
            top,
            width: w,
            height: h,
            zIndex: 10040,
            pointerEvents: 'none' as const,
            boxSizing: 'border-box' as const,
          }
        })()

  return (
    <div className="relative h-full min-h-0 min-w-0">
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex min-w-0 items-start justify-between gap-2 px-[0.85rem] pt-[0.65rem]">
        <h2 className="lab-canvasTitle pointer-events-auto">
          {LAB_MESSAGES.canvas.laboratoryTitle}
        </h2>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <Link
            className="lab-recipesBtn"
            to="/recipes"
            title={LAB_MESSAGES.canvas.recipesLinkTitle}
          >
            {LAB_MESSAGES.canvas.recipesLinkLabel}
          </Link>
        </div>
      </div>
      {marqueeStyle ? <div className="lab-marqueeRect" style={marqueeStyle} /> : null}
      <div
        ref={canvasRef}
        className="lab-canvas lab-canvas--fill"
        aria-label={LAB_MESSAGES.canvas.placementAreaAriaLabel}
      >
        <LabConstellationBackground />
        {placed.map((p, i) => {
          const v = vialsById[p.vialId]
          if (!v) return null
          return (
            <CanvasVialItem
              key={p.instanceId}
              placed={p}
              vial={v}
              zIndex={10 + i}
              isSelected={labSelection?.isSelected(p.instanceId) ?? false}
              onRemove={onRemovePlaced}
              onRemoveSelectedPlaced={onRemoveSelectedPlaced}
              onDuplicate={onDuplicatePlaced}
            />
          )
        })}
      </div>
    </div>
  )
}
