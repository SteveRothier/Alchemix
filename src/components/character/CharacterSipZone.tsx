import { forwardRef } from 'react'

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
        aria-label="Character — drop a spell here to drink it"
      >
        <div className="lab-characterAvatar" aria-hidden>
          <span className="lab-characterGlyph">🧙</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="lab-characterTitle">Character</p>
          <p className="lab-characterInstructions">
            Drag a <strong>spell</strong> here to drink it. Some spells manifest a{' '}
            <strong>creature</strong> the first time.
          </p>
          {hint ? <p className="lab-characterHint">{hint}</p> : null}
        </div>
      </div>
    )
  },
)
