import { useMemo, useState } from 'react'
import type { Vial } from '../../types'
import { InventoryVialItem } from './InventoryVialItem'
import styles from './InventoryPanel.module.css'

const PAGE_SIZE = 20

type InventoryPanelProps = {
  vials: Vial[]
}

export function InventoryPanel({ vials }: InventoryPanelProps) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(vials.length / PAGE_SIZE))
  const effectivePage = Math.min(page, pageCount - 1)

  const pageItems = useMemo(() => {
    const start = effectivePage * PAGE_SIZE
    return vials.slice(start, start + PAGE_SIZE)
  }, [vials, effectivePage])

  const maxIndex = pageCount - 1

  return (
    <div className={styles.panel}>
      <div className={styles.grid} role="list">
        {pageItems.map((vial) => (
          <InventoryVialItem key={vial.id} vial={vial} />
        ))}
      </div>
      {pageCount > 1 && (
        <div className={styles.pager}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={effectivePage <= 0}
            onClick={() =>
              setPage((p) => {
                const cur = Math.min(p, maxIndex)
                return Math.max(0, cur - 1)
              })
            }
            aria-label="Page précédente"
          >
            ‹
          </button>
          <span className={styles.pageInfo}>
            {effectivePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={effectivePage >= maxIndex}
            onClick={() =>
              setPage((p) => {
                const cur = Math.min(p, maxIndex)
                return Math.min(maxIndex, cur + 1)
              })
            }
            aria-label="Page suivante"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
