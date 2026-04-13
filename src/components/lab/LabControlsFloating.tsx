import { gsap } from 'gsap'
import { Keyboard, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

const ROWS: { keys: string; detail: string }[] = [
  {
    keys: 'Left click',
    detail: 'Select item',
  },
  {
    keys: 'Right click',
    detail: 'Delete item',
  },
  {
    keys: 'Double click',
    detail: 'Duplicate item',
  },
  {
    keys: 'Ctrl+Z',
    detail: 'Undo',
  },
  {
    keys: 'Ctrl+Y',
    detail: 'Redo',
  },
]

/** Flou max du voile (px) — réduit vs avant ; montée / descente animée par GSAP. */
const DIM_BLUR_PX = 1.5
const DIM_BLUR_MAX = `${DIM_BLUR_PX}px`

function iconToDialogDelta(
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

export function LabControlsFloating() {
  const [open, setOpen] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const dimRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const closingRef = useRef(false)
  const openRef = useRef(open)
  openRef.current = open

  const titleId = useId()

  const runCloseAnimation = useCallback((onDone: () => void) => {
    const dim = dimRef.current
    const dialog = dialogRef.current
    const fab = fabRef.current
    if (!dim || !dialog || !fab) {
      onDone()
      return
    }
    const { dx, dy } = iconToDialogDelta(fab, dialog)
    gsap.killTweensOf([dim, dialog])
    const tl = gsap.timeline({ onComplete: onDone })
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
  }, [])

  const requestClose = useCallback(() => {
    if (!openRef.current || closingRef.current) return
    closingRef.current = true
    runCloseAnimation(() => {
      setOpen(false)
      closingRef.current = false
    })
  }, [runCloseAnimation])

  useLayoutEffect(() => {
    if (!open) return
    const dim = dimRef.current
    const dialog = dialogRef.current
    const fab = fabRef.current
    if (!dim || !dialog || !fab) return

    /**
     * Pas de requestAnimationFrame ici : le premier paint verrait la modale
     * déjà centrée avant le gsap.set. useLayoutEffect s’exécute après le layout
     * mais avant le paint : mesure + état initial + timeline restent synchrones.
     */
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
    const tl = gsap.timeline({
      onComplete: () => {
        closeBtnRef.current?.focus()
      },
    })
    tl.to(
      dim,
      {
        opacity: 1,
        '--lab-controls-dim-blur': DIM_BLUR_MAX,
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

    return () => {
      tl.kill()
      gsap.killTweensOf([dim, dialog])
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, requestClose])

  useEffect(() => {
    return () => {
      const d = dimRef.current
      const dlg = dialogRef.current
      if (d) gsap.killTweensOf(d)
      if (dlg) gsap.killTweensOf(dlg)
    }
  }, [])

  const modal =
    open &&
    createPortal(
      <>
        <div
          ref={dimRef}
          className="lab-controls-dim"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestClose()
          }}
        />
        <div className="lab-controls-dialog-layer">
          <div
            ref={dialogRef}
            className="lab-controls-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="lab-controls-header">
              <div>
                <h2 id={titleId} className="lab-controls-title">
                  Controls
                </h2>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                className="lab-controls-close"
                onClick={requestClose}
                aria-label="Close controls"
              >
                <X size={16} strokeWidth={2} aria-hidden />
              </button>
            </header>
            <ul className="lab-controls-list">
              {ROWS.map((row, i) => (
                <li key={`${row.keys}-${i}`} className="lab-controls-row">
                  <span className="lab-controls-keys">{row.keys}</span>
                  <span className="lab-controls-detail">{row.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </>,
      document.body,
    )

  return (
    <>
      {modal}
      <div className="pointer-events-none absolute bottom-0 right-0 z-40 p-2 max-[560px]:p-1.5">
        <button
          ref={fabRef}
          type="button"
          className="lab-controls-fab pointer-events-auto"
          onClick={() => {
            if (openRef.current) requestClose()
            else setOpen(true)
          }}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Laboratory controls"
          aria-label="Show laboratory controls"
        >
          <Keyboard size={22} strokeWidth={2} aria-hidden className="shrink-0" />
        </button>
      </div>
    </>
  )
}
