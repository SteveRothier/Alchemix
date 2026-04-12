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

/**
 * Équivalent pratique de Draggable.hitTest(a, b, "38%") pour tout DOM
 * (clone inventaire sous body, pointer-events: none, etc.) : au moins
 * `thresholdPct` % de la surface de l’un ou l’autre rectangle doit chevaucher.
 */
export function elementsHitTestAreaOverlap(
  a: Element,
  b: Element,
  thresholdPct: number = 38,
): boolean {
  if (!(a instanceof HTMLElement) || !(b instanceof HTMLElement)) return false
  const ra = a.getBoundingClientRect()
  const rb = b.getBoundingClientRect()
  const x1 = Math.max(ra.left, rb.left)
  const y1 = Math.max(ra.top, rb.top)
  const x2 = Math.min(ra.right, rb.right)
  const y2 = Math.min(ra.bottom, rb.bottom)
  const iw = Math.max(0, x2 - x1)
  const ih = Math.max(0, y2 - y1)
  const inter = iw * ih
  const areaA = ra.width * ra.height
  const areaB = rb.width * rb.height
  if (areaA <= 0 || areaB <= 0) return false
  const t = thresholdPct / 100
  return inter / areaA >= t || inter / areaB >= t
}

/** Feedback hover fusion : centre de la carte draguée dans la boîte de la cible. */
export function chipCenterOverDropTarget(
  dragChip: HTMLElement,
  dropTarget: HTMLElement,
): boolean {
  const cr = dragChip.getBoundingClientRect()
  const tr = dropTarget.getBoundingClientRect()
  if (cr.width < 1 || cr.height < 1) return false
  const cx = cr.left + cr.width / 2
  const cy = cr.top + cr.height / 2
  return cx >= tr.left && cx <= tr.right && cy >= tr.top && cy <= tr.bottom
}
