import type { CSSProperties } from 'react'
import type { Vial } from '../../types'
import { VialFlaskGraphic } from './flask/VialFlaskGraphic'

type VialChipProps = {
  vial: Vial
  compact?: boolean
  /** Grille inventaire : marges serrées, style type « pastille » */
  inventory?: boolean
  /** Plateau labo : même carte qu’inventaire, nom jusqu’à 2 lignes */
  lab?: boolean
}

export function VialChip({ vial, compact, inventory, lab }: VialChipProps) {
  const chipClass = lab
    ? 'lab-chipInventory lab-chipInventory--lab'
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
      <VialFlaskGraphic vial={vial} />
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
