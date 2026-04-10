import type { Vial } from '../../types'
import { InventoryVialItem } from './InventoryVialItem'

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
    <section
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden"
      aria-label={title}
    >
      <h3 className="lab-invSectionTitle">{title}</h3>
      {vials.length === 0 ? (
        <p className="lab-invEmpty">—</p>
      ) : (
        <div
          className="flex flex-wrap content-start items-center justify-start gap-[6px]"
          role="list"
        >
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
    <div className="flex min-h-0 flex-1 flex-col gap-[0.45rem] overflow-hidden px-[0.65rem] pb-2 pt-1">
      <InventorySection title="Éléments" vials={elements} />
      <InventorySection title="Sorts" vials={spells} />
      <InventorySection title="Créatures" vials={creatures} />
    </div>
  )
}
