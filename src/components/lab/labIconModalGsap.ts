import { gsap } from 'gsap'

/** Flou max du voile (px) — montée / descente animée par GSAP (modales contrôles, recettes, etc.). */
export const LAB_ICON_MODAL_DIM_BLUR_PX = 1.5
export const LAB_ICON_MODAL_DIM_BLUR_MAX = `${LAB_ICON_MODAL_DIM_BLUR_PX}px`

export function iconToDialogDelta(
  fab: HTMLElement,
  dialog: HTMLElement,
): { dx: number; dy: number } {
  const ir = fab.getBoundingClientRect()
  const dr = dialog.getBoundingClientRect()
  const ix = ir.left + ir.width / 2
  const iy = ir.top + ir.height / 2
  const cx = dr.left + dr.width / 2
  const cy = dr.top + dr.height / 2
  return { dx: ix - cx, dy: iy - cy }
}

/** Ouverture depuis le FAB (même timing que la modale Controls). */
export function playLabIconModalOpen(
  dim: HTMLElement,
  dialog: HTMLElement,
  fab: HTMLElement,
  onComplete: () => void,
) {
  const { dx, dy } = iconToDialogDelta(fab, dialog)
  gsap.killTweensOf([dim, dialog])
  gsap.set(dim, {
    opacity: 0,
    '--lab-controls-dim-blur': '0px',
  })
  gsap.set(dialog, {
    x: dx,
    y: dy,
    scale: 0.12,
    opacity: 0,
    transformOrigin: '50% 50%',
  })
  const tl = gsap.timeline({ onComplete })
  tl.to(
    dim,
    {
      opacity: 1,
      '--lab-controls-dim-blur': LAB_ICON_MODAL_DIM_BLUR_MAX,
      duration: 0.4,
      ease: 'power1.out',
    },
    0,
  )
  tl.to(
    dialog,
    {
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      duration: 0.42,
      ease: 'power2.out',
    },
    0,
  )
  return tl
}

/** Fermeture vers le FAB. */
export function playLabIconModalClose(
  dim: HTMLElement,
  dialog: HTMLElement,
  fab: HTMLElement,
  onComplete: () => void,
) {
  const { dx, dy } = iconToDialogDelta(fab, dialog)
  gsap.killTweensOf([dim, dialog])
  const tl = gsap.timeline({ onComplete })
  tl.to(
    dialog,
    {
      x: dx,
      y: dy,
      scale: 0.12,
      opacity: 0,
      duration: 0.32,
      ease: 'power2.in',
    },
    0,
  )
  tl.to(
    dim,
    {
      opacity: 0,
      '--lab-controls-dim-blur': '0px',
      duration: 0.32,
      ease: 'power1.in',
    },
    0.04,
  )
  return tl
}
