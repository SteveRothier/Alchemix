import { useId } from 'react'
import { LAB_MESSAGES } from './labMessages'

type LabFirstVisitHintProps = {
  visible: boolean
  onDismiss: () => void
}

export function LabFirstVisitHint({ visible, onDismiss }: LabFirstVisitHintProps) {
  const rid = useId().replace(/:/g, '')
  const titleId = `${rid}-fv-title`
  const m = LAB_MESSAGES.firstVisit

  if (!visible) return null

  return (
    <div className="lab-firstVisit pointer-events-none">
      <div
        className="lab-firstVisit-card pointer-events-auto"
        role="region"
        aria-label={m.regionAriaLabel}
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="lab-firstVisit-title">
          {m.title}
        </h2>
        <p className="lab-firstVisit-line">{m.lineDrag}</p>
        <p className="lab-firstVisit-line">{m.lineOffer}</p>
        <button type="button" className="lab-firstVisit-dismiss" onClick={onDismiss}>
          {m.dismissLabel}
        </button>
      </div>
    </div>
  )
}
