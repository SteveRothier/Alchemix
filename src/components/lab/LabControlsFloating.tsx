import { gsap } from 'gsap'
import { Globe, Keyboard, Trash2, X } from 'lucide-react'
import {
  type ReactNode,
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

export type LabControlsFloatingProps = {
  onClearCanvas: () => void
  canClearCanvas: boolean
  leadingFabs?: ReactNode
}

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

/** Ouverture depuis le FAB (même timing que la modale Controls). */
function playIconModalOpen(
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
  return tl
}

/** Fermeture vers le FAB. */
function playIconModalClose(
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

export function LabControlsFloating({
  onClearCanvas,
  canClearCanvas,
  leadingFabs,
}: LabControlsFloatingProps) {
  const [open, setOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const langFabRef = useRef<HTMLButtonElement>(null)
  const dimRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const closingRef = useRef(false)
  const openRef = useRef(open)
  openRef.current = open

  const clearDimRef = useRef<HTMLDivElement>(null)
  const clearDialogRef = useRef<HTMLDivElement>(null)
  const clearFabRef = useRef<HTMLButtonElement>(null)
  const clearYesRef = useRef<HTMLButtonElement>(null)
  const clearClosingRef = useRef(false)
  const clearConfirmOpenRef = useRef(clearConfirmOpen)
  clearConfirmOpenRef.current = clearConfirmOpen

  const langDimRef = useRef<HTMLDivElement>(null)
  const langDialogRef = useRef<HTMLDivElement>(null)
  const langClosingRef = useRef(false)
  const langMenuOpenRef = useRef(langMenuOpen)
  langMenuOpenRef.current = langMenuOpen

  const titleId = useId()
  const clearQuestionId = useId()

  const runCloseAnimation = useCallback((onDone: () => void) => {
    const dim = dimRef.current
    const dialog = dialogRef.current
    const fab = fabRef.current
    if (!dim || !dialog || !fab) {
      onDone()
      return
    }
    playIconModalClose(dim, dialog, fab, onDone)
  }, [])

  const requestClose = useCallback(() => {
    if (!openRef.current || closingRef.current) return
    closingRef.current = true
    runCloseAnimation(() => {
      setOpen(false)
      closingRef.current = false
    })
  }, [runCloseAnimation])

  const requestCloseClear = useCallback(() => {
    if (!clearConfirmOpenRef.current || clearClosingRef.current) return
    clearClosingRef.current = true
    const dim = clearDimRef.current
    const dlg = clearDialogRef.current
    const fab = clearFabRef.current
    if (!dim || !dlg || !fab) {
      setClearConfirmOpen(false)
      clearClosingRef.current = false
      return
    }
    playIconModalClose(dim, dlg, fab, () => {
      setClearConfirmOpen(false)
      clearClosingRef.current = false
    })
  }, [])

  const confirmClearCanvas = useCallback(() => {
    if (clearClosingRef.current) return
    onClearCanvas()
    requestCloseClear()
  }, [onClearCanvas, requestCloseClear])

  const requestCloseLang = useCallback(() => {
    if (!langMenuOpenRef.current || langClosingRef.current) return
    langClosingRef.current = true
    const dim = langDimRef.current
    const dlg = langDialogRef.current
    const fab = langFabRef.current
    if (!dim || !dlg || !fab) {
      setLangMenuOpen(false)
      langClosingRef.current = false
      return
    }
    playIconModalClose(dim, dlg, fab, () => {
      setLangMenuOpen(false)
      langClosingRef.current = false
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const dim = dimRef.current
    const dialog = dialogRef.current
    const fab = fabRef.current
    if (!dim || !dialog || !fab) return

    const tl = playIconModalOpen(dim, dialog, fab, () => {
      closeBtnRef.current?.focus()
    })

    return () => {
      tl.kill()
      gsap.killTweensOf([dim, dialog])
    }
  }, [open])

  useLayoutEffect(() => {
    if (!clearConfirmOpen) return
    const dim = clearDimRef.current
    const dlg = clearDialogRef.current
    const fab = clearFabRef.current
    if (!dim || !dlg || !fab) return
    const tl = playIconModalOpen(dim, dlg, fab, () => {
      clearYesRef.current?.focus()
    })
    return () => {
      tl.kill()
      gsap.killTweensOf([dim, dlg])
    }
  }, [clearConfirmOpen])

  useLayoutEffect(() => {
    if (!langMenuOpen) return
    const fab = langFabRef.current
    const dlg = langDialogRef.current
    const dim = langDimRef.current
    if (!fab || !dlg || !dim) return
    const fr = fab.getBoundingClientRect()
    const gap = 6
    Object.assign(dlg.style, {
      position: 'fixed',
      right: `${window.innerWidth - fr.right}px`,
      bottom: `${window.innerHeight - fr.top + gap}px`,
      left: 'auto',
      top: 'auto',
      margin: '0',
      zIndex: '401',
    })
    const tl = playIconModalOpen(dim, dlg, fab, () => {
      dlg.querySelector<HTMLButtonElement>('.lab-langOption')?.focus()
    })
    return () => {
      tl.kill()
      gsap.killTweensOf([dim, dlg])
    }
  }, [langMenuOpen])

  useEffect(() => {
    if (!open && !clearConfirmOpen && !langMenuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      if (clearConfirmOpen) requestCloseClear()
      else if (open) requestClose()
      else if (langMenuOpen) {
        requestCloseLang()
        langFabRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    clearConfirmOpen,
    open,
    langMenuOpen,
    requestClose,
    requestCloseClear,
    requestCloseLang,
  ])

  useEffect(() => {
    return () => {
      const d = dimRef.current
      const dlg = dialogRef.current
      if (d) gsap.killTweensOf(d)
      if (dlg) gsap.killTweensOf(dlg)
      const cd = clearDimRef.current
      const cdlg = clearDialogRef.current
      if (cd) gsap.killTweensOf(cd)
      if (cdlg) gsap.killTweensOf(cdlg)
      const ld = langDimRef.current
      const ldlg = langDialogRef.current
      if (ld) gsap.killTweensOf(ld)
      if (ldlg) gsap.killTweensOf(ldlg)
    }
  }, [])

  const controlsModal =
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

  const clearModal =
    clearConfirmOpen &&
    createPortal(
      <>
        <div
          ref={clearDimRef}
          className="lab-controls-dim lab-clear-dim"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseClear()
          }}
        />
        <div className="lab-controls-dialog-layer lab-clear-dialog-layer">
          <div
            ref={clearDialogRef}
            className="lab-controls-dialog lab-clear-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={clearQuestionId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lab-clear-confirm-body">
              <p id={clearQuestionId} className="lab-controls-detail lab-clear-question">
                Clear all items on the canvas?
              </p>
              <div className="lab-clear-actions">
                <button
                  ref={clearYesRef}
                  type="button"
                  className="lab-clear-btn lab-clear-btn-yes"
                  onClick={confirmClearCanvas}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="lab-clear-btn lab-clear-btn-no"
                  onClick={requestCloseClear}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>
      </>,
      document.body,
    )

  const langModal =
    langMenuOpen &&
    createPortal(
      <>
        <div
          ref={langDimRef}
          className="lab-controls-dim"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseLang()
          }}
        />
        <div
          ref={langDialogRef}
          className="lab-langPopover"
          role="dialog"
          aria-modal="true"
          aria-label="Choose language"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="lab-langOption"
            onClick={requestCloseLang}
          >
            English
          </button>
          <button
            type="button"
            className="lab-langOption"
            onClick={requestCloseLang}
          >
            Français
          </button>
        </div>
      </>,
      document.body,
    )

  return (
    <>
      {controlsModal}
      {clearModal}
      {langModal}
      <div className="pointer-events-none absolute bottom-0 right-0 z-40 flex flex-row items-center gap-2 p-2 max-[560px]:gap-1.5 max-[560px]:p-1.5">
        {leadingFabs}
        <div className="lab-fabWithTooltip pointer-events-auto">
          <button
            ref={clearFabRef}
            type="button"
            className="lab-controls-fab"
            onClick={() => {
              if (!canClearCanvas || clearClosingRef.current) return
              setClearConfirmOpen(true)
            }}
            aria-label="Clear canvas"
          >
            <Trash2 size={22} strokeWidth={2} aria-hidden className="shrink-0" />
          </button>
          <span className="lab-fabTooltip" aria-hidden="true">
            Clear canvas
          </span>
        </div>
        <div className="lab-fabWithTooltip pointer-events-auto">
          <button
            ref={fabRef}
            type="button"
            className="lab-controls-fab"
            onClick={() => {
              if (openRef.current) requestClose()
              else setOpen(true)
            }}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="Controls"
          >
            <Keyboard size={22} strokeWidth={2} aria-hidden className="shrink-0" />
          </button>
          <span className="lab-fabTooltip" aria-hidden="true">
            Controls
          </span>
        </div>
        <div className="lab-fabWithTooltip lab-langFabWrap pointer-events-auto">
          <button
            ref={langFabRef}
            type="button"
            className="lab-controls-fab"
            aria-expanded={langMenuOpen}
            aria-haspopup="dialog"
            aria-label="Choose language"
            onClick={() => {
              if (langClosingRef.current) return
              if (langMenuOpenRef.current) requestCloseLang()
              else setLangMenuOpen(true)
            }}
          >
            <Globe size={22} strokeWidth={2} aria-hidden className="shrink-0" />
          </button>
          <span className="lab-fabTooltip lab-langFabTooltip" aria-hidden="true">
            EN / FR
          </span>
        </div>
      </div>
    </>
  )
}
