import type { CSSProperties } from 'react'
import type { Vial } from '../../types'
import styles from './VialChip.module.css'

type VialChipProps = {
  vial: Vial
  compact?: boolean
  /** Grille inventaire : marges serrées, style type « pastille » */
  inventory?: boolean
}

export function VialChip({ vial, compact, inventory }: VialChipProps) {
  const chipClass = inventory
    ? styles.chipInventory
    : compact
      ? styles.chipCompact
      : styles.chip

  return (
    <div
      className={chipClass}
      data-vial-type={inventory ? vial.type : undefined}
      style={
        {
          '--vial-a': vial.liquid.primaryColor,
          '--vial-b': vial.liquid.secondaryColor ?? vial.liquid.primaryColor,
        } as CSSProperties
      }
    >
      <div className={styles.flask} aria-hidden />
      <div className={styles.meta}>
        <span className={styles.name}>{vial.name}</span>
        {!compact && !inventory && (
          <span className={styles.rarity} data-rarity={vial.rarity}>
            {vial.rarity}
          </span>
        )}
      </div>
    </div>
  )
}
