/**
 * Boîte de placement du canvas (padding/content), alignée sur les % `left` / `top`
 * des fioles absolues — pas la border box seule.
 */
export type CanvasPlacementBox = {
  left: number
  top: number
  width: number
  height: number
}

export function getCanvasPlacementBox(canvasEl: HTMLElement): CanvasPlacementBox {
  const r = canvasEl.getBoundingClientRect()
  return {
    left: r.left + canvasEl.clientLeft,
    top: r.top + canvasEl.clientTop,
    width: canvasEl.clientWidth,
    height: canvasEl.clientHeight,
  }
}

export function clientPointToCanvasPercent(
  canvasEl: HTMLElement,
  clientX: number,
  clientY: number,
): { xPct: number; yPct: number } {
  const placement = getCanvasPlacementBox(canvasEl)
  const cx = clientX - placement.left
  const cy = clientY - placement.top
  const xPct = (cx / placement.width) * 100
  const yPct = (cy / placement.height) * 100
  return {
    xPct: Math.max(4, Math.min(96, xPct)),
    yPct: Math.max(4, Math.min(96, yPct)),
  }
}

/** Centre visuel de la carte (.lab-chipInventory) → pourcentages canvas. */
export function chipCenterToCanvasPercent(
  canvasEl: HTMLElement,
  chipEl: Element | null,
): { xPct: number; yPct: number } | null {
  if (!(chipEl instanceof HTMLElement)) return null
  const r = chipEl.getBoundingClientRect()
  if (r.width < 1 || r.height < 1) return null
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  return clientPointToCanvasPercent(canvasEl, cx, cy)
}

/** Centre de la carte au relâchement : pointeur + offset de prise (doc Draggable : pointerX / pointerY). */
export function grabCenterClient(
  drag: { pointerX: number; pointerY: number },
  grabOffset: { dx: number; dy: number } | null,
  chipEl: HTMLElement,
): { cx: number; cy: number } {
  if (grabOffset) {
    return {
      cx: drag.pointerX + grabOffset.dx,
      cy: drag.pointerY + grabOffset.dy,
    }
  }
  const r = chipEl.getBoundingClientRect()
  return {
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
  }
}

export function clientPointInCanvasPlacement(
  canvasEl: HTMLElement,
  clientX: number,
  clientY: number,
): boolean {
  const p = getCanvasPlacementBox(canvasEl)
  return (
    clientX >= p.left &&
    clientX <= p.left + p.width &&
    clientY >= p.top &&
    clientY <= p.top + p.height
  )
}
