import { ArrowDownUp } from 'lucide-react'
import { gsap } from 'gsap'
import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LAB_MESSAGES } from '../lab/labMessages'
import type { Vial } from '../../types'
import { InventoryVialItem } from './InventoryVialItem'

type InventoryPanelProps = {
  elements: Vial[]
}

type InventorySortMode = 'time' | 'name' | 'color'

function iconToDialogDelta(
  fab: HTMLElement,
  dialog: HTMLElement,
): { dx: number; dy: number } {
  const ir = fab.getBoundingClientRect()
  const dr = dialog.getBoundingClientRect()
  const ix = ir.left + ir.width / 2
  const iy = ir.top + ir.height / 2
  const cx = dr.left + dr.width / 2
  const cy = dr.top + dr.height / 2
  return { dx: ix - cx, dy: iy - cy }
}

function playSortMenuOpen(
  dialog: HTMLElement,
  fab: HTMLElement,
  onComplete: () => void,
) {
  const { dx, dy } = iconToDialogDelta(fab, dialog)
  gsap.killTweensOf(dialog)
  gsap.set(dialog, {
    x: dx,
    y: dy,
    scale: 0.12,
    opacity: 0,
    transformOrigin: '50% 50%',
  })
  return gsap.to(dialog, {
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    duration: 0.42,
    ease: 'power2.out',
    onComplete,
  })
}

