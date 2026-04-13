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
  const n = vials.length
  return (
    <section
      className="lab-invSectionScroll flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden"
      aria-label={`${title}, ${n} ${n === 1 ? 'vial' : 'vials'}`}
    >
      <h3 className="lab-invSectionHeading m-0 pr-[0.65rem]">
        <span className="lab-invSectionTitle">{title}</span>
        <span className="lab-invSectionCount">{n}</span>
      </h3>
      {vials.length === 0 ? (
        <p className="lab-invEmpty pr-[0.65rem]">—</p>
      ) : (
        <div
          className="flex flex-wrap content-start items-center justify-start gap-[3px] pr-[0.65rem]"
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

export function InventoryPanel({
  elements,
  spells,
  creatures,
}: InventoryPanelProps) {
  return (
    <div className="lab-invPanelRoot flex min-h-0 flex-1 flex-col gap-[0.45rem] overflow-hidden pl-[0.65rem] pr-0 pb-2 pt-1">
      <InventorySection title="Elements" vials={elements} />
      <InventorySection title="Spells" vials={spells} />
      <InventorySection title="Creatures" vials={creatures} />
    </div>
  )
}
