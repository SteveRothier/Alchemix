import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { WORKSHOP_BLOCKED_MODAL_EVENT } from '../../lib/workshopBlockedModal'
import { LAB_MESSAGES } from './labMessages'
import './labWorkshopBlockedModal.css'

const M = LAB_MESSAGES.canvas

/**
 * Écoute `WORKSHOP_BLOCKED_MODAL_EVENT` et affiche une modale type atelier (pas `window.alert`).
 * Monté une fois dans `App` sous le routeur pour couvrir toutes les routes.
 */
export function LabWorkshopBlockedModalHost() {
  const [open, setOpen] = useState(false)
  const okRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(WORKSHOP_BLOCKED_MODAL_EVENT, onOpen)
    return () => window.removeEventListener(WORKSHOP_BLOCKED_MODAL_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    okRef.current?.focus()
  }, [open])

  if (!open) return null

  const close = () => setOpen(false)

  return createPortal(
    <div
      className="lab-workshopBlocked-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="lab-workshopBlocked-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="lab-workshopBlocked-title">
          {M.workshopBlockedTitle}
        </h2>
        <p className="lab-workshopBlocked-body">{M.workshopDevOnlyAlert}</p>
        <div className="lab-workshopBlocked-actions">
          <button
            ref={okRef}
            type="button"
            className="lab-workshopBlocked-ok"
            onClick={close}
          >
            {M.workshopBlockedOk}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