function playSortMenuClose(
  dialog: HTMLElement,
  fab: HTMLElement,
  onComplete: () => void,
) {
  const { dx, dy } = iconToDialogDelta(fab, dialog)
  gsap.killTweensOf(dialog)
  return gsap.to(dialog, {
    x: dx,
    y: dy,
    scale: 0.12,
    opacity: 0,
    duration: 0.32,
    ease: 'power2.in',
    onComplete,
  })
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
      className="lab-invSectionScroll flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto"
      aria-label={`${title}, ${n} ${n === 1 ? LAB_MESSAGES.inventory.unitSingular : LAB_MESSAGES.inventory.unitPlural}`}
    >
      <div className="lab-invSectionHeadingRow hidden pr-[0.65rem] min-[800px]:flex">
        <h3 className="lab-invSectionHeading m-0">
          <span className="lab-invSectionTitle">{title}</span>
        </h3>
        <div className="lab-invSearchWrap">
          <input
            type="search"
            className="lab-invSearchInput"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={LAB_MESSAGES.inventory.searchPlaceholder}
            aria-label={LAB_MESSAGES.inventory.searchAriaLabel}
          />
        </div>
      </div>
      {vials.length === 0 ? (
        <p className="lab-invEmpty pr-[0.65rem] max-[799px]:pr-2">—</p>
      ) : (
        <div
          className="lab-invChipStrip flex w-full min-w-0 flex-wrap content-start justify-start gap-[3px] pr-[0.65rem] max-[799px]:items-start max-[799px]:align-content-start max-[799px]:pb-1 max-[799px]:pr-2 min-[800px]:items-center"
          dir="ltr"
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
  const [sortMode, setSortMode] = useState<InventorySortMode>('time')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const sortWrapMobileRef = useRef<HTMLDivElement>(null)
  const sortWrapDesktopRef = useRef<HTMLDivElement>(null)
  const sortFabRef = useRef<HTMLButtonElement | null>(null)
  const sortMenuRef = useRef<HTMLDivElement>(null)
  const sortClosingRef = useRef(false)
  const sortMenuOpenRef = useRef(sortMenuOpen)
  sortMenuOpenRef.current = sortMenuOpen
  const requestCloseSort = useMemo(
    () => () => {
      if (!sortMenuOpenRef.current || sortClosingRef.current) return
      sortClosingRef.current = true
      const menu = sortMenuRef.current
      const fab = sortFabRef.current
      if (!menu || !fab) {
        setSortMenuOpen(false)
        sortClosingRef.current = false
        return
      }
      playSortMenuClose(menu, fab, () => {
        setSortMenuOpen(false)
        sortClosingRef.current = false
      })
    },
    [],
  )
  useEffect(() => {
    if (!sortMenuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (!t) return
      if (sortWrapMobileRef.current?.contains(t)) return
      if (sortWrapDesktopRef.current?.contains(t)) return
      if (sortMenuRef.current?.contains(t)) return
      requestCloseSort()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestCloseSort()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [requestCloseSort, sortMenuOpen])
  useLayoutEffect(() => {
    if (!sortMenuOpen) return
    const fab = sortFabRef.current
    const menu = sortMenuRef.current
    if (!fab || !menu) return
    const fr = fab.getBoundingClientRect()
    const gap = 6
    Object.assign(menu.style, {
      position: 'fixed',
      right: `${window.innerWidth - fr.right}px`,
      bottom: `${window.innerHeight - fr.top + gap}px`,
      left: 'auto',
      top: 'auto',
      margin: '0',
      zIndex: '401',
    })
    const tween = playSortMenuOpen(menu, fab, () => {
      menu.querySelector<HTMLButtonElement>('.lab-invSortOption')?.focus()
    })
    return () => {
      tween.kill()
      gsap.killTweensOf(menu)
    }
  }, [sortMenuOpen])
  useEffect(
    () => () => {
      const menu = sortMenuRef.current
      if (menu) gsap.killTweensOf(menu)
    },
    [],
  )
  const sortLabel =
    sortMode === 'time'
      ? LAB_MESSAGES.inventory.sortTime
      : sortMode === 'name'
        ? LAB_MESSAGES.inventory.sortName
        : LAB_MESSAGES.inventory.sortColor
  const filteredElements = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = !q
      ? elements
      : elements.filter((v) => {
      const name = v.name.toLowerCase()
      const id = v.id.toLowerCase()
      return name.includes(q) || id.includes(q)
    })
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      if (sortMode === 'name') {
        return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
      }
      if (sortMode === 'color') {
        const ac = a.liquid.primaryColor.toLowerCase()
        const bc = b.liquid.primaryColor.toLowerCase()
        const cc = ac.localeCompare(bc, 'en', { sensitivity: 'base' })
        if (cc !== 0) return cc
        return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
      }
      const at = Date.parse(a.discoveredAt)
      const bt = Date.parse(b.discoveredAt)
      const ad = Number.isFinite(at) ? at : 0
      const bd = Number.isFinite(bt) ? bt : 0
      if (ad !== bd) return ad - bd
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
    })
    return sorted
  }, [elements, search, sortMode])

  const onSortButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    sortFabRef.current = e.currentTarget
    if (sortClosingRef.current) return
    if (sortMenuOpenRef.current) requestCloseSort()
    else setSortMenuOpen(true)
  }

  return (
    <div className="lab-invPanelRoot relative flex min-h-0 min-w-0 flex-1 flex-col gap-[0.45rem] overflow-hidden pl-[0.65rem] pr-0 pb-2 pt-1 max-[799px]:px-2 max-[799px]:pb-2">
      <div className="flex min-h-0 shrink-0 items-center gap-2 pb-1 pt-0 min-[800px]:hidden">
        <div className="lab-invSearchWrap min-w-0 flex-1">
          <input
            type="search"
            className="lab-invSearchInput w-full min-w-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={LAB_MESSAGES.inventory.searchPlaceholder}
            aria-label={LAB_MESSAGES.inventory.searchAriaLabel}
          />
        </div>
        <div ref={sortWrapMobileRef} className="shrink-0">
          <button
            type="button"
            className="lab-controls-fab lab-invSortBtn"
            aria-haspopup="menu"
            aria-expanded={sortMenuOpen}
            aria-label={`${LAB_MESSAGES.inventory.sortAriaLabel}: ${sortLabel}`}
            onClick={onSortButtonClick}
          >
            <ArrowDownUp size={22} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
      <InventorySection
        title={LAB_MESSAGES.inventory.elementsSectionTitle}
        vials={filteredElements}
        search={search}
        onSearchChange={setSearch}
      />
      <div ref={sortWrapDesktopRef} className="lab-invSortDock max-[799px]:hidden min-[800px]:block">
        <button
          type="button"
          className="lab-controls-fab lab-invSortBtn"
          aria-haspopup="menu"
          aria-expanded={sortMenuOpen}
          aria-label={`${LAB_MESSAGES.inventory.sortAriaLabel}: ${sortLabel}`}
          onClick={onSortButtonClick}
        >
          <ArrowDownUp size={22} strokeWidth={2} aria-hidden />
        </button>
      </div>
      {sortMenuOpen
        ? createPortal(
            <div
              ref={sortMenuRef}
              className="lab-invSortMenu"
              role="menu"
              aria-label={LAB_MESSAGES.inventory.sortAriaLabel}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitemradio"
                aria-checked={sortMode === 'time'}
                className="lab-invSortOption"
                onClick={() => {
                  setSortMode('time')
                  requestCloseSort()
                }}
              >
                {LAB_MESSAGES.inventory.sortTime}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={sortMode === 'name'}
                className="lab-invSortOption"
                onClick={() => {
                  setSortMode('name')
                  requestCloseSort()
                }}
              >
                {LAB_MESSAGES.inventory.sortName}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={sortMode === 'color'}
                className="lab-invSortOption"
                onClick={() => {
                  setSortMode('color')
                  requestCloseSort()
                }}
              >
                {LAB_MESSAGES.inventory.sortColor}
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
