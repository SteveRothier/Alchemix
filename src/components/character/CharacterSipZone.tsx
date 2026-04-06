import { useDroppable } from '@dnd-kit/core'
import styles from './CharacterSipZone.module.css'

export const CHARACTER_SIP_ID = 'character-sip'

type CharacterSipZoneProps = {
  hint?: string | null
}

export function CharacterSipZone({ hint }: CharacterSipZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: CHARACTER_SIP_ID })

  return (
    <div
      ref={setNodeRef}
      className={styles.zone}
      data-over={isOver || undefined}
      aria-label="Personnage — dépose un sort ici pour le faire boire"
    >
      <div className={styles.avatar} aria-hidden>
        <span className={styles.glyph}>🧙</span>
      </div>
      <div className={styles.copy}>
        <p className={styles.title}>Personnage</p>
        <p className={styles.instructions}>
          Glisse un <strong>sort</strong> ici pour le faire boire. Certains sorts
          manifestent une <strong>créature</strong> une première fois.
        </p>
        {hint ? <p className={styles.hint}>{hint}</p> : null}
      </div>
    </div>
  )
}
