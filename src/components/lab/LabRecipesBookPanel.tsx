import { ChevronLeft, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CRAFTED_VIAL_TEMPLATES } from '../../data/craftedVials'
import { applyLegacyVialIdRename, resolveLabVialDisplayName } from '../../lib/legacyVialIdRenames'
import { pairKey } from '../../lib/recipeMap'
import type { Vial } from '../../types'
import { VialFlaskGraphic } from '../vial/flask/VialFlaskGraphic'
import { LAB_MESSAGES } from './labMessages'

const M = LAB_MESSAGES.recipesBook

function collectCatalogRecipePairs(resultId: string): { a: string; b: string }[] {
  const id = applyLegacyVialIdRename(resultId.trim())
  const t = CRAFTED_VIAL_TEMPLATES[id]
  if (!t) return []
  const raw = t.recipes?.length ? t.recipes : t.recipe ? [t.recipe] : []
  const seen = new Set<string>()
  const out: { a: string; b: string }[] = []
  for (const r of raw) {
    const a = applyLegacyVialIdRename((r.ingredientA ?? '').trim())
    const b = applyLegacyVialIdRename((r.ingredientB ?? '').trim())
    if (!a || !b) continue
    const k = pairKey(a, b)
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ a, b })
  }
  return out
}

function vialForIngredientId(id: string, vials: Record<string, Vial>): Vial | null {
  const key = applyLegacyVialIdRename(id.trim())
  if (vials[key]) return vials[key]
  const t = CRAFTED_VIAL_TEMPLATES[key]
  if (!t) return null
  const liquid =
    t.liquid ?? {
      primaryColor: '#94a3b8',
      secondaryColor: '#64748b',
      opacity: 0.78,
      texture: 'liquid' as const,
    }
  return {
    id: t.id,
    type: t.type,
    name: t.name,
    description: '',
    liquid,
    icon: 'star',
    discoveredAt: '1970-01-01T00:00:00.000Z',
    rarity: 'common',
  }
}

export type LabRecipesBookPanelProps = {
  vials: Record<string, Vial>
  onRequestClose: () => void
  titleId: string
}

export function LabRecipesBookPanel({
  vials,
  onRequestClose,
  titleId,
}: LabRecipesBookPanelProps) {
  const [q, setQ] = useState('')
  const [detailVial, setDetailVial] = useState<Vial | null>(null)

  const rows = useMemo(() => {
    const list = Object.values(vials)
    const term = q.trim().toLowerCase()
    const filtered = term
      ? list.filter((v) => {
          const name = resolveLabVialDisplayName(v).toLowerCase()
          return name.includes(term) || v.id.toLowerCase().includes(term)
        })
      : list
    return filtered.sort((a, b) =>
      resolveLabVialDisplayName(a).localeCompare(
        resolveLabVialDisplayName(b),
        undefined,
        { sensitivity: 'base' },
      ),
    )
  }, [vials, q])

  const catalogPairs = useMemo(
    () => (detailVial ? collectCatalogRecipePairs(detailVial.id) : []),
    [detailVial],
  )

  const discoveredFusionRows = useMemo(() => {
    if (!detailVial) return []
    return catalogPairs.filter((p) => vials[p.a] && vials[p.b])
  }, [catalogPairs, detailVial, vials])

  return (
    <>
      <header className="lab-controls-header lab-recipesDialogHeader">
        <h2 id={titleId} className="lab-controls-title">
          {M.title}
        </h2>
        <button
          type="button"
          className="lab-controls-close"
          onClick={onRequestClose}
          aria-label={M.closeAriaLabel}
        >
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      </header>

      {!detailVial ? (
        <>
          <div className="lab-recipesSearchWrap">
            <Search
              size={16}
              strokeWidth={2}
              aria-hidden
              className="lab-recipesSearchIcon"
            />
            <input
              type="search"
              className="lab-recipesSearchInput"
              placeholder={M.searchPlaceholder}
              aria-label={M.searchAriaLabel}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="lab-recipesScroll">
            {rows.length === 0 ? (
              <p className="lab-recipesEmpty">{M.emptyFilter}</p>
            ) : (
              <div className="lab-recipesGrid">
                {rows.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="lab-recipesChip"
                    onClick={() => setDetailVial(v)}
                  >
                    {v.type !== 'creature' ? (
                      <VialFlaskGraphic vial={v} className="lab-recipesChipFlask" />
                    ) : null}
                    <span className="lab-recipesChipName">
                      {resolveLabVialDisplayName(v)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="lab-recipesDetailBar">
            <button
              type="button"
              className="lab-recipesBackBtn"
              onClick={() => setDetailVial(null)}
              aria-label={M.backToListAriaLabel}
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden />
            </button>
            {detailVial.type !== 'creature' ? (
              <VialFlaskGraphic vial={detailVial} className="lab-recipesDetailThumb" />
            ) : null}
            <h3 className="lab-recipesDetailTitle">
              {resolveLabVialDisplayName(detailVial)}
            </h3>
            {catalogPairs.length > 0 ? (
              <span className="lab-recipesDetailProgress" aria-live="polite">
                {discoveredFusionRows.length}/{catalogPairs.length}
              </span>
            ) : null}
          </div>
          <div className="lab-recipesScroll lab-recipesScroll--detail">
            {catalogPairs.length === 0 ? (
              <p className="lab-recipesEmpty">{M.noCatalogCombinations}</p>
            ) : discoveredFusionRows.length === 0 ? (
              <p className="lab-recipesEmpty">{M.noDiscoveredCombinations}</p>
            ) : (
              <ul className="lab-recipesFusionList" role="list">
                {discoveredFusionRows.map(({ a, b }) => {
                  const va = vialForIngredientId(a, vials)!
                  const vb = vialForIngredientId(b, vials)!
                  return (
                    <li key={pairKey(a, b)} className="lab-recipesFusionRow">
                      <div className="lab-recipesFusionCard">
                        {va.type !== 'creature' ? (
                          <VialFlaskGraphic vial={va} className="lab-recipesFusionFlask" />
                        ) : null}
                        <span className="lab-recipesFusionCardName">
                          {resolveLabVialDisplayName(va)}
                        </span>
                      </div>
                      <span className="lab-recipesFusionPlus" aria-hidden>
                        +
                      </span>
                      <div className="lab-recipesFusionCard">
                        {vb.type !== 'creature' ? (
                          <VialFlaskGraphic vial={vb} className="lab-recipesFusionFlask" />
                        ) : null}
                        <span className="lab-recipesFusionCardName">
                          {resolveLabVialDisplayName(vb)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  )
}
