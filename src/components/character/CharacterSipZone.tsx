import { useDroppable } from '@dnd-kit/core'

export const CHARACTER_SIP_ID = 'character-sip'

type CharacterSipZoneProps = {
  hint?: string | null
}

export function CharacterSipZone({ hint }: CharacterSipZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: CHARACTER_SIP_ID })

  return (
    <div
      ref={setNodeRef}
      className="lab-characterZone min-w-0 flex-1"
      data-over={isOver || undefined}
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
}
