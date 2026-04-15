import { useMemo, useState } from 'react'
import type { Vial } from '../../types'
import { InventoryVialItem } from './InventoryVialItem'

type InventoryPanelProps = {
  elements: Vial[]
}

function InventorySection({
  title,
  vials,
  search,
  onSearchChange,
}: {
  title: string
  vials: Vial[]
  search: string
  onSearchChange: (value: string) => void
}) {
  const n = vials.length
  return (
    <section
      className="lab-invSectionScroll flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden"
      aria-label={`${title}, ${n} ${n === 1 ? 'vial' : 'vials'}`}
    >
      <div className="lab-invSectionHeadingRow pr-[0.65rem]">
        <h3 className="lab-invSectionHeading m-0">
          <span className="lab-invSectionTitle">{title}</span>
          <span className="lab-invSectionCount">{n}</span>
        </h3>
        <div className="lab-invSearchWrap">
          <input
            type="search"
            className="lab-invSearchInput"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            aria-label="Search elements"
          />
        </div>
      </div>
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

export function InventoryPanel({ elements }: InventoryPanelProps) {
  const [search, setSearch] = useState('')
  const filteredElements = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return elements
    return elements.filter((v) => {
      const name = v.name.toLowerCase()
      const id = v.id.toLowerCase()
      return name.includes(q) || id.includes(q)
    })
  }, [elements, search])

  return (
    <div className="lab-invPanelRoot flex min-h-0 flex-1 flex-col gap-[0.45rem] overflow-hidden pl-[0.65rem] pr-0 pb-2 pt-1">
      <InventorySection
        title="Elements"
        vials={filteredElements}
        search={search}
        onSearchChange={setSearch}
      />
    </div>
  )
}
