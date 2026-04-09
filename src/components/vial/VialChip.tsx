import type { CSSProperties } from 'react'
import type { Vial } from '../../types'

type VialChipProps = {
  vial: Vial
  compact?: boolean
  /** Grille inventaire : marges serrées, style type « pastille » */
  inventory?: boolean
  /** Plateau labo : noms lisibles (2 lignes), fusion au survol */
  lab?: boolean
}

export function VialChip({ vial, compact, inventory, lab }: VialChipProps) {
  const chipClass = lab
    ? 'lab-chipLab'
    : inventory
      ? 'lab-chipInventory'
      : compact
        ? 'lab-chipCompact'
        : 'lab-chip'

  return (
    <div
      className={chipClass}
      data-vial-type={
        inventory || lab ? vial.type : undefined
      }
      style={
        {
          '--vial-a': vial.liquid.primaryColor,
          '--vial-b': vial.liquid.secondaryColor ?? vial.liquid.primaryColor,
        } as CSSProperties
      }
    >
      <div className="lab-flask" aria-hidden />
      <div className="lab-meta">
        <span className="lab-name">{vial.name}</span>
        {!compact && !inventory && !lab && (
          <span className="lab-rarity" data-rarity={vial.rarity}>
            {vial.rarity}
          </span>
        )}
      </div>
    </div>
  )
}
