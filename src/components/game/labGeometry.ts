/**
 * Boîte de placement du canvas en coordonnées viewport (getBoundingClientRect),
 * même repère que les cartes / le fantôme au même instant.
 * Mélanger clientWidth (souvent arrondi) avec des centres mesurés en subpixel
 * provoquait un léger décalage au dépôt depuis l’inventaire.
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
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
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

/** Chevauchement géométrique simple (boîtes client), ex. rectangle de sélection vs carte. */
export function rectsIntersect(
  a: DOMRectReadOnly,
  b: DOMRectReadOnly,
): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  )
}

/** Attribut sur `<html>` : la carte draguée (inventaire ou plateau) chevauche la fiole d’offrande. */
export const LAB_OFFER_DRAG_HOVER_ATTR = 'data-lab-offer-drag-hover' as const

export function updateLabOfferDragHoverFromRect(dragRect: DOMRectReadOnly): void {
  const fab = document.querySelector(
    '.alchemix-lab .lab-offerFab',
  ) as HTMLElement | null
  const root = document.documentElement
  if (!fab) {
    root.removeAttribute(LAB_OFFER_DRAG_HOVER_ATTR)
    return
  }
  if (rectsIntersect(dragRect, fab.getBoundingClientRect())) {
    root.setAttribute(LAB_OFFER_DRAG_HOVER_ATTR, '')
  } else {
    root.removeAttribute(LAB_OFFER_DRAG_HOVER_ATTR)
  }
}

export function clearLabOfferDragHover(): void {
  document.documentElement.removeAttribute(LAB_OFFER_DRAG_HOVER_ATTR)
}

/** Limites alignées sur `clientPointToCanvasPercent`. */
export function clampLabPlacementPercent(xPct: number, yPct: number) {
  return {
    xPct: Math.max(4, Math.min(96, xPct)),
    yPct: Math.max(4, Math.min(96, yPct)),
  }
}

/**
 * Au moins `thresholdPct` % de la surface de l’un ou l’autre rectangle doit chevaucher.
 */
export function rectsHitTestAreaOverlap(
  ra: DOMRectReadOnly,
  rb: DOMRectReadOnly,
  thresholdPct: number = 38,
): boolean {
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

/**
 * Équivalent pratique de Draggable.hitTest(a, b, "38%") pour tout DOM
 * (clone inventaire sous body, pointer-events: none, etc.).
 */
export function elementsHitTestAreaOverlap(
  a: Element,
  b: Element,
  thresholdPct: number = 38,
): boolean {
  if (!(a instanceof HTMLElement) || !(b instanceof HTMLElement)) return false
  const ra = a.getBoundingClientRect()
  const rb = b.getBoundingClientRect()
  return rectsHitTestAreaOverlap(ra, rb, thresholdPct)
}

/**
 * Survol fusion + détection au lâcher : compare les **cartes** (.lab-chipInventory),
 * pas le curseur ni seul le conteneur drop — chevauchement d’aire entre les deux boîtes.
 */
export const FUSION_CARDS_OVERLAP_PCT = 10

/** Hit-test fusion sans `querySelector` sur l’hôte (liste pré-collectée au press). */
export function fusionDragRectOverlapsTargetChip(
  dragChipRect: DOMRectReadOnly,
  targetChip: HTMLElement,
  thresholdPct: number = FUSION_CARDS_OVERLAP_PCT,
): boolean {
  return rectsHitTestAreaOverlap(
    dragChipRect,
    targetChip.getBoundingClientRect(),
    thresholdPct,
  )
}

export type LabFusionDropTarget = {
  instanceId: string
  host: HTMLElement
  chip: HTMLElement
}

/** Une passe `querySelectorAll` + `.lab-chipInventory` par cible, à appeler au début du drag. */
export function collectLabFusionDropTargets(
  canvasRoot: HTMLElement,
): LabFusionDropTarget[] {
  const out: LabFusionDropTarget[] = []
  for (const node of canvasRoot.querySelectorAll('[data-lab-drop-target]')) {
    if (!(node instanceof HTMLElement)) continue
    const id = node.getAttribute('data-lab-drop-target')
    if (!id) continue
    const chip = node.querySelector('.lab-chipInventory')
    if (chip instanceof HTMLElement) out.push({ instanceId: id, host: node, chip })
  }
  return out
}

/** Une seule lecture du rect de la carte draguée (boucle hit-test plus légère à chaque frame). */
export function fusionCardsOverlapFromDragRect(
  dragChipRect: DOMRectReadOnly,
  dropTargetHost: HTMLElement,
  thresholdPct: number = FUSION_CARDS_OVERLAP_PCT,
): boolean {
  const targetChip = dropTargetHost.querySelector('.lab-chipInventory')
  if (!(targetChip instanceof HTMLElement)) return false
  return fusionDragRectOverlapsTargetChip(
    dragChipRect,
    targetChip,
    thresholdPct,
  )
}

export function fusionCardsOverlap(
  dragChip: HTMLElement,
  dropTargetHost: HTMLElement,
  thresholdPct: number = FUSION_CARDS_OVERLAP_PCT,
): boolean {
  return fusionCardsOverlapFromDragRect(
    dragChip.getBoundingClientRect(),
    dropTargetHost,
    thresholdPct,
  )
}
