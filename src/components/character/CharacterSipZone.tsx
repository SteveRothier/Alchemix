import { forwardRef } from 'react'
import { Trophy } from 'lucide-react'

type CharacterSipZoneProps = {
  hint?: string | null
}

export const CharacterSipZone = forwardRef<HTMLDivElement, CharacterSipZoneProps>(
  function CharacterSipZone({ hint }, ref) {
    return (
      <div
        ref={ref}
        className="lab-characterZone min-w-0 flex-1"
        data-lab-sip-zone
        aria-label="Character — offer an element to earn creature trophies"
      >
        <div className="lab-characterAvatar" aria-hidden>
          <span className="lab-characterGlyph">🧙</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="lab-characterTitle flex items-center gap-1.5">
            Character
            <Trophy size={14} strokeWidth={2} aria-hidden />
          </p>
          <p className="lab-characterInstructions">
            Drag an <strong>element</strong> here to offer it. Some offerings unlock a{' '}
            <strong>creature trophy</strong>.
          </p>
          {hint ? <p className="lab-characterHint">{hint}</p> : null}
        </div>
      </div>
    )
  },
)
