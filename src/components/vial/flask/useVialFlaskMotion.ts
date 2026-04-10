import { useEffect, type RefObject } from 'react'
import { gsap } from '../../../lib/gsap'
import type { Vial } from '../../../types'

/** GSAP uniquement pour la texture `spark` (particules) ; respecte `prefers-reduced-motion`. */
export function useVialFlaskMotion(
  svgRef: RefObject<SVGSVGElement | null>,
  vial: Vial,
) {
  useEffect(() => {
    if (vial.liquid.texture !== 'spark') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const root = svgRef.current
    if (!root) return

    const nodes = root.querySelectorAll<SVGCircleElement>('[data-spark]')
    if (nodes.length === 0) return

    const ctx = gsap.context(() => {
      nodes.forEach((node, i) => {
        gsap.to(node, {
          opacity: 0.2,
          duration: 0.65 + (i % 5) * 0.08,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: i * 0.12,
        })
      })
    }, root)

    return () => ctx.revert()
  }, [svgRef, vial.id, vial.liquid.texture])
}
