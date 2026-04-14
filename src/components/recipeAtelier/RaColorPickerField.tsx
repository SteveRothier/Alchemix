import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

function normalizeHex6(raw: string, fallback: string): string {
  const t = raw.trim()
  return /^#(?:[0-9a-fA-F]{6})$/.test(t) ? t : fallback
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) =>
    Math.round(Math.min(255, Math.max(0, x)))
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`.toLowerCase()
}

function hexKey(raw: string): string | null {
  const t = raw.trim()
  return /^#(?:[0-9a-fA-F]{6})$/.test(t) ? t.toLowerCase() : null
}

function pointerToSv(
  clientX: number,
  clientY: number,
  pad: HTMLElement,
): { s: number; v: number } {
  const r = pad.getBoundingClientRect()
  const cs = getComputedStyle(pad)
  const bl = parseFloat(cs.borderLeftWidth) || 0
  const br = parseFloat(cs.borderRightWidth) || 0
  const bt = parseFloat(cs.borderTopWidth) || 0
  const bb = parseFloat(cs.borderBottomWidth) || 0
  const iw = Math.max(1, r.width - bl - br)
  const ih = Math.max(1, r.height - bt - bb)
  const x = clientX - r.left - bl
  const y = clientY - r.top - bt
  const s = Math.min(1, Math.max(0, x / iw))
  const v = Math.min(1, Math.max(0, 1 - y / ih))
  return { s, v }
}

function rgbToHsv(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; v: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    else if (max === gn) h = ((bn - rn) / d + 2) / 6
    else h = ((rn - gn) / d + 4) / 6
  }
  const s = max === 0 ? 0 : d / max
  const v = max
  return { h: h * 360, s, v }
}

function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v)
  return rgbToHex(r, g, b)
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hn = (((h % 360) + 360) % 360) / 60
  const c = v * s
  const x = c * (1 - Math.abs((hn % 2) - 1))
  const m = v - c
  let rp = 0
  let gp = 0
  let bp = 0
  if (hn < 1) {
    rp = c
    gp = x
  } else if (hn < 2) {
    rp = x
    gp = c
  } else if (hn < 3) {
    gp = c
    bp = x
  } else if (hn < 4) {
    gp = x
    bp = c
  } else if (hn < 5) {
    rp = x
    bp = c
  } else {
    rp = c
    bp = x
  }
  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  }
}

function svLayersCss(h: number): string {
  return `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))`
}

function setKnobPercent(knob: HTMLDivElement | null, s: number, v: number) {
  if (!knob) return
  knob.style.left = `${s * 100}%`
  knob.style.top = `${(1 - v) * 100}%`
}

export type RaColorPickerFieldProps = {
  id: string
  label: ReactNode
  value: string
  onChange: (next: string) => void
  fallback?: string
  hexPlaceholder?: string
  'aria-label'?: string
}

export function RaColorPickerField({
  id,
  label,
  value,
  onChange,
  fallback = '#ffffff',
  hexPlaceholder = '#ffffff',
  'aria-label': ariaLabel,
}: RaColorPickerFieldProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  )
  /** Remonte le slider teinte (non contrôlé) pour suivre une nouvelle couleur sans lag. */
  const [pickerSliderKey, setPickerSliderKey] = useState(0)
  const [hueSliderDefault, setHueSliderDefault] = useState(0)

  const anchorRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const svRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)

  const svHueAnchorRef = useRef(0)
  const lastEmittedHexRef = useRef<string | null>(null)
  const wasOpenRef = useRef(false)
  const svDraggingRef = useRef(false)
  const hueDraggingRef = useRef(false)

  /** Hex affiché en direct (pastille + champ) pendant le drag — sans attendre le parent. */
  const [previewHex, setPreviewHex] = useState<string | null>(null)
  const livePreviewRafRef = useRef<number | null>(null)

  const effective = normalizeHex6(value, fallback)
  const [hsv, setHsv] = useState(() => {
    const rgb = hexToRgb(effective)
    return rgb ? rgbToHsv(rgb.r, rgb.g, rgb.b) : { h: 0, s: 0, v: 1 }
  })

  const hsvRef = useRef(hsv)
  hsvRef.current = hsv

  const latestHsvRef = useRef(hsv)

  const flushParentHex = useCallback(() => {
    const p = latestHsvRef.current
    const hex = hsvToHex(p.h, p.s, p.v)
    lastEmittedHexRef.current = hex
    onChange(hex)
  }, [onChange])

  const scheduleLivePreview = useCallback(() => {
    if (livePreviewRafRef.current != null) return
    livePreviewRafRef.current = requestAnimationFrame(() => {
      livePreviewRafRef.current = null
      const p = latestHsvRef.current
      setPreviewHex(hsvToHex(p.h, p.s, p.v))
    })
  }, [])

  /** Quand le parent rattrape la prévisualisation, repasser sur `value`. */
  useEffect(() => {
    if (previewHex === null) return
    const pk = hexKey(previewHex)
    const vk = hexKey(value)
    if (pk && vk && pk === vk) setPreviewHex(null)
  }, [value, previewHex])

  useLayoutEffect(() => {
    if (!open) {
      if (livePreviewRafRef.current != null) {
        cancelAnimationFrame(livePreviewRafRef.current)
        livePreviewRafRef.current = null
      }
      setPreviewHex(null)
      lastEmittedHexRef.current = null
      wasOpenRef.current = false
      return
    }
    if (!wasOpenRef.current) {
      const hex = normalizeHex6(value, fallback).toLowerCase()
      const rgb = hexToRgb(hex)
      if (rgb) {
        const next = rgbToHsv(rgb.r, rgb.g, rgb.b)
        setHsv(next)
        svHueAnchorRef.current = next.h
        latestHsvRef.current = next
        setHueSliderDefault(Math.round(next.h))
        setPickerSliderKey((k) => k + 1)
      }
      lastEmittedHexRef.current = hex
    }
    wasOpenRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ouverture uniquement
  }, [open])

  useEffect(() => {
    if (!open) return
    if (svDraggingRef.current || hueDraggingRef.current) return
    const key = hexKey(value)
    if (!key) return
    if (key === lastEmittedHexRef.current) return
    const rgb = hexToRgb(key)
    if (rgb) {
      const next = rgbToHsv(rgb.r, rgb.g, rgb.b)
      setHsv(next)
      svHueAnchorRef.current = next.h
      latestHsvRef.current = next
      setHueSliderDefault(Math.round(next.h))
      setPickerSliderKey((k) => k + 1)
      if (layersRef.current) layersRef.current.style.background = svLayersCss(next.h)
      setKnobPercent(knobRef.current, next.s, next.v)
    }
    lastEmittedHexRef.current = key
  }, [value, open])

  const updatePos = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = Math.min(220, Math.max(200, r.width))
    let left = r.left
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w
    if (left < 8) left = 8
    setPos({ top: r.bottom + 4, left, width: w })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePos()
    const onScroll = () => updatePos()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t)) return
      if (popoverRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!open) return
    const endHueDrag = () => {
      if (!hueDraggingRef.current) return
      const p = latestHsvRef.current
      setHsv(p)
      flushParentHex()
      hueDraggingRef.current = false
    }
    window.addEventListener('pointerup', endHueDrag)
    window.addEventListener('pointercancel', endHueDrag)
    return () => {
      window.removeEventListener('pointerup', endHueDrag)
      window.removeEventListener('pointercancel', endHueDrag)
    }
  }, [open, flushParentHex])

  /** Glisser SV : DOM seulement (pas de setState → pas de re-render du formulaire). */
  const paintSvFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const pad = svRef.current
      if (!pad) return
      const { s, v } = pointerToSv(clientX, clientY, pad)
      const h = svHueAnchorRef.current
      latestHsvRef.current = { h, s, v }
      setKnobPercent(knobRef.current, s, v)
      scheduleLivePreview()
    },
    [scheduleLivePreview],
  )

  const onSvPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    svDraggingRef.current = true
    svHueAnchorRef.current = hsvRef.current.h
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    paintSvFromPointer(e.clientX, e.clientY)
  }

  const onSvPointerMove = (e: React.PointerEvent) => {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return
    paintSvFromPointer(e.clientX, e.clientY)
  }

  const finishSvPointer = useCallback(
    (e: React.PointerEvent) => {
      const el = e.currentTarget as HTMLElement
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      const pad = svRef.current
      if (pad) {
        const { s, v } = pointerToSv(e.clientX, e.clientY, pad)
        const final = { h: svHueAnchorRef.current, s, v }
        latestHsvRef.current = final
        setKnobPercent(knobRef.current, s, v)
        setHsv(final)
      } else {
        setHsv(latestHsvRef.current)
      }
      flushParentHex()
      svDraggingRef.current = false
    },
    [flushParentHex],
  )

  const popover =
    open &&
    pos &&
    createPortal(
      <div
        ref={popoverRef}
        className="ra-colorPopover"
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: pos.width,
          zIndex: 12_000,
        }}
        role="dialog"
        aria-label={ariaLabel ?? 'Color picker'}
      >
        <div
          ref={svRef}
          className="ra-colorPopover-sv"
          onPointerDown={onSvPointerDown}
          onPointerMove={onSvPointerMove}
          onPointerUp={finishSvPointer}
          onPointerCancel={finishSvPointer}
        >
          <div
            ref={layersRef}
            className="ra-colorPopover-svLayers"
            style={{ background: svLayersCss(hsv.h) }}
          />
          <div
            ref={knobRef}
            className="ra-colorPopover-knob"
            style={{
              left: `${hsv.s * 100}%`,
              top: `${(1 - hsv.v) * 100}%`,
            }}
          />
        </div>
        <label className="ra-colorPopover-hueLabel">
          <span className="ra-sr-only">Hue</span>
          <input
            key={pickerSliderKey}
            type="range"
            className="ra-colorPopover-hue"
            min={0}
            max={360}
            step={1}
            defaultValue={hueSliderDefault}
            onPointerDown={() => {
              hueDraggingRef.current = true
            }}
            onInput={(e) => {
              const nh = Number((e.target as HTMLInputElement).value)
              const prev = latestHsvRef.current
              const next = { ...prev, h: nh }
              latestHsvRef.current = next
              svHueAnchorRef.current = nh
              const layers = layersRef.current
              if (layers) layers.style.background = svLayersCss(nh)
              scheduleLivePreview()
            }}
          />
        </label>
      </div>,
      document.body,
    )

  const swatchBg =
    previewHex !== null ? normalizeHex6(previewHex, fallback) : effective
  const hexInputValue = previewHex !== null ? previewHex : value

  return (
    <div className="ra-formGroup ra-formGroup--fieldRow" ref={anchorRef}>
      <label htmlFor={id}>{label}</label>
      <div className="ra-colorCompactRow">
        <button
          type="button"
          className="ra-colorSwatchBtn"
          style={{ background: swatchBg }}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((o) => !o)}
          aria-label={ariaLabel ?? 'Open color picker'}
        />
        <input
          id={id}
          type="text"
          className="ra-input ra-colorHexInput"
          value={hexInputValue}
          onChange={(e) => {
            setPreviewHex(null)
            onChange(e.target.value)
          }}
          placeholder={hexPlaceholder}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      {popover}
    </div>
  )
}
