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
        aria-label="Personnage — dépose un sort ici pour le faire boire"
      >
        <div className="lab-characterAvatar" aria-hidden>
          <span className="lab-characterGlyph">🧙</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="lab-characterTitle">Personnage</p>
          <p className="lab-characterInstructions">
            Glisse un <strong>sort</strong> ici pour le faire boire. Certains sorts
            manifestent une <strong>créature</strong> une première fois.
          </p>
          {hint ? <p className="lab-characterHint">{hint}</p> : null}
        </div>
      </div>
    )
  },
)
