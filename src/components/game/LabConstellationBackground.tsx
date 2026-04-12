import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type MousePosition = { x: number; y: number }

function useMousePosition(): MousePosition {
  const [mousePosition, setMousePosition] = useState<MousePosition>({
    x: 0,
    y: 0,
  })

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return mousePosition
}

function hexToRgb(hex: string): [number, number, number] {
  let normalized = hex.replace('#', '')
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char + char)
      .join('')
  }
  const hexInt = Number.parseInt(normalized, 16)
  return [(hexInt >> 16) & 255, (hexInt >> 8) & 255, hexInt & 255]
}

type Circle = {
  x: number
  y: number
  translateX: number
  translateY: number
  size: number
  alpha: number
  targetAlpha: number
  dx: number
  dy: number
  magnetism: number
}

type LabConstellationBackgroundProps = {
  /** Couleur des points (hex), lisible sur --lab-canvas-bg */
  color?: string
  quantity?: number
  staticity?: number
  ease?: number
  size?: number
  vx?: number
  vy?: number
  /** Distance max pour tracer un segment entre deux points */
  linkDistance?: number
}

/**
 * Fond animé type constellation (particules + liaisons), au-dessus du fond CSS du laboratoire.
 * Inspiré du pattern [shadcn constellation / particules](https://www.shadcn.io/background/constellation).
 */
