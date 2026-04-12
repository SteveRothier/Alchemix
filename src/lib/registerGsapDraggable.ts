import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'

let registered = false

/** À appeler avant tout Draggable.create (navigateur uniquement). */
export function registerGsapDraggable(): void {
  if (registered || typeof window === 'undefined') return
  gsap.registerPlugin(Draggable)
  /* Évite l’arrondi entier sur x/y (mouvement parfois « grille »), pour Draggable et les tweens. */
  gsap.defaults({ autoRound: false })
  registered = true
}

export { Draggable, gsap }
