import type { CSSProperties } from 'react'
import { resolveLabVialDisplayName } from '../../lib/legacyVialIdRenames'
import type { Vial } from '../../types'
import { VialFlaskGraphic } from './flask/VialFlaskGraphic'

type VialChipProps = {
  vial: Vial
  compact?: boolean
  /** Grille inventaire et fioles posées : même carte (laboratoire = inventaire). */
  inventory?: boolean
}

export function VialChip({ vial, compact, inventory }: VialChipProps) {
  const displayName = resolveLabVialDisplayName(vial)
  const invStyle = Boolean(inventory)
  const chipClass = invStyle
    ? 'lab-chipInventory'
    : compact
      ? 'lab-chipCompact'
      : 'lab-chip'

  return (
    <div
      className={chipClass}
      data-vial-type={invStyle ? vial.type : undefined}
      style={
        {
          '--vial-a': vial.liquid.primaryColor,
          '--vial-b': vial.liquid.secondaryColor ?? vial.liquid.primaryColor,
        } as CSSProperties
      }
    >
      <VialFlaskGraphic vial={vial} />
      <div className="lab-meta">
        {invStyle ? (
          <span className="lab-name">{displayName}</span>
        ) : (
          <>
            <span className="lab-name">{displayName}</span>
            {!compact && (
              <span className="lab-rarity" data-rarity={vial.rarity}>
                {vial.rarity}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
