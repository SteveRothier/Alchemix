import { gsap } from 'gsap'
import { BookOpen, Keyboard, Save, Trash2, X } from 'lucide-react'
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
import { RECIPES_BOOK_OPEN_EVENT } from '../../lib/recipesBookEvents'
import type { Vial } from '../../types'
import {
  playLabIconModalClose,
  playLabIconModalOpen,
} from './labIconModalGsap'
import { LAB_MESSAGES } from './labMessages'
import { LabRecipesBookPanel } from './LabRecipesBookPanel'

const ROWS = LAB_MESSAGES.controlsRows

export type LabControlsFloatingProps = {
  onClearCanvas: () => void
  canClearCanvas: boolean
  onResetProgress: () => void
  leadingFabs?: ReactNode
  /** Si défini, affiche le FAB livre + modale recettes (même animation GSAP que Contrôles). */
  recipesBookVials?: Record<string, Vial>
}

export function LabControlsFloating({
  onClearCanvas,
  canClearCanvas,
  onResetProgress,
  leadingFabs,
  recipesBookVials,
}: LabControlsFloatingProps) {
  const [open, setOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [recipesBookOpen, setRecipesBookOpen] = useState(false)
  const [recipesDetailIntentId, setRecipesDetailIntentId] = useState<string | null>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
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
  const resetDimRef = useRef<HTMLDivElement>(null)
  const resetDialogRef = useRef<HTMLDivElement>(null)
  const resetFabRef = useRef<HTMLButtonElement>(null)
  const resetYesRef = useRef<HTMLButtonElement>(null)
  const resetClosingRef = useRef(false)
  const resetConfirmOpenRef = useRef(resetConfirmOpen)
  resetConfirmOpenRef.current = resetConfirmOpen

  const recipesBookFabRef = useRef<HTMLButtonElement>(null)
  const recipesDimRef = useRef<HTMLDivElement>(null)
  const recipesDialogRef = useRef<HTMLDivElement>(null)
  const recipesClosingRef = useRef(false)
  const recipesBookOpenRef = useRef(recipesBookOpen)
  recipesBookOpenRef.current = recipesBookOpen

  const titleId = useId()
  const recipesTitleId = useId()
  const clearQuestionId = useId()
  const resetQuestionId = useId()

  const runCloseAnimation = useCallback((onDone: () => void) => {
    const dim = dimRef.current
    const dialog = dialogRef.current
    const fab = fabRef.current
    if (!dim || !dialog || !fab) {
      onDone()
      return
    }
    playLabIconModalClose(dim, dialog, fab, onDone)
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
    playLabIconModalClose(dim, dlg, fab, () => {
      setClearConfirmOpen(false)
      clearClosingRef.current = false
    })
  }, [])

  const confirmClearCanvas = useCallback(() => {
    if (clearClosingRef.current) return
    onClearCanvas()
    requestCloseClear()
  }, [onClearCanvas, requestCloseClear])

  const requestCloseReset = useCallback(() => {
    if (!resetConfirmOpenRef.current || resetClosingRef.current) return
    resetClosingRef.current = true
    const dim = resetDimRef.current
    const dlg = resetDialogRef.current
    const fab = resetFabRef.current
    if (!dim || !dlg || !fab) {
      setResetConfirmOpen(false)
      resetClosingRef.current = false
      return
    }
    playLabIconModalClose(dim, dlg, fab, () => {
      setResetConfirmOpen(false)
      resetClosingRef.current = false
    })
  }, [])

  const confirmResetProgress = useCallback(() => {
    if (resetClosingRef.current) return
    onResetProgress()
    requestCloseReset()
  }, [onResetProgress, requestCloseReset])

  const requestCloseRecipesBook = useCallback(() => {
    if (!recipesBookOpenRef.current || recipesClosingRef.current) return
    recipesClosingRef.current = true
    const dim = recipesDimRef.current
    const dlg = recipesDialogRef.current
    const fab = recipesBookFabRef.current
    if (!dim || !dlg || !fab) {
      setRecipesBookOpen(false)
      setRecipesDetailIntentId(null)
      recipesClosingRef.current = false
      return
    }
    playLabIconModalClose(dim, dlg, fab, () => {
      setRecipesBookOpen(false)
      setRecipesDetailIntentId(null)
      recipesClosingRef.current = false
    })
  }, [])

  const clearRecipesDetailIntent = useCallback(() => {
    setRecipesDetailIntentId(null)
  }, [])

  useEffect(() => {
    if (!recipesBookVials) return
    const onOpenRecipes = (e: Event) => {
      const ce = e as CustomEvent<{ vialId?: string }>
      const id = ce.detail?.vialId
      if (typeof id !== 'string' || !id.trim()) return
      setRecipesDetailIntentId(id.trim())
      setRecipesBookOpen(true)
    }
    window.addEventListener(RECIPES_BOOK_OPEN_EVENT, onOpenRecipes as EventListener)
    return () =>
      window.removeEventListener(RECIPES_BOOK_OPEN_EVENT, onOpenRecipes as EventListener)
  }, [recipesBookVials])

  useLayoutEffect(() => {
    if (!open) return
    const dim = dimRef.current
    const dialog = dialogRef.current
    const fab = fabRef.current
    if (!dim || !dialog || !fab) return

    const tl = playLabIconModalOpen(dim, dialog, fab, () => {
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
    const tl = playLabIconModalOpen(dim, dlg, fab, () => {
      clearYesRef.current?.focus()
    })
    return () => {
      tl.kill()
      gsap.killTweensOf([dim, dlg])
    }
  }, [clearConfirmOpen])

  useLayoutEffect(() => {
    if (!resetConfirmOpen) return
    const dim = resetDimRef.current
    const dlg = resetDialogRef.current
    const fab = resetFabRef.current
    if (!dim || !dlg || !fab) return
    const tl = playLabIconModalOpen(dim, dlg, fab, () => {
      resetYesRef.current?.focus()
    })
    return () => {
      tl.kill()
      gsap.killTweensOf([dim, dlg])
    }
  }, [resetConfirmOpen])

  useLayoutEffect(() => {
    if (!recipesBookOpen || !recipesBookVials) return
    const dim = recipesDimRef.current
    const dialog = recipesDialogRef.current
    const fab = recipesBookFabRef.current
    if (!dim || !dialog || !fab) return

    const tl = playLabIconModalOpen(dim, dialog, fab, () => {
      const dlg = recipesDialogRef.current
      const search = dlg?.querySelector<HTMLInputElement>('input[type="search"]')
      if (search) search.focus()
      else dlg?.querySelector<HTMLButtonElement>('.lab-recipesBackBtn')?.focus()
    })

    return () => {
      tl.kill()
      gsap.killTweensOf([dim, dialog])
    }
  }, [recipesBookOpen, recipesBookVials])

  useEffect(() => {
    if (!open && !clearConfirmOpen && !resetConfirmOpen && !recipesBookOpen)
      return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (recipesBookOpen) {
        e.preventDefault()
        requestCloseRecipesBook()
        return
      }
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      if (clearConfirmOpen) requestCloseClear()
      else if (resetConfirmOpen) requestCloseReset()
      else if (open) requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    clearConfirmOpen,
    resetConfirmOpen,
    open,
    recipesBookOpen,
    requestClose,
    requestCloseClear,
    requestCloseReset,
    requestCloseRecipesBook,
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
      const rd = resetDimRef.current
      const rdlg = resetDialogRef.current
      if (rd) gsap.killTweensOf(rd)
      if (rdlg) gsap.killTweensOf(rdlg)
      const rbd = recipesDimRef.current
      const rbdlg = recipesDialogRef.current
      if (rbd) gsap.killTweensOf(rbd)
      if (rbdlg) gsap.killTweensOf(rbdlg)
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
                  {LAB_MESSAGES.dialogs.controlsTitle}
                </h2>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                className="lab-controls-close"
                onClick={requestClose}
                aria-label={LAB_MESSAGES.dialogs.controlsCloseAriaLabel}
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
                {LAB_MESSAGES.dialogs.clearQuestion}
              </p>
              <div className="lab-clear-actions">
                <button
                  ref={clearYesRef}
                  type="button"
                  className="lab-clear-btn lab-clear-btn-yes"
                  onClick={confirmClearCanvas}
                >
                  {LAB_MESSAGES.common.yes}
                </button>
                <button
                  type="button"
                  className="lab-clear-btn lab-clear-btn-no"
                  onClick={requestCloseClear}
                >
                  {LAB_MESSAGES.common.no}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>,
      document.body,
    )

  const resetModal =
    resetConfirmOpen &&
    createPortal(
      <>
        <div
          ref={resetDimRef}
          className="lab-controls-dim lab-clear-dim"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseReset()
          }}
        />
        <div className="lab-controls-dialog-layer lab-clear-dialog-layer">
          <div
            ref={resetDialogRef}
            className="lab-controls-dialog lab-clear-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={resetQuestionId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lab-clear-confirm-body">
              <p id={resetQuestionId} className="lab-controls-detail lab-clear-question">
                {LAB_MESSAGES.dialogs.resetQuestion}
              </p>
              <div className="lab-clear-actions">
                <button
                  ref={resetYesRef}
                  type="button"
                  className="lab-clear-btn lab-clear-btn-yes"
                  onClick={confirmResetProgress}
                >
                  {LAB_MESSAGES.common.yes}
                </button>
                <button
                  type="button"
                  className="lab-clear-btn lab-clear-btn-no"
                  onClick={requestCloseReset}
                >
                  {LAB_MESSAGES.common.no}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>,
      document.body,
    )

  const recipesModal =
    recipesBookOpen &&
    recipesBookVials &&
    createPortal(
      <>
        <div
          ref={recipesDimRef}
          className="lab-controls-dim lab-recipesBookDim"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseRecipesBook()
          }}
        />
        <div className="lab-controls-dialog-layer lab-recipesBookLayer">
          <div
            ref={recipesDialogRef}
            className="lab-controls-dialog lab-recipesDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={recipesTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <LabRecipesBookPanel
              vials={recipesBookVials}
              onRequestClose={requestCloseRecipesBook}
              titleId={recipesTitleId}
              detailIntentId={recipesDetailIntentId}
              onDetailIntentConsumed={clearRecipesDetailIntent}
            />
          </div>
        </div>
      </>,
      document.body,
    )

  return (
    <>
      {controlsModal}
      {clearModal}
      {resetModal}
      {recipesModal}
      <div className="pointer-events-none absolute bottom-0 right-0 z-40 flex flex-row items-center gap-2 p-2 max-[560px]:gap-1.5 max-[560px]:p-1.5">
        {leadingFabs}
        <div className="lab-fabWithTooltip pointer-events-auto">
          <button
            ref={resetFabRef}
            type="button"
            className="lab-controls-fab"
            onClick={() => {
              if (resetClosingRef.current) return
              setResetConfirmOpen(true)
            }}
            aria-label={LAB_MESSAGES.dock.resetAriaLabel}
          >
            <Save size={22} strokeWidth={2} aria-hidden className="shrink-0" />
          </button>
          <span className="lab-fabTooltip" aria-hidden="true">
            {LAB_MESSAGES.dock.resetTooltip}
          </span>
        </div>
        <div className="lab-fabWithTooltip pointer-events-auto">
          <button
            ref={clearFabRef}
            type="button"
            className="lab-controls-fab"
            onClick={() => {
              if (!canClearCanvas || clearClosingRef.current) return
              setClearConfirmOpen(true)
            }}
            aria-label={LAB_MESSAGES.dock.clearAriaLabel}
          >
            <Trash2 size={22} strokeWidth={2} aria-hidden className="shrink-0" />
          </button>
          <span className="lab-fabTooltip" aria-hidden="true">
            {LAB_MESSAGES.dock.clearTooltip}
          </span>
        </div>
        <div className="lab-fabWithTooltip lab-controlsFabNarrowHide pointer-events-auto">
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
            aria-label={LAB_MESSAGES.dock.controlsAriaLabel}
          >
            <Keyboard size={22} strokeWidth={2} aria-hidden className="shrink-0" />
          </button>
          <span className="lab-fabTooltip" aria-hidden="true">
            {LAB_MESSAGES.dock.controlsTooltip}
          </span>
        </div>
        {recipesBookVials ? (
          <div className="lab-fabWithTooltip pointer-events-auto">
            <button
              ref={recipesBookFabRef}
              type="button"
              className="lab-controls-fab"
              onClick={() => {
                if (recipesClosingRef.current) return
                if (recipesBookOpenRef.current) requestCloseRecipesBook()
                else {
                  setRecipesDetailIntentId(null)
                  setRecipesBookOpen(true)
                }
              }}
              aria-expanded={recipesBookOpen}
              aria-haspopup="dialog"
              aria-label={LAB_MESSAGES.recipesBook.fabAriaLabel}
            >
              <BookOpen size={22} strokeWidth={2} aria-hidden className="shrink-0" />
            </button>
            <span className="lab-fabTooltip" aria-hidden="true">
              {LAB_MESSAGES.recipesBook.fabTooltip}
            </span>
          </div>
        ) : null}
      </div>
    </>
  )
}
