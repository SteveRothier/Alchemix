import type { ClientRect } from '@dnd-kit/core'

/** Centre du rectangle draggable → pourcentages dans le canvas (avec marges). */
export function clientRectToCanvasPercent(
  translated: ClientRect,
  canvasRect: DOMRect,
): { xPct: number; yPct: number } {
  const cx = translated.left + translated.width / 2 - canvasRect.left
  const cy = translated.top + translated.height / 2 - canvasRect.top
  const xPct = (cx / canvasRect.width) * 100
  const yPct = (cy / canvasRect.height) * 100
  return {
    xPct: Math.max(4, Math.min(96, xPct)),
    yPct: Math.max(4, Math.min(96, yPct)),
  }
}