export function LabConstellationBackground({
  color = '#1a2a22',
  quantity = 75,
  /** Plus haut = moins d’attraction souris (défaut un peu plus calme qu’avant). */
  staticity = 90,
  /** Plus haut = déplacement lié à la souris plus lent. */
  ease = 82,
  size = 0.4,
  vx = 0,
  vy = 0,
  linkDistance = 88,
}: LabConstellationBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const circlesRef = useRef<Circle[]>([])
  const mousePosition = useMousePosition()
  const mouseRef = useRef({ x: 0, y: 0 })
  const sizeRef = useRef({ w: 0, h: 0 })
  const rafRef = useRef<number>(0)
  const dprRef = useRef(1)
  const rgb = useMemo(() => hexToRgb(color), [color])

  const remapValue = (
    value: number,
    start1: number,
    end1: number,
    start2: number,
    end2: number,
  ): number => {
    const remapped = ((value - start1) * (end2 - start2)) / (end1 - start1) + start2
    return remapped > 0 ? remapped : 0
  }

  const circleParams = useCallback((): Circle => {
    const { w, h } = sizeRef.current
    const x = Math.floor(Math.random() * w)
    const y = Math.floor(Math.random() * h)
    const pSize = Math.floor(Math.random() * 2) + size
    const targetAlpha = Number.parseFloat((Math.random() * 0.45 + 0.08).toFixed(2))
    return {
      x,
      y,
      translateX: 0,
      translateY: 0,
      size: pSize,
      alpha: 0,
      targetAlpha,
      dx: (Math.random() - 0.5) * 0.048,
      dy: (Math.random() - 0.5) * 0.048,
      magnetism: 0.05 + Math.random() * 1.2,
    }
  }, [size])

  const drawCircle = useCallback((circle: Circle, update: boolean) => {
    const ctx = ctxRef.current
    if (!ctx) return
    const { x, y, translateX, translateY, size: s, alpha } = circle
    ctx.translate(translateX, translateY)
    ctx.beginPath()
    ctx.arc(x, y, s, 0, 2 * Math.PI)
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
    ctx.fill()
    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
    if (!update) circlesRef.current.push(circle)
  }, [rgb])

  const drawLinks = useCallback(
    (circles: Circle[]) => {
      const ctx = ctxRef.current
      if (!ctx || circles.length < 2) return
      const maxD = linkDistance
      const maxD2 = maxD * maxD
      for (let i = 0; i < circles.length; i++) {
        const a = circles[i]
        const ax = a.x + a.translateX
        const ay = a.y + a.translateY
        for (let j = i + 1; j < circles.length; j++) {
          const b = circles[j]
          const bx = b.x + b.translateX
          const by = b.y + b.translateY
          const dx = ax - bx
          const dy = ay - by
          const d2 = dx * dx + dy * dy
          if (d2 > maxD2) continue
          const d = Math.sqrt(d2)
          const t = 1 - d / maxD
          const lineAlpha = Math.min(a.alpha, b.alpha) * 0.35 * t
          if (lineAlpha < 0.02) continue
          ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${lineAlpha})`
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(bx, by)
          ctx.stroke()
        }
      }
    },
    [linkDistance, rgb],
  )

  const clear = useCallback(() => {
    const ctx = ctxRef.current
    const { w, h } = sizeRef.current
    if (!ctx || w < 1 || h < 1) return
    ctx.clearRect(0, 0, w, h)
  }, [])

  const initCanvas = useCallback(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return
    ctxRef.current = ctx
    circlesRef.current = []
    const w = Math.max(1, container.offsetWidth)
    const h = Math.max(1, container.offsetHeight)
    sizeRef.current = { w, h }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    dprRef.current = dpr
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    clear()
    for (let i = 0; i < quantity; i++) {
      drawCircle(circleParams(), false)
    }
  }, [circleParams, clear, drawCircle, quantity])

  const onMouseMove = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const { w, h } = sizeRef.current
    const x = mousePosition.x - rect.left - w / 2
    const y = mousePosition.y - rect.top - h / 2
    const inside =
      x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2
    if (inside) {
      mouseRef.current.x = x
      mouseRef.current.y = y
    }
  }, [mousePosition.x, mousePosition.y])

  useEffect(() => {
    onMouseMove()
  }, [onMouseMove])

  useEffect(() => {
    initCanvas()
    const ro = new ResizeObserver(() => initCanvas())
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', initCanvas)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', initCanvas)
    }
  }, [initCanvas])

  useEffect(() => {
    const animate = () => {
      const ctx = ctxRef.current
      const { w, h } = sizeRef.current
      if (!ctx || w < 1 || h < 1) {
        rafRef.current = requestAnimationFrame(animate)
        return
      }

      clear()
      const circles = circlesRef.current

      for (let i = circles.length - 1; i >= 0; i--) {
        const circle = circles[i]
        const edge = [
          circle.x + circle.translateX - circle.size,
          w - circle.x - circle.translateX - circle.size,
          circle.y + circle.translateY - circle.size,
          h - circle.y - circle.translateY - circle.size,
        ]
        const closestEdge = edge.reduce((a, b) => Math.min(a, b))
        const remapClosestEdge = Number.parseFloat(
          remapValue(closestEdge, 0, 20, 0, 1).toFixed(2),
        )
        if (remapClosestEdge > 1) {
          circle.alpha += 0.02
          if (circle.alpha > circle.targetAlpha) circle.alpha = circle.targetAlpha
        } else {
          circle.alpha = circle.targetAlpha * remapClosestEdge
        }
        circle.x += circle.dx + vx
        circle.y += circle.dy + vy
        circle.translateX +=
          (mouseRef.current.x / (staticity / circle.magnetism) - circle.translateX) /
          ease
        circle.translateY +=
          (mouseRef.current.y / (staticity / circle.magnetism) - circle.translateY) /
          ease

        if (
          circle.x < -circle.size ||
          circle.x > w + circle.size ||
          circle.y < -circle.size ||
          circle.y > h + circle.size
        ) {
          circles.splice(i, 1)
          drawCircle(circleParams(), false)
        }
      }

      drawLinks(circles)
      for (const c of circles) drawCircle(c, true)

      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [circleParams, clear, drawCircle, drawLinks, ease, staticity, vx, vy])

  return (
    <div ref={containerRef} className="lab-canvasConstellation" aria-hidden>
      <canvas ref={canvasRef} className="lab-canvasConstellation-canvas" />
    </div>
  )
}
