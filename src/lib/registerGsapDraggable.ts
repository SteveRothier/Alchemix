import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'

let registered = false

/** À appeler avant tout Draggable.create (navigateur uniquement). */
export function registerGsapDraggable(): void {
  if (registered || typeof window === 'undefined') return
  gsap.registerPlugin(Draggable)
  /* Sous-pixels + translation GPU : mouvement plus fluide qu’un arrondi entier. */
  gsap.defaults({ autoRound: false, force3D: true })
  registered = true
}

export { Draggable, gsap }
