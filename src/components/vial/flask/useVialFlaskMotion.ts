import { useEffect, type RefObject } from 'react'
import { gsap } from '../../../lib/gsap'
import type { Vial } from '../../../types'

/** GSAP pour `spark` et `ember` (particules) ; respecte `prefers-reduced-motion`. */
export function useVialFlaskMotion(
  svgRef: RefObject<SVGSVGElement | null>,
  vial: Vial,
) {
  useEffect(() => {
    const tex = vial.liquid.texture
    if (tex !== 'spark' && tex !== 'ember') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const root = svgRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      if (tex === 'spark') {
        const nodes = root.querySelectorAll<SVGCircleElement>('[data-spark]')
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
      }
      if (tex === 'ember') {
        const nodes = root.querySelectorAll<SVGCircleElement>('[data-ember]')
        nodes.forEach((node, i) => {
          gsap.to(node, {
            opacity: 0.38,
            scale: 0.82,
            duration: 0.72 + (i % 5) * 0.1,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: i * 0.11,
            transformOrigin: '50% 50%',
          })
        })
      }
    }, root)

    return () => ctx.revert()
  }, [svgRef, vial.id, vial.liquid.texture])
}
