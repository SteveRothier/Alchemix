import type { Vial } from '../../types'
import { InventoryVialItem } from './InventoryVialItem'
import styles from './InventoryPanel.module.css'

type InventoryPanelProps = {
  elements: Vial[]
  spells: Vial[]
  creatures: Vial[]
}

function InventorySection({
  title,
  vials,
}: {
  title: string
  vials: Vial[]
}) {
  return (
    <section className={styles.section} aria-label={title}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {vials.length === 0 ? (
        <p className={styles.empty}>—</p>
      ) : (
        <div className={styles.grid} role="list">
          {vials.map((vial) => (
            <InventoryVialItem key={vial.id} vial={vial} />
          ))}
        </div>
      )}
    </section>
  )
}

export function InventoryPanel({ elements, spells, creatures }: InventoryPanelProps) {
  return (
    <div className={styles.panel}>
      <InventorySection title="Éléments" vials={elements} />
      <InventorySection title="Sorts" vials={spells} />
      <InventorySection title="Créatures" vials={creatures} />
    </div>
  )
}
