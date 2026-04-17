import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDownAZ,
  ArrowDownUp,
  ArrowDownWideNarrow,
  Download,
  MoveLeft,
  MoveRight,
  Pencil,
  RefreshCcw,
  Trash2,
  Upload,
} from 'lucide-react'
import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'
import { STARTER_VIAL_DEFINITIONS } from '../data/starterVials'
import { gsap } from '../lib/gsap'
import { inferLabelFromRef } from '../lib/inferVialLabel'
import { applyLegacyVialIdRename } from '../lib/legacyVialIdRenames'
import { buildCraftedVialsTs } from '../lib/buildCraftedVialsSource'
import { pairKey } from '../lib/recipeMap'
import {
  AMBIGUOUS_NAME_ERROR,
  HALF_PAIR_ERROR,
  hasHalfFilledPair,
  hasPairConflict,
  hasSoloConflict,
} from '../lib/atelierValidation'
import type { LiquidTexture, Vial, VialType } from '../types'
import { RaColorPickerField } from '../components/recipeAtelier/RaColorPickerField'
import { VialFlaskGraphic } from '../components/vial/flask/VialFlaskGraphic'
import './recipeAtelier.css'

const STORAGE_KEY_PAIRS = 'alchemix-recipe-manager-pairs'
const STORAGE_KEY_SOLO = 'alchemix-recipe-manager-solo'
const STORAGE_KEY_HIDDEN_CATALOG_SOLO =
  'alchemix-recipe-manager-hidden-catalog-solo'

const WORKSHOP_MESSAGES = {
  ambiguousSameName: AMBIGUOUS_NAME_ERROR,
  halfPair: HALF_PAIR_ERROR,
  enterAtLeastResult: 'Enter at least the result.',
  enterBothIngredientsAndResult: 'Enter both ingredients and the result.',
  duplicateEmptyIngredients:
    'This entry already exists: same result with no combination.',
  duplicatePair:
    'This combination already exists: same ingredient pair (order does not matter).',
  enterReference: 'Enter a reference.',
  catalogAlreadyListed:
    'This reference is already covered: all catalog recipes are listed for it.',
  refAlreadyInElements: 'This reference is already in your element entries.',
  elementAdded: 'Element added.',
  pickIngredientsFromList: 'Pick ingredients that exist in the list.',
  enterCreatureName: 'Enter a creature name.',
  pickElementFromList: 'Pick an element that exists in the list.',
  recipeAdded: 'Recipe added.',
  creatureAdded: 'Creature added.',
  combinationRemoved: 'Combination removed.',
  catalogElementRemoved:
    'Element removed from the register (reload the store to see everything again).',
  entryRemoved: 'Entry removed.',
  dataResetFromSource: 'Data reset from source code.',
  craftedUpdated:
    'craftedVials updated directly in src/data. Restart the dev server if needed.',
  saveFailed:
    'Could not save in this context. Run with the local save API enabled.',
  exportReady: 'Register export downloaded.',
  exportFailed: 'Could not export the register.',
  importFailed: 'Could not import this file (invalid format).',
  importApplied: 'Register imported.',
  importEmptySelection: 'No file selected for import.',
  creatureNameRequired: 'Creature name is required.',
  creatureNameInvalid: 'Creature name is invalid.',
  resultRequired: 'Result is required.',
  pairRowClashEmpty:
    'Another row already has this result with no combination.',
  pairRowClashIngredients: 'Another row already uses this ingredient pair.',
  combinationUpdated: 'Combination updated.',
  soloNameEmpty: 'Name or reference is empty.',
  soloDuplicateInEntries:
    'This reference already exists in your element entries.',
  elementSaved: 'Element saved.',
  soloDuplicateAsElement: 'This reference already exists as an element.',
  referenceUpdated: 'Reference updated.',
  registerEditWrongTab:
    'This register row was opened under another tab. Click Edit again or pick the matching tab.',
} as const

export type EditablePair = {
  clientId: number
  a: string
  b: string
  resultId: string
}

export type EditableSolo = {
  clientId: number
  id: string
  /** Ligne dérivée du catalogue (type élément), sans entrée utilisateur */
  fromCatalog?: boolean
}

/** État modale : `catalogSourceId` si la ligne éditée venait du catalogue synthétique. */
type EditingSoloState = EditableSolo & { catalogSourceId?: string }

type RegistreDeletePrompt =
  | null
  | { kind: 'pair'; clientId: number }
  | { kind: 'solo'; solo: EditableSolo }

type CreateMode = 'element' | 'creature' | 'solo'
type SortKey = 'result' | 'pair' | 'type'

type RegistreRow =
  | { kind: 'pair'; data: EditablePair }
  | { kind: 'solo'; data: EditableSolo }

type VialPickOption = { id: string; name: string }
type VisualOverrideDraft = {
  primaryColor: string
  secondaryColor: string
  opacity: number
  texture: LiquidTexture
}
type RegisterExportPayloadV1 = {
  version: 1
  exportedAt: string
  pairs: EditablePair[]
  soloRows: EditableSolo[]
  hiddenCatalogSoloIds: string[]
  visualOverrides: Record<string, VisualOverrideDraft>
}

const COMBO_LIST_LIMIT = 120
const REGISTER_PAGE_SIZE = 50
const TEXTURE_OPTIONS: LiquidTexture[] = [
  'bubbles',
  'crystal',
  'drip',
  'ember',
  'flakes',
  'glow',
  'liquid',
  'mist',
  'ooze',
  'sheen',
  'smoke',
  'spark',
  'static',
  'swirl',
  'wave',
]

function textureDisplayLabel(t: LiquidTexture): string {
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

function anchorToDialogDelta(
  anchor: HTMLElement,
  dialog: HTMLElement,
): { dx: number; dy: number } {
  const ar = anchor.getBoundingClientRect()
  const dr = dialog.getBoundingClientRect()
  const ax = ar.left + ar.width / 2
  const ay = ar.top + ar.height / 2
  const cx = dr.left + dr.width / 2
  const cy = dr.top + dr.height / 2
  return { dx: ax - cx, dy: ay - cy }
}

function playActionModalOpen(
  overlay: HTMLElement,
  dialog: HTMLElement,
  anchor: HTMLElement,
) {
  const { dx, dy } = anchorToDialogDelta(anchor, dialog)
  gsap.killTweensOf([overlay, dialog])
  gsap.set(overlay, { opacity: 0 })
  gsap.set(dialog, {
    x: dx,
    y: dy,
    scale: 0.14,
    opacity: 0,
    transformOrigin: '50% 50%',
  })
  const tl = gsap.timeline()
  tl.to(overlay, { opacity: 1, duration: 0.34, ease: 'power1.out' }, 0)
  tl.to(
    dialog,
    {
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      duration: 0.38,
      ease: 'power2.out',
    },
    0,
  )
  return tl
}

function playActionModalClose(
  overlay: HTMLElement,
  dialog: HTMLElement,
  anchor: HTMLElement | null,
  onComplete: () => void,
) {
  gsap.killTweensOf([overlay, dialog])
  const tl = gsap.timeline({ onComplete })
  if (anchor) {
    const { dx, dy } = anchorToDialogDelta(anchor, dialog)
    tl.to(
      dialog,
      {
        x: dx,
        y: dy,
        scale: 0.14,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
      },
      0,
    )
    tl.to(overlay, { opacity: 0, duration: 0.3, ease: 'power1.in' }, 0.03)
    return tl
  }
  tl.to(
    dialog,
    {
      scale: 0.96,
      opacity: 0,
      duration: 0.22,
      ease: 'power1.in',
    },
    0,
  )
  tl.to(overlay, { opacity: 0, duration: 0.22, ease: 'power1.in' }, 0)
  return tl
}

/**
 * Champ texte + liste filtrée (comportement type sélecteur avec recherche par nom ou id).
 */
function VialOptionCombo({
  inputId,
  label,
  value,
  onChange,
  options,
  allowCustom = false,
  placeholder = 'Type to filter or pick…',
  autoComplete = 'off',
  compact = false,
}: {
  inputId: string
  label: ReactNode
  value: string
  onChange: (id: string) => void
  options: VialPickOption[]
  allowCustom?: boolean
  placeholder?: string
  autoComplete?: string
  compact?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [menuPos, setMenuPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const selectedLabel = useMemo(() => {
    const o = options.find((x) => x.id === value)
    return o?.name ?? (value ? inferLabelFromRef(value) : '')
  }, [options, value])

  const filtered = useMemo(() => {
    const q = (typing ? text : selectedLabel).trim().toLowerCase()
    if (!q) return options.slice(0, COMBO_LIST_LIMIT)
    return options
      .filter(
        (o) =>
          o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q),
      )
      .slice(0, COMBO_LIST_LIMIT)
  }, [options, text, typing, selectedLabel])

  const commitFromString = useCallback(
    (raw: string) => {
      const t = raw.trim()
      if (!t) {
        onChange('')
        setText('')
        return
      }
      const byName = options.find(
        (o) => o.name.localeCompare(t, 'en', { sensitivity: 'base' }) === 0,
      )
      if (byName) {
        onChange(byName.id)
        setText(byName.name)
        return
      }
      const byId = options.find((o) => o.id === t)
      if (byId) {
        onChange(byId.id)
        setText(byId.name)
        return
      }
      if (allowCustom) {
        onChange(t)
        setText(t)
        return
      }
      if (value) {
        const keep = options.find((o) => o.id === value)
        setText(keep?.name ?? inferLabelFromRef(value))
      } else {
        setText('')
      }
    },
    [allowCustom, options, value, onChange],
  )

  const pick = useCallback(
    (id: string) => {
      const o = options.find((x) => x.id === id)
      onChange(id)
      setText(o?.name ?? inferLabelFromRef(id))
      setOpen(false)
      setTyping(false)
    },
    [onChange, options],
  )

  const listId = `${inputId}-listbox`

  const updateMenuPos = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMenuPos({
      top: r.bottom + 2,
      left: r.left,
      width: r.width,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open || filtered.length === 0) return
    updateMenuPos()
    const onReposition = () => updateMenuPos()
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
    return () => {
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('resize', onReposition)
    }
  }, [open, filtered.length, updateMenuPos])

  const listNode =
    open &&
    filtered.length > 0 &&
    menuPos &&
    createPortal(
      <ul
        id={listId}
        className="ra-vialComboList"
        role="listbox"
        style={{
          position: 'fixed',
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          zIndex: 12_000,
        }}
      >
        {filtered.map((o) => (
          <li key={o.id} role="presentation">
            <button
              type="button"
              role="option"
              className="ra-vialComboOption"
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o.id)
              }}
            >
              <span className="ra-vialComboName">{o.name}</span>
            </button>
          </li>
        ))}
      </ul>,
      document.body,
    )

  return (
    <div
      className={
        compact ? 'ra-formGroup ra-formGroup--fieldRow' : 'ra-formGroup'
      }
    >
      <label htmlFor={inputId}>{label}</label>
      <div ref={wrapRef} className="ra-vialComboAnchor">
        <input
          id={inputId}
          type="text"
          className="ra-input"
          value={typing ? text : selectedLabel}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => {
            const v = e.target.value
            setText(v)
            setTyping(true)
            setOpen(true)
            if (value) {
              const cur = options.find((o) => o.id === value)
              if (
                cur &&
                v.localeCompare(cur.name, 'en', { sensitivity: 'base' }) !==
                  0
              ) {
                onChange('')
              }
            }
          }}
          onFocus={() => {
            setText(selectedLabel)
            setOpen(true)
          }}
          onBlur={(e) => {
            const rt = e.relatedTarget as Node | null
            if (rt && wrapRef.current?.contains(rt)) return
            const listEl = document.getElementById(listId)
            if (rt && listEl?.contains(rt)) return
            const raw = typing ? text : selectedLabel
            setTyping(false)
            setOpen(false)
            commitFromString(raw)
          }}
        />
      </div>
      {listNode}
    </div>
  )
}

/** Liste déroulante texture (pas de `<select>` natif : hover / focus = thème atelier). */
function TextureSelect({
  id,
  value,
  onChange,
  options,
}: {
  id: string
  value: LiquidTexture
  onChange: (t: LiquidTexture) => void
  options: readonly LiquidTexture[]
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const listId = `${id}-texture-listbox`

  const updateMenuPos = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMenuPos({
      top: r.bottom + 2,
      left: r.left,
      width: r.width,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPos()
    const onReposition = () => updateMenuPos()
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
    return () => {
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('resize', onReposition)
    }
  }, [open, updateMenuPos])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      const listEl = document.getElementById(listId)
      if (listEl?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [open, listId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const pick = useCallback(
    (t: LiquidTexture) => {
      onChange(t)
      setOpen(false)
    },
    [onChange],
  )

  const listNode =
    open &&
    menuPos &&
    createPortal(
      <ul
        id={listId}
        className="ra-vialComboList ra-textureComboList"
        role="listbox"
        aria-label="Textures"
        style={{
          position: 'fixed',
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          zIndex: 12_000,
        }}
      >
        {options.map((t) => (
          <li key={t} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={value === t}
              className="ra-vialComboOption"
              onMouseDown={(e) => {
                e.preventDefault()
                pick(t)
              }}
            >
              <span className="ra-vialComboName">
                {textureDisplayLabel(t)}
              </span>
            </button>
          </li>
        ))}
      </ul>,
      document.body,
    )

  return (
    <div ref={wrapRef} className="ra-vialComboAnchor">
      <button
        type="button"
        id={id}
        className="ra-input ra-select ra-textureSelectBtn"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen((o) => !o)
        }}
      >
        <span className="ra-textureSelectValue">
          {textureDisplayLabel(value)}
        </span>
      </button>
      {listNode}
    </div>
  )
}

function seedCraftedTemplatePairs(): EditablePair[] {
  const rows = Object.entries(CRAFTED_VIAL_TEMPLATES)
    .filter(
      ([id, t]) =>
        !!t.recipe || (t.recipes?.length ?? 0) > 0 || t.type === 'creature' || id.startsWith('creature-'),
    )
    .sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' }))

  const flatRows: Omit<EditablePair, 'clientId'>[] = []
  for (const [resultId, t] of rows) {
    const recipes = t.recipes?.length ? t.recipes : t.recipe ? [t.recipe] : []
    if (recipes.length === 0) {
      flatRows.push({ a: '', b: '', resultId })
      continue
    }
    for (const recipe of recipes) {
      flatRows.push({
        a: recipe.ingredientA ?? '',
        b: recipe.ingredientB ?? '',
        resultId,
      })
    }
  }
  return flatRows.map((row, i) => ({ ...row, clientId: i + 1 }))
}

/** Registre : uniquement les paires définies dans `craftedVials.ts` (catalogue seed). */
function seedPairs(): EditablePair[] {
  return seedCraftedTemplatePairs()
    .map(({ clientId: _c, ...rest }) => rest)
    .sort((x, y) =>
      x.resultId.localeCompare(y.resultId, 'en', { sensitivity: 'base' }),
    )
    .map((p, i) => ({ ...p, clientId: i + 1 }))
}

function seedSolo(): EditableSolo[] {
  const soloIds = Object.entries(CRAFTED_VIAL_TEMPLATES)
    .filter(([, t]) => t.type === 'element' && !t.recipe && !(t.recipes?.length))
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))

  return soloIds.map((id, i) => ({
    clientId: 10_000 + i,
    id,
  }))
}

function loadPairs(): EditablePair[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PAIRS)
    if (!raw) return seedPairs()
    const parsed = JSON.parse(raw) as EditablePair[]
    if (!Array.isArray(parsed)) return seedPairs()
    const normalized = parsed.map((row, i) => ({
      clientId: typeof row.clientId === 'number' ? row.clientId : i + 1,
      a: applyLegacyVialIdRename(String(row.a)),
      b: applyLegacyVialIdRename(String(row.b)),
      resultId: applyLegacyVialIdRename(String(row.resultId)),
    }))
    const hadLegacyIds = parsed.some((row) => {
      const a = String((row as EditablePair).a ?? '')
      const b = String((row as EditablePair).b ?? '')
      const r = String((row as EditablePair).resultId ?? '')
      return (
        applyLegacyVialIdRename(a) !== a ||
        applyLegacyVialIdRename(b) !== b ||
        applyLegacyVialIdRename(r) !== r
      )
    })
    const defaults = seedPairs()
    // Important: autoriser plusieurs recettes pour un même résultat.
    const existing = new Set(
      normalized.map((p) => `${pairKey(p.a, p.b)}|${p.resultId.trim()}`),
    )
    const nextClientId =
      normalized.reduce((m, p) => Math.max(m, p.clientId), 0) + 1
    const extra = defaults.filter(
      (p) => !existing.has(`${pairKey(p.a, p.b)}|${p.resultId.trim()}`),
    )
    const merged =
      extra.length === 0
        ? normalized
        : (() => {
            let cid = nextClientId
            return [...normalized, ...extra.map((p) => ({ ...p, clientId: cid++ }))]
          })()
    if (hadLegacyIds) {
      savePairs(merged)
    }
    return merged
  } catch {
    return seedPairs()
  }
}

function loadSolo(): EditableSolo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SOLO)
    if (!raw) return seedSolo()
    const parsed = JSON.parse(raw) as EditableSolo[]
    if (!Array.isArray(parsed)) return seedSolo()
    const hadLegacyIds = parsed.some(
      (row) =>
        applyLegacyVialIdRename(String((row as EditableSolo).id ?? '')) !==
        String((row as EditableSolo).id ?? ''),
    )
    const rows = parsed
      .map((row, i) => ({
        clientId: typeof row.clientId === 'number' ? row.clientId : 10_000 + i,
        id: applyLegacyVialIdRename(String(row.id ?? '')),
      }))
      .filter((r) => r.id)
    if (hadLegacyIds) {
      saveSolo(rows)
    }
    return rows
  } catch {
    return seedSolo()
  }
}

function savePairs(pairs: EditablePair[]) {
  localStorage.setItem(STORAGE_KEY_PAIRS, JSON.stringify(pairs))
}

function saveSolo(rows: EditableSolo[]) {
  localStorage.setItem(STORAGE_KEY_SOLO, JSON.stringify(rows))
}

function loadHiddenCatalogSoloIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HIDDEN_CATALOG_SOLO)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    if (!Array.isArray(parsed)) return []
    const strs = parsed.map(String)
    const migrated = strs.map(applyLegacyVialIdRename)
    if (migrated.some((id, i) => id !== strs[i])) {
      saveHiddenCatalogSoloIds(migrated)
    }
    return migrated
  } catch {
    return []
  }
}

function saveHiddenCatalogSoloIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEY_HIDDEN_CATALOG_SOLO, JSON.stringify(ids))
}

/** Empreinte du registre (pairs + solo + masques catalogue) pour détecter les changements sans faux positifs Strict Mode. */
function registerStateFingerprint(
  pairs: EditablePair[],
  soloRows: EditableSolo[],
  hiddenCatalogSoloIds: string[],
): string {
  return JSON.stringify({
    pairs,
    soloRows,
    hidden: [...hiddenCatalogSoloIds].sort(),
  })
}

function collectAllRecipeRefs(
  pairs: EditablePair[],
  soloRows: EditableSolo[],
): Set<string> {
  const s = new Set<string>()
  for (const p of pairs) {
    s.add(p.a)
    s.add(p.b)
    s.add(p.resultId)
  }
  for (const r of soloRows) {
    s.add(r.id)
  }
  return s
}

/**
 * Résout une saisie (nom affiché ou id technique) vers la référence enregistrée.
 */
function resolveRefFromDisplayInput(
  input: string,
  displayName: (id: string) => string,
  allIds: Set<string>,
): { ref: string; error?: 'empty' | 'ambiguous' } {
  const t = input.trim()
  if (!t) return { ref: '', error: 'empty' }

  if (allIds.has(t)) return { ref: t }

  const candidates: string[] = []
  for (const id of allIds) {
    const lab = displayName(id)
    if (lab.localeCompare(t, 'en', { sensitivity: 'base' }) === 0) {
      candidates.push(id)
    }
  }
  if (candidates.length === 1) return { ref: candidates[0]! }
  if (candidates.length > 1) return { ref: '', error: 'ambiguous' }
  return { ref: t }
}

function buildVialOptions(): { id: string; name: string; type: VialType }[] {
  const map = new Map<string, { id: string; name: string; type: VialType }>()
  for (const v of STARTER_VIAL_DEFINITIONS) {
    map.set(v.id, { id: v.id, name: v.name, type: v.type })
  }
  for (const [id, t] of Object.entries(CRAFTED_VIAL_TEMPLATES)) {
    map.set(id, { id, name: t.name, type: t.type })
  }
  return [...map.values()].sort((x, y) =>
    x.name.localeCompare(y.name, 'en', { sensitivity: 'base' }),
  )
}

function resultType(resultId: string): VialType | 'unknown' {
  const id = resultId.trim()
  if (!id) return 'unknown'

  const crafted = CRAFTED_VIAL_TEMPLATES[id]
  if (crafted) return crafted.type

  const starter = STARTER_VIAL_DEFINITIONS.find((v) => v.id === id)
  if (starter) return starter.type

  const lower = id.toLowerCase()
  if (lower.startsWith('creature-')) return 'creature'
  if (lower.startsWith('sp-')) return 'element'
  if (lower.startsWith('leg-')) return 'element'
  if (lower.startsWith('el-')) return 'element'
  if (lower.startsWith('craft-')) return 'element'

  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(id)) return 'element'

  return 'unknown'
}

function isCreatureResultId(resultId: string): boolean {
  return resultId.trim().startsWith('creature-')
}

/**
 * Créature avec un seul sort affiché en combinaison (a et b identiques et non vides).
 */
function isCreatureRecipePair(p: Pick<EditablePair, 'a' | 'b' | 'resultId'>): boolean {
  const a = p.a.trim()
  const b = p.b.trim()
  if (!a || !b) return false
  return isCreatureResultId(p.resultId) && a === b
}

function hasNoCombination(p: Pick<EditablePair, 'a' | 'b'>): boolean {
  return !p.a.trim() && !p.b.trim()
}

function slugifyCreatureName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const TYPE_ORDER: Record<string, number> = {
  element: 0,
  creature: 1,
  unknown: 2,
  fioleSeule: 3,
}

function compareRegistreRowsByResult(
  x: RegistreRow,
  y: RegistreRow,
  displayName: (id: string) => string,
): number {
  const nx =
    x.kind === 'solo'
      ? displayName(x.data.id)
      : displayName(x.data.resultId)
  const ny =
    y.kind === 'solo'
      ? displayName(y.data.id)
      : displayName(y.data.resultId)
  return nx.localeCompare(ny, 'en', { sensitivity: 'base' })
}

/** Paire (nom1, nom2) des libellés des ingrédients, ordre A/B indifférent. Élément seul : (nom, nom). */
function comboDisplaySortTuple(
  row: RegistreRow,
  displayName: (id: string) => string,
): [string, string] {
  if (row.kind === 'solo') {
    const n = displayName(row.data.id)
    return [n, n]
  }
  const na = displayName(row.data.a)
  const nb = displayName(row.data.b)
  if (na.localeCompare(nb, 'en', { sensitivity: 'base' }) <= 0) {
    return [na, nb]
  }
  return [nb, na]
}

/** Tri Combinaison : d’abord le 1er ingrédient (nom affiché), puis le 2e ; symétrique pour A/B. */
function compareRegistreRowsByPair(
  x: RegistreRow,
  y: RegistreRow,
  displayName: (id: string) => string,
): number {
  const [ax, ay] = comboDisplaySortTuple(x, displayName)
  const [bx, by] = comboDisplaySortTuple(y, displayName)
  const c1 = ax.localeCompare(bx, 'en', { sensitivity: 'base' })
  if (c1 !== 0) return c1
  return ay.localeCompare(by, 'en', { sensitivity: 'base' })
}

function compareRegistreRowsByType(
  x: RegistreRow,
  y: RegistreRow,
  displayName: (id: string) => string,
): number {
  const tx =
    x.kind === 'solo' ? 'fioleSeule' : resultType(x.data.resultId)
  const ty =
    y.kind === 'solo' ? 'fioleSeule' : resultType(y.data.resultId)
  const ox = TYPE_ORDER[tx] ?? 9
  const oy = TYPE_ORDER[ty] ?? 9
  if (ox !== oy) return ox - oy
  const nx =
    x.kind === 'solo'
      ? displayName(x.data.id)
      : displayName(x.data.resultId)
  const ny =
    y.kind === 'solo'
      ? displayName(y.data.id)
      : displayName(y.data.resultId)
  return nx.localeCompare(ny, 'en', { sensitivity: 'base' })
}

/** Plusieurs critères : appliqués dans l’ordre du tableau (priorité décroissante). */
function compareRegistreRowsByKeys(
  x: RegistreRow,
  y: RegistreRow,
  keys: SortKey[],
  displayName: (id: string) => string,
): number {
  for (const key of keys) {
    let c = 0
    if (key === 'result') {
      c = compareRegistreRowsByResult(x, y, displayName)
    } else if (key === 'pair') {
      c = compareRegistreRowsByPair(x, y, displayName)
    } else {
      c = compareRegistreRowsByType(x, y, displayName)
    }
    if (c !== 0) return c
  }
  return 0
}

function stableCatalogSoloClientId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i)
  }
  return -Math.abs(h | 0)
}

function visualFromTemplate(id: string): VisualOverrideDraft {
  const t = CRAFTED_VIAL_TEMPLATES[id]
  if (t?.type === 'element' && t.liquid) {
    return {
      primaryColor: t.liquid.primaryColor ?? '#ffffff',
      secondaryColor: t.liquid.secondaryColor ?? '',
      opacity: t.liquid.opacity ?? 0.85,
      texture: t.liquid.texture ?? 'liquid',
    }
  }
  const starter = STARTER_VIAL_DEFINITIONS.find(
    (v) => v.id === id && v.type === 'element',
  )
  if (starter?.liquid) {
    return {
      primaryColor: starter.liquid.primaryColor ?? '#ffffff',
      secondaryColor: starter.liquid.secondaryColor ?? '',
      opacity: starter.liquid.opacity ?? 0.85,
      texture: starter.liquid.texture ?? 'liquid',
    }
  }
  return {
    primaryColor: t?.liquid?.primaryColor ?? '#ffffff',
    secondaryColor: t?.liquid?.secondaryColor ?? '',
    opacity: t?.liquid?.opacity ?? 0.85,
    texture: t?.liquid?.texture ?? 'liquid',
  }
}

type AlertItem = { id: number; message: string; kind: 'success' | 'error' }

export function RecipeManagerPage() {
  const navigate = useNavigate()
  const vialOptions = useMemo(() => buildVialOptions(), [])
  const ingredientOptions = useMemo(
    () => vialOptions.filter((v) => v.type !== 'creature'),
    [vialOptions],
  )
  const elementOptions = useMemo(
    () => vialOptions.filter((v) => v.type === 'element'),
    [vialOptions],
  )
  const knownVialIdSet = useMemo(
    () => new Set(vialOptions.map((v) => v.id)),
    [vialOptions],
  )
  const knownElementIdSet = useMemo(
    () => new Set(elementOptions.map((v) => v.id)),
    [elementOptions],
  )

  const catalogElementIds = useMemo(() => {
    const starters = STARTER_VIAL_DEFINITIONS.filter((v) => v.type === 'element')
    const nameById = new Map(starters.map((v) => [v.id, v.name]))
    return starters
      .map((v) => v.id)
      .sort((a, b) =>
        (nameById.get(a) ?? inferLabelFromRef(a)).localeCompare(
          nameById.get(b) ?? inferLabelFromRef(b),
          'en',
          { sensitivity: 'base' },
        ),
      )
  }, [])

  const [pairs, setPairs] = useState<EditablePair[]>(() => loadPairs())
  const [soloRows, setSoloRows] = useState<EditableSolo[]>(() => loadSolo())
  const [search, setSearch] = useState('')
  const [activeSortKeys, setActiveSortKeys] = useState<SortKey[]>(['result'])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [editingPair, setEditingPair] = useState<EditablePair | null>(null)
  const [editingSolo, setEditingSolo] = useState<EditingSoloState | null>(null)
  const [registreDeletePrompt, setRegistreDeletePrompt] =
    useState<RegistreDeletePrompt>(null)
  const [hiddenCatalogSoloIds, setHiddenCatalogSoloIds] = useState<string[]>(
    () => loadHiddenCatalogSoloIds(),
  )
  const pairsRef = useRef<EditablePair[]>(pairs)
  pairsRef.current = pairs
  const soloRowsRef = useRef<EditableSolo[]>(soloRows)
  soloRowsRef.current = soloRows
  const hiddenCatalogSoloIdsRef = useRef<string[]>(hiddenCatalogSoloIds)
  hiddenCatalogSoloIdsRef.current = hiddenCatalogSoloIds

  const [createMode, setCreateMode] = useState<CreateMode>('element')
  const [elA, setElA] = useState('')
  const [elB, setElB] = useState('')
  /** Nom affiché ou id technique ; résolu vers une référence à la soumission. */
  const [elResultInput, setElResultInput] = useState('')
  const [elPrimaryColor, setElPrimaryColor] = useState('#ffffff')
  const [elSecondaryColor, setElSecondaryColor] = useState('')
  const [elOpacity, setElOpacity] = useState('0.85')
  const [elTexture, setElTexture] = useState<LiquidTexture>('liquid')
  const [crElement, setCrElement] = useState('')
  const [crName, setCrName] = useState('')
  const [soloIdInput, setSoloIdInput] = useState('')
  const [visualOverrides, setVisualOverrides] = useState<
    Record<string, VisualOverrideDraft>
  >({})
  const [backConfirmOpen, setBackConfirmOpen] = useState(false)
  const [registerPage, setRegisterPage] = useState(1)
  const [registerReady, setRegisterReady] = useState(false)
  const registerBaselineRef = useRef<string | null>(null)
  const registerLoadTokenRef = useRef(0)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const registerTableScrollRef = useRef<HTMLDivElement>(null)
  const backNavLinkRef = useRef<HTMLAnchorElement>(null)
  const importFileInputRef = useRef<HTMLInputElement>(null)
  const modalAnchorRef = useRef<HTMLElement | null>(null)
  const deleteOverlayRef = useRef<HTMLDivElement>(null)
  const deleteDialogRef = useRef<HTMLDivElement>(null)
  const backConfirmOverlayRef = useRef<HTMLDivElement>(null)
  const backConfirmDialogRef = useRef<HTMLDivElement>(null)
  const deleteClosingRef = useRef(false)
  const backConfirmClosingRef = useRef(false)

  const rememberModalAnchor = useCallback((target: EventTarget | null) => {
    modalAnchorRef.current = target instanceof HTMLElement ? target : null
  }, [])

  const requestCloseDeletePrompt = useCallback(
    (afterClose?: () => void) => {
      if (deleteClosingRef.current || !registreDeletePrompt) return
      const overlay = deleteOverlayRef.current
      const dialog = deleteDialogRef.current
      const anchor = modalAnchorRef.current
      if (!overlay || !dialog) {
        setRegistreDeletePrompt(null)
        afterClose?.()
        return
      }
      deleteClosingRef.current = true
      playActionModalClose(overlay, dialog, anchor, () => {
        deleteClosingRef.current = false
        setRegistreDeletePrompt(null)
        afterClose?.()
      })
    },
    [registreDeletePrompt],
  )

  const requestCloseBackConfirm = useCallback(
    (afterClose?: () => void) => {
      if (backConfirmClosingRef.current || !backConfirmOpen) return
      const overlay = backConfirmOverlayRef.current
      const dialog = backConfirmDialogRef.current
      const anchor = backNavLinkRef.current
      if (!overlay || !dialog) {
        setBackConfirmOpen(false)
        afterClose?.()
        return
      }
      backConfirmClosingRef.current = true
      playActionModalClose(overlay, dialog, anchor, () => {
        backConfirmClosingRef.current = false
        setBackConfirmOpen(false)
        afterClose?.()
      })
    },
    [backConfirmOpen],
  )

  useLayoutEffect(() => {
    if (!registreDeletePrompt) return
    const anchor = modalAnchorRef.current
    const overlay = deleteOverlayRef.current
    const dialog = deleteDialogRef.current
    if (!anchor || !overlay || !dialog) return
    const tl = playActionModalOpen(overlay, dialog, anchor)
    return () => {
      tl.kill()
    }
  }, [registreDeletePrompt])

  useLayoutEffect(() => {
    if (!backConfirmOpen) return
    const anchor = backNavLinkRef.current
    const overlay = backConfirmOverlayRef.current
    const dialog = backConfirmDialogRef.current
    if (!overlay || !dialog) return
    if (!anchor) {
      gsap.killTweensOf([overlay, dialog])
      gsap.set(overlay, { opacity: 0 })
      gsap.set(dialog, { scale: 0.96, opacity: 0, transformOrigin: '50% 50%' })
      const tl = gsap.timeline()
      tl.to(overlay, { opacity: 1, duration: 0.24, ease: 'power1.out' }, 0)
      tl.to(
        dialog,
        { scale: 1, opacity: 1, duration: 0.26, ease: 'power2.out' },
        0,
      )
      return () => {
        tl.kill()
      }
    }
    const tl = playActionModalOpen(overlay, dialog, anchor)
    return () => {
      tl.kill()
    }
  }, [backConfirmOpen])

  useEffect(() => {
    const btn = addBtnRef.current
    if (!btn) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const onEnter = () => {
      gsap.to(btn, {
        y: -1,
        scale: 1.015,
        duration: 0.16,
        ease: 'power2.out',
      })
    }
    const onLeave = () => {
      gsap.to(btn, {
        y: 0,
        scale: 1,
        duration: 0.16,
        ease: 'power2.out',
      })
    }
    btn.addEventListener('mouseenter', onEnter)
    btn.addEventListener('mouseleave', onLeave)
    return () => {
      btn.removeEventListener('mouseenter', onEnter)
      btn.removeEventListener('mouseleave', onLeave)
      gsap.killTweensOf(btn)
      gsap.set(btn, { clearProps: 'transform' })
    }
  }, [])

  const triggerRegisterLoading = useCallback(() => {
    type IdleCb = () => void
    type IdleWin = Window & {
      requestIdleCallback?: (cb: IdleCb, opts?: { timeout: number }) => number
    }
    setRegisterReady(false)
    const token = ++registerLoadTokenRef.current
    const done = () => {
      if (registerLoadTokenRef.current !== token) return
      setRegisterReady(true)
    }
    const w = window as IdleWin
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(done, { timeout: 220 })
      return
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.setTimeout(done, 80)
      })
    })
  }, [])

  useEffect(() => {
    triggerRegisterLoading()
    return () => {
      registerLoadTokenRef.current += 1
    }
  }, [triggerRegisterLoading])

  const registerFingerprint = useMemo(
    () => registerStateFingerprint(pairs, soloRows, hiddenCatalogSoloIds),
    [pairs, soloRows, hiddenCatalogSoloIds],
  )

  useLayoutEffect(() => {
    if (registerBaselineRef.current === null) {
      registerBaselineRef.current = registerFingerprint
    }
  }, [registerFingerprint])

  const baseline = registerBaselineRef.current
  const hasRegisterChanges =
    baseline !== null && registerFingerprint !== baseline

  const pushAlert = useCallback((message: string, kind: AlertItem['kind']) => {
    const id = Date.now()
    setAlerts((prev) => [...prev, { id, message, kind }])
    window.setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    }, 2200)
  }, [])

  const upsertVisualOverride = useCallback(
    (
      resultId: string,
      raw: {
        primaryColor: string
        secondaryColor: string
        opacity: string | number
        texture: LiquidTexture
      },
    ) => {
      const id = resultId.trim()
      if (!id) return
      const parsedOpacity =
        typeof raw.opacity === 'number' ? raw.opacity : Number(raw.opacity)
      const opacity = Number.isFinite(parsedOpacity)
        ? Math.min(1, Math.max(0, parsedOpacity))
        : 0.85
      const next: VisualOverrideDraft = {
        primaryColor: raw.primaryColor.trim() || '#ffffff',
        secondaryColor: raw.secondaryColor.trim(),
        opacity,
        texture: raw.texture,
      }
      setVisualOverrides((prev) => ({ ...prev, [id]: next }))
    },
    [],
  )

  useEffect(() => {
    savePairs(pairs)
  }, [pairs])

  useEffect(() => {
    saveSolo(soloRows)
  }, [soloRows])

  useEffect(() => {
    saveHiddenCatalogSoloIds(hiddenCatalogSoloIds)
  }, [hiddenCatalogSoloIds])

  useEffect(() => {
    const flushNow = () => {
      savePairs(pairsRef.current)
      saveSolo(soloRowsRef.current)
      saveHiddenCatalogSoloIds(hiddenCatalogSoloIdsRef.current)
    }
    window.addEventListener('beforeunload', flushNow)
    return () => window.removeEventListener('beforeunload', flushNow)
  }, [])

  const vialNameById = useMemo(() => {
    const out = new Map<string, string>()
    for (const option of vialOptions) out.set(option.id, option.name)
    return out
  }, [vialOptions])
  const displayName = useCallback(
    (id: string) => vialNameById.get(id) ?? inferLabelFromRef(id),
    [vialNameById],
  )
  const toggleSortKey = useCallback((key: SortKey) => {
    setActiveSortKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }, [])

  const allKnownVialIds = useMemo(() => {
    const s = new Set<string>(vialOptions.map((o) => o.id))
    for (const id of collectAllRecipeRefs(pairs, soloRows)) {
      s.add(id)
    }
    return s
  }, [vialOptions, pairs, soloRows])

  const catalogElementIdSet = useMemo(
    () => new Set(catalogElementIds),
    [catalogElementIds],
  )

  const nextClientId = useCallback(() => {
    const fromPairs = pairs.reduce((m, p) => Math.max(m, p.clientId), 0)
    const fromSolo = soloRows.reduce((m, s) => Math.max(m, s.clientId), 0)
    return Math.max(fromPairs, fromSolo) + 1
  }, [pairs, soloRows])

  const hiddenCatalogSet = useMemo(
    () => new Set(hiddenCatalogSoloIds),
    [hiddenCatalogSoloIds],
  )

  /** Fioles seules : entrée utilisateur prime ; sinon ligne catalogue si non masquée ; puis extras hors catalogue. */
  const mergedSoloEntries = useMemo((): EditableSolo[] => {
    const userById = new Map(soloRows.map((s) => [s.id, s]))
    const out: EditableSolo[] = []
    for (const id of catalogElementIds) {
      const user = userById.get(id)
      if (user) {
        out.push({ ...user, fromCatalog: false })
      } else if (!hiddenCatalogSet.has(id)) {
        out.push({
          id,
          clientId: stableCatalogSoloClientId(id),
          fromCatalog: true,
        })
      }
    }
    for (const s of soloRows) {
      if (!catalogElementIdSet.has(s.id)) {
        out.push({ ...s, fromCatalog: false })
      }
    }
    return out
  }, [
    catalogElementIds,
    catalogElementIdSet,
    soloRows,
    hiddenCatalogSet,
  ])

  const allRows = useMemo((): RegistreRow[] => {
    const solo: RegistreRow[] = mergedSoloEntries.map((data) => ({
      kind: 'solo',
      data,
    }))
    const pr: RegistreRow[] = pairs.map((data) => ({ kind: 'pair', data }))
    return [...solo, ...pr]
  }, [pairs, mergedSoloEntries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = allRows
    if (q) {
      list = list.filter((row) => {
        if (row.kind === 'solo') {
          const id = row.data.id.toLowerCase()
          const name = displayName(row.data.id).toLowerCase()
          return id.includes(q) || name.includes(q)
        }
        const p = row.data
        const ta = displayName(p.a).toLowerCase()
        const tb = displayName(p.b).toLowerCase()
        const tr = displayName(p.resultId).toLowerCase()
        return (
          p.a.toLowerCase().includes(q) ||
          p.b.toLowerCase().includes(q) ||
          p.resultId.toLowerCase().includes(q) ||
          ta.includes(q) ||
          tb.includes(q) ||
          tr.includes(q)
        )
      })
    }
    const sorted = [...list]
    if (activeSortKeys.length === 0) {
      return sorted
    }
    sorted.sort((x, y) =>
      compareRegistreRowsByKeys(x, y, activeSortKeys, displayName),
    )
    return sorted
  }, [allRows, search, activeSortKeys, displayName])

  useEffect(() => {
    setRegisterPage(1)
  }, [search, activeSortKeys])

  const registerTotalPages = Math.max(
    1,
    Math.ceil(filtered.length / REGISTER_PAGE_SIZE),
  )

  useEffect(() => {
    setRegisterPage((p) => Math.min(p, registerTotalPages))
  }, [registerTotalPages])

  const safeRegisterPage = Math.min(registerPage, registerTotalPages)
  const registerPageStart = (safeRegisterPage - 1) * REGISTER_PAGE_SIZE
  const paginatedRegisterRows = useMemo(
    () => filtered.slice(registerPageStart, registerPageStart + REGISTER_PAGE_SIZE),
    [filtered, registerPageStart],
  )

  useEffect(() => {
    registerTableScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [safeRegisterPage])

  const elOpacitySliderValue = useMemo(() => {
    const raw = Number(elOpacity)
    return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.85
  }, [elOpacity])

  const elementPreviewVial = useMemo((): Vial | null => {
    if (createMode !== 'element') return null
    const parsedOpacity = Number(elOpacity)
    const opacity = Number.isFinite(parsedOpacity)
      ? Math.min(1, Math.max(0, parsedOpacity))
      : 0.85
    const resolved = resolveRefFromDisplayInput(
      elResultInput,
      displayName,
      allKnownVialIds,
    )
    const resultId =
      resolved.error === 'ambiguous' || !resolved.ref.trim()
        ? 'preview-element'
        : resolved.ref.trim()
    const secondary = elSecondaryColor.trim()
    return {
      id: resultId,
      type: 'element',
      name: inferLabelFromRef(resultId),
      description: '',
      liquid: {
        primaryColor: elPrimaryColor.trim() || '#ffffff',
        ...(secondary ? { secondaryColor: secondary } : {}),
        opacity,
        texture: elTexture,
      },
      icon: 'rune',
      discoveredAt: '1970-01-01T00:00:00.000Z',
      rarity: 'common',
    }
  }, [
    createMode,
    elOpacity,
    elResultInput,
    elPrimaryColor,
    elSecondaryColor,
    elTexture,
    displayName,
    allKnownVialIds,
  ])

  const stats = useMemo(() => {
    let elements = 0
    let creatures = 0
    for (const p of pairs) {
      const t = resultType(p.resultId)
      if (t === 'element') elements += 1
      else if (t === 'creature') creatures += 1
    }
    return {
      totalRows: pairs.length + mergedSoloEntries.length,
      pairs: pairs.length,
      fiolesSeules: mergedSoloEntries.length,
      elements,
      creatures,
    }
  }, [pairs, mergedSoloEntries])

  const tryAddPair = useCallback(
    (
      a: string,
      b: string,
      resultId: string,
      successMsg: string,
      options?: { allowEmptyIngredients?: boolean },
    ) => {
      const ta = a.trim()
      const tb = b.trim()
      const tr = resultId.trim()
      const allowEmpty = options?.allowEmptyIngredients ?? false

      if (!tr) {
        pushAlert(
          allowEmpty
            ? WORKSHOP_MESSAGES.enterAtLeastResult
            : WORKSHOP_MESSAGES.enterBothIngredientsAndResult,
          'error',
        )
        return false
      }

      if (!allowEmpty) {
        if (!ta || !tb) {
          pushAlert(WORKSHOP_MESSAGES.enterBothIngredientsAndResult, 'error')
          return false
        }
      } else if (hasHalfFilledPair(ta, tb)) {
        pushAlert(WORKSHOP_MESSAGES.halfPair, 'error')
        return false
      }

      const dup = hasPairConflict(pairs, ta, tb, tr)
      if (dup) {
        pushAlert(
          ta === '' && tb === ''
            ? WORKSHOP_MESSAGES.duplicateEmptyIngredients
            : WORKSHOP_MESSAGES.duplicatePair,
          'error',
        )
        return false
      }
      setPairs((prev) => [
        ...prev,
        { clientId: nextClientId(), a: ta, b: tb, resultId: tr },
      ])
      pushAlert(successMsg, 'success')
      return true
    },
    [pairs, nextClientId, pushAlert],
  )

  const tryAddSolo = useCallback(() => {
    const resolved = resolveRefFromDisplayInput(
      soloIdInput,
      displayName,
      allKnownVialIds,
    )
    if (resolved.error === 'empty' || !resolved.ref.trim()) {
      pushAlert(WORKSHOP_MESSAGES.enterReference, 'error')
      return
    }
    if (resolved.error === 'ambiguous') {
      pushAlert(WORKSHOP_MESSAGES.ambiguousSameName, 'error')
      return
    }
    const norm = resolved.ref.trim()
    if (catalogElementIdSet.has(norm)) {
      pushAlert(WORKSHOP_MESSAGES.catalogAlreadyListed, 'error')
      return
    }
    if (hasSoloConflict(soloRows, norm)) {
      pushAlert(WORKSHOP_MESSAGES.refAlreadyInElements, 'error')
      return
    }
    setSoloRows((prev) => [
      ...prev,
      { clientId: nextClientId(), id: norm },
    ])
    setSoloIdInput('')
    pushAlert(WORKSHOP_MESSAGES.elementAdded, 'success')
  }, [
    soloIdInput,
    soloRows,
    nextClientId,
    pushAlert,
    catalogElementIdSet,
    hasSoloConflict,
    displayName,
    allKnownVialIds,
  ])

  const resetMainFormFields = useCallback(() => {
    setElA('')
    setElB('')
    setElResultInput('')
    setElPrimaryColor('#ffffff')
    setElSecondaryColor('')
    setElOpacity('0.85')
    setElTexture('liquid')
    setCrElement('')
    setCrName('')
    setSoloIdInput('')
  }, [])

  const handleElementResultChange = useCallback(
    (value: string) => {
      setElResultInput(value)
      const resolved = resolveRefFromDisplayInput(
        value,
        displayName,
        allKnownVialIds,
      )
      if (resolved.error || !resolved.ref.trim()) return
      const ref = resolved.ref.trim()
      if (!knownElementIdSet.has(ref)) return
      const vis = visualOverrides[ref] ?? visualFromTemplate(ref)
      setElPrimaryColor(vis.primaryColor)
      setElSecondaryColor(vis.secondaryColor)
      setElOpacity(String(vis.opacity))
      setElTexture(vis.texture)
    },
    [allKnownVialIds, displayName, knownElementIdSet, visualOverrides],
  )

  const exitRegisterRowEdit = useCallback(() => {
    setEditingPair(null)
    setEditingSolo(null)
    resetMainFormFields()
  }, [resetMainFormFields])

  const handleAddSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      switch (createMode) {
        case 'element': {
          if (editingSolo) {
            const resolved = resolveRefFromDisplayInput(
              elResultInput,
              displayName,
              allKnownVialIds,
            )
            if (resolved.error === 'empty' || !resolved.ref.trim()) {
              pushAlert(WORKSHOP_MESSAGES.soloNameEmpty, 'error')
              return
            }
            if (resolved.error === 'ambiguous') {
              pushAlert(WORKSHOP_MESSAGES.ambiguousSameName, 'error')
              return
            }
            const newId = resolved.ref.trim()
            const src = editingSolo.catalogSourceId

            if (src) {
              if (hasSoloConflict(soloRows, newId)) {
                pushAlert(WORKSHOP_MESSAGES.soloDuplicateInEntries, 'error')
                return
              }
              setHiddenCatalogSoloIds((prev) =>
                prev.includes(src) ? prev : [...prev, src],
              )
              setSoloRows((prev) => [
                ...prev,
                { clientId: nextClientId(), id: newId },
              ])
              exitRegisterRowEdit()
              pushAlert(WORKSHOP_MESSAGES.elementSaved, 'success')
              return
            }

            const clash = hasSoloConflict(soloRows, newId, editingSolo.clientId)
            if (clash) {
              pushAlert(WORKSHOP_MESSAGES.soloDuplicateAsElement, 'error')
              return
            }
            setSoloRows((prev) =>
              prev.map((s) =>
                s.clientId === editingSolo.clientId ? { ...s, id: newId } : s,
              ),
            )
            exitRegisterRowEdit()
            pushAlert(WORKSHOP_MESSAGES.referenceUpdated, 'success')
            return
          }
          if (editingPair) {
            if (isCreatureResultId(editingPair.resultId)) {
              pushAlert(WORKSHOP_MESSAGES.registerEditWrongTab, 'error')
              return
            }
            const ta = elA.trim()
            const tb = elB.trim()
            const rr = resolveRefFromDisplayInput(
              elResultInput,
              displayName,
              allKnownVialIds,
            )
            if (rr.error === 'empty' || !rr.ref.trim()) {
              pushAlert(WORKSHOP_MESSAGES.resultRequired, 'error')
              return
            }
            if (rr.error === 'ambiguous') {
              pushAlert(WORKSHOP_MESSAGES.ambiguousSameName, 'error')
              return
            }
            const tr = rr.ref.trim()
            if ((ta && !knownVialIdSet.has(ta)) || (tb && !knownVialIdSet.has(tb))) {
              pushAlert(WORKSHOP_MESSAGES.pickIngredientsFromList, 'error')
              return
            }
            if (hasHalfFilledPair(ta, tb)) {
              pushAlert(WORKSHOP_MESSAGES.halfPair, 'error')
              return
            }
            if (hasPairConflict(pairs, ta, tb, tr, editingPair.clientId)) {
              pushAlert(
                ta === '' && tb === ''
                  ? WORKSHOP_MESSAGES.pairRowClashEmpty
                  : WORKSHOP_MESSAGES.pairRowClashIngredients,
                'error',
              )
              return
            }
            const clientId = editingPair.clientId
            setPairs((prev) =>
              prev.map((p) =>
                p.clientId === clientId ? { ...p, a: ta, b: tb, resultId: tr } : p,
              ),
            )
            upsertVisualOverride(tr, {
              primaryColor: elPrimaryColor,
              secondaryColor: elSecondaryColor,
              opacity: elOpacity,
              texture: elTexture,
            })
            exitRegisterRowEdit()
            pushAlert(WORKSHOP_MESSAGES.combinationUpdated, 'success')
            return
          }
          const taAdd = elA.trim()
          const tbAdd = elB.trim()
          if ((taAdd && !knownVialIdSet.has(taAdd)) || (tbAdd && !knownVialIdSet.has(tbAdd))) {
            pushAlert(WORKSHOP_MESSAGES.pickIngredientsFromList, 'error')
            return
          }
          const rrAdd = resolveRefFromDisplayInput(
            elResultInput,
            displayName,
            allKnownVialIds,
          )
          if (rrAdd.error === 'empty' || !rrAdd.ref.trim()) {
            pushAlert(WORKSHOP_MESSAGES.resultRequired, 'error')
            return
          }
          if (rrAdd.error === 'ambiguous') {
            pushAlert(WORKSHOP_MESSAGES.ambiguousSameName, 'error')
            return
          }
          const trAdd = rrAdd.ref.trim()
          if (
            tryAddPair(elA, elB, trAdd, WORKSHOP_MESSAGES.recipeAdded, {
              allowEmptyIngredients: true,
            })
          ) {
            upsertVisualOverride(trAdd, {
              primaryColor: elPrimaryColor,
              secondaryColor: elSecondaryColor,
              opacity: elOpacity,
              texture: elTexture,
            })
            setElA('')
            setElB('')
            setElResultInput('')
            setElPrimaryColor('#ffffff')
            setElSecondaryColor('')
            setElOpacity('0.85')
            setElTexture('liquid')
          }
          break
        }
        case 'creature': {
          if (editingPair) {
            if (!isCreatureResultId(editingPair.resultId)) {
              pushAlert(WORKSHOP_MESSAGES.registerEditWrongTab, 'error')
              return
            }
            const raw = crName.trim()
            if (!raw) {
              pushAlert(WORKSHOP_MESSAGES.creatureNameRequired, 'error')
              return
            }
            const lower = raw.toLowerCase()
            const base = lower.startsWith('creature-')
              ? raw.slice('creature-'.length)
              : raw
            const slug = slugifyCreatureName(base)
            if (!slug) {
              pushAlert(WORKSHOP_MESSAGES.creatureNameInvalid, 'error')
              return
            }
            const tr = `creature-${slug}`
            const element = crElement.trim()
            if (element && !knownElementIdSet.has(element)) {
              pushAlert(WORKSHOP_MESSAGES.pickElementFromList, 'error')
              return
            }
            const ta = element
            const tb = element
            if (hasHalfFilledPair(ta, tb)) {
              pushAlert(WORKSHOP_MESSAGES.halfPair, 'error')
              return
            }
            if (hasPairConflict(pairs, ta, tb, tr, editingPair.clientId)) {
              pushAlert(
                ta === '' && tb === ''
                  ? WORKSHOP_MESSAGES.pairRowClashEmpty
                  : WORKSHOP_MESSAGES.pairRowClashIngredients,
                'error',
              )
              return
            }
            const clientId = editingPair.clientId
            setPairs((prev) =>
              prev.map((p) =>
                p.clientId === clientId ? { ...p, a: ta, b: tb, resultId: tr } : p,
              ),
            )
            exitRegisterRowEdit()
            pushAlert(WORKSHOP_MESSAGES.combinationUpdated, 'success')
            return
          }
          const slug = slugifyCreatureName(crName)
          if (!slug) {
            pushAlert(WORKSHOP_MESSAGES.enterCreatureName, 'error')
            return
          }
          const element = crElement.trim()
          if (element && !knownElementIdSet.has(element)) {
            pushAlert(WORKSHOP_MESSAGES.pickElementFromList, 'error')
            return
          }
          const resultId = `creature-${slug}`
          if (
            tryAddPair(
              element,
              element,
              resultId,
              WORKSHOP_MESSAGES.creatureAdded,
              { allowEmptyIngredients: true },
            )
          ) {
            setCrElement('')
            setCrName('')
          }
          break
        }
        case 'solo': {
          if (editingSolo) {
            const resolved = resolveRefFromDisplayInput(
              soloIdInput,
              displayName,
              allKnownVialIds,
            )
            if (resolved.error === 'empty' || !resolved.ref.trim()) {
              pushAlert(WORKSHOP_MESSAGES.soloNameEmpty, 'error')
              return
            }
            if (resolved.error === 'ambiguous') {
              pushAlert(WORKSHOP_MESSAGES.ambiguousSameName, 'error')
              return
            }
            const newId = resolved.ref.trim()
            const src = editingSolo.catalogSourceId

            if (src) {
              if (hasSoloConflict(soloRows, newId)) {
                pushAlert(WORKSHOP_MESSAGES.soloDuplicateInEntries, 'error')
                return
              }
              setHiddenCatalogSoloIds((prev) =>
                prev.includes(src) ? prev : [...prev, src],
              )
              setSoloRows((prev) => [
                ...prev,
                { clientId: nextClientId(), id: newId },
              ])
              exitRegisterRowEdit()
              pushAlert(WORKSHOP_MESSAGES.elementSaved, 'success')
              return
            }

            const clash = hasSoloConflict(soloRows, newId, editingSolo.clientId)
            if (clash) {
              pushAlert(WORKSHOP_MESSAGES.soloDuplicateAsElement, 'error')
              return
            }
            setSoloRows((prev) =>
              prev.map((s) =>
                s.clientId === editingSolo.clientId ? { ...s, id: newId } : s,
              ),
            )
            exitRegisterRowEdit()
            pushAlert(WORKSHOP_MESSAGES.referenceUpdated, 'success')
            return
          }
          tryAddSolo()
          break
        }
      }
    },
    [
      createMode,
      tryAddPair,
      tryAddSolo,
      elA,
      elB,
      elResultInput,
      elPrimaryColor,
      elSecondaryColor,
      elOpacity,
      elTexture,
      crElement,
      crName,
      soloIdInput,
      pushAlert,
      knownVialIdSet,
      knownElementIdSet,
      upsertVisualOverride,
      editingPair,
      editingSolo,
      pairs,
      soloRows,
      displayName,
      allKnownVialIds,
      nextClientId,
      exitRegisterRowEdit,
    ],
  )

  const removeRegistrePair = useCallback(
    (clientId: number) => {
      setPairs((prev) => prev.filter((row) => row.clientId !== clientId))
      pushAlert(WORKSHOP_MESSAGES.combinationRemoved, 'success')
    },
    [pushAlert],
  )

  const removeRegistreSolo = useCallback(
    (s: EditableSolo) => {
      if (s.fromCatalog) {
        setHiddenCatalogSoloIds((prev) =>
          prev.includes(s.id) ? prev : [...prev, s.id],
        )
        pushAlert(WORKSHOP_MESSAGES.catalogElementRemoved, 'success')
        return
      }
      setSoloRows((prev) => prev.filter((r) => r.clientId !== s.clientId))
      pushAlert(WORKSHOP_MESSAGES.entryRemoved, 'success')
    },
    [pushAlert],
  )

  const resetDefaults = useCallback(() => {
    registerBaselineRef.current = null
    triggerRegisterLoading()
    setPairs(seedPairs())
    setSoloRows(seedSolo())
    setHiddenCatalogSoloIds([])
    pushAlert(WORKSHOP_MESSAGES.dataResetFromSource, 'success')
  }, [pushAlert, triggerRegisterLoading])

  const saveToSourceFiles = useCallback(async () => {
    const craftedTs = buildCraftedVialsTs(pairs, soloRows, visualOverrides)

    try {
      const res = await fetch('/api/save-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ craftedTs }),
      })
      if (res.ok) {
        registerBaselineRef.current = registerStateFingerprint(
          pairs,
          soloRows,
          hiddenCatalogSoloIds,
        )
        pushAlert(WORKSHOP_MESSAGES.craftedUpdated, 'success')
        return
      }
    } catch {
      // Fallback handled below for non-dev contexts.
    }

    pushAlert(WORKSHOP_MESSAGES.saveFailed, 'error')
  }, [
    pairs,
    soloRows,
    visualOverrides,
    pushAlert,
    hiddenCatalogSoloIds,
  ])

  const exportRegister = useCallback(() => {
    try {
      const payload: RegisterExportPayloadV1 = {
        version: 1,
        exportedAt: new Date().toISOString(),
        pairs,
        soloRows,
        hiddenCatalogSoloIds,
        visualOverrides,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const a = document.createElement('a')
      a.href = url
      a.download = `alchemix-register-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      pushAlert(WORKSHOP_MESSAGES.exportReady, 'success')
    } catch {
      pushAlert(WORKSHOP_MESSAGES.exportFailed, 'error')
    }
  }, [pairs, soloRows, hiddenCatalogSoloIds, visualOverrides, pushAlert])

  const onImportRegisterFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const inputEl = e.currentTarget
      const file = inputEl.files?.[0]
      if (!file) {
        pushAlert(WORKSHOP_MESSAGES.importEmptySelection, 'error')
        return
      }
      try {
        const raw = await file.text()
        const parsed = JSON.parse(raw) as Partial<RegisterExportPayloadV1>
        const textureSet = new Set<LiquidTexture>(TEXTURE_OPTIONS)

        const importedPairs = Array.isArray(parsed.pairs) ? parsed.pairs : []
        const nextPairs: EditablePair[] = importedPairs
          .map((row, i) => ({
            clientId: typeof row?.clientId === 'number' ? row.clientId : i + 1,
            a: applyLegacyVialIdRename(String(row?.a ?? '').trim()),
            b: applyLegacyVialIdRename(String(row?.b ?? '').trim()),
            resultId: applyLegacyVialIdRename(String(row?.resultId ?? '').trim()),
          }))
          .filter((row) => row.resultId !== '')

        const importedSolo = Array.isArray(parsed.soloRows) ? parsed.soloRows : []
        const nextSoloRows: EditableSolo[] = importedSolo
          .map((row, i) => ({
            clientId: typeof row?.clientId === 'number' ? row.clientId : 10_000 + i,
            id: applyLegacyVialIdRename(String(row?.id ?? '').trim()),
          }))
          .filter((row) => row.id !== '')

        const importedHidden = Array.isArray(parsed.hiddenCatalogSoloIds)
          ? parsed.hiddenCatalogSoloIds
          : []
        const nextHidden = importedHidden
          .map((id) => applyLegacyVialIdRename(String(id).trim()))
          .filter(Boolean)

        const importedVisual = parsed.visualOverrides
        const nextVisualOverrides: Record<string, VisualOverrideDraft> = {}
        if (importedVisual && typeof importedVisual === 'object') {
          for (const [rawId, rawValue] of Object.entries(importedVisual)) {
            const id = applyLegacyVialIdRename(String(rawId).trim())
            if (!id || !rawValue || typeof rawValue !== 'object') continue
            const v = rawValue as Partial<VisualOverrideDraft>
            const parsedOpacity = Number(v.opacity)
            const texture = String(v.texture ?? '')
            const textureSafe = textureSet.has(texture as LiquidTexture)
              ? (texture as LiquidTexture)
              : 'liquid'
            nextVisualOverrides[id] = {
              primaryColor: String(v.primaryColor ?? '#ffffff').trim() || '#ffffff',
              secondaryColor: String(v.secondaryColor ?? '').trim(),
              opacity: Number.isFinite(parsedOpacity)
                ? Math.min(1, Math.max(0, parsedOpacity))
                : 0.85,
              texture: textureSafe,
            }
          }
        }

        setPairs(nextPairs)
        setSoloRows(nextSoloRows)
        setHiddenCatalogSoloIds(nextHidden)
        setVisualOverrides(nextVisualOverrides)
        setEditingPair(null)
        setEditingSolo(null)
        setRegistreDeletePrompt(null)
        setRegisterPage(1)
        registerBaselineRef.current = null
        pushAlert(WORKSHOP_MESSAGES.importApplied, 'success')
      } catch {
        pushAlert(WORKSHOP_MESSAGES.importFailed, 'error')
      } finally {
        // Permet de réimporter le même fichier sans erreur silencieuse.
        inputEl.value = ''
      }
    },
    [pushAlert],
  )

  const typeClass = (t: VialType | 'unknown' | 'fioleSeule') => {
    if (t === 'fioleSeule') return 'ra-typeSolo'
    if (t === 'element') return 'ra-typeElement'
    if (t === 'spell') return 'ra-typeSpell'
    if (t === 'creature') return 'ra-typeCreature'
    return 'ra-typeUnknown'
  }

  const typeLabel = (t: VialType | 'unknown' | 'fioleSeule') => {
    if (t === 'fioleSeule') return 'Recipe'
    if (t === 'element') return 'Recipe'
    if (t === 'creature') return 'Creature'
    return 'Unknown'
  }

  return (
    <div className="recipe-atelier relative box-border flex h-dvh max-h-dvh shrink-0 flex-col overflow-hidden px-3 pb-2 pt-2">
      <div className="ra-alerts flex flex-col gap-1.5" aria-live="polite">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`ra-alert ${a.kind === 'success' ? 'ra-alertSuccess' : 'ra-alertError'}`}
          >
            <span>{a.message}</span>
            <button
              type="button"
              className="ra-alertClose"
              aria-label="Close"
              onClick={() =>
                setAlerts((prev) => prev.filter((x) => x.id !== a.id))
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-1.5">
        <header className="flex shrink-0 flex-nowrap items-center justify-between gap-3 border-b border-[color:var(--lab-border)] pb-1.5">
          <h1 className="ra-pageTitle">Alchemix — Recipe workshop</h1>
          <div className="ra-topActions flex shrink-0 items-center gap-2">
            <input
              ref={importFileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={onImportRegisterFileChange}
            />
            <button
              type="button"
              className="ra-btn ra-btnSecondary"
              onClick={exportRegister}
              title="Export register"
              aria-label="Export register"
            >
              <Download size={14} />
            </button>
            <button
              type="button"
              className="ra-btn ra-btnSecondary"
              onClick={() => importFileInputRef.current?.click()}
              title="Import register"
              aria-label="Import register"
            >
              <Upload size={14} />
            </button>
            <button
              type="button"
              className="ra-btn ra-btnSecondary"
              onClick={saveToSourceFiles}
            >
              Save
            </button>
            <Link
              ref={backNavLinkRef}
              className="ra-navLink"
              to="/"
              onClick={(e) => {
                if (!hasRegisterChanges) return
                e.preventDefault()
                setBackConfirmOpen(true)
              }}
            >
              Back to laboratory
            </Link>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-[0.65rem] overflow-hidden min-[901px]:grid-cols-[minmax(240px,0.95fr)_minmax(0,2fr)] min-[901px]:grid-rows-1 max-[900px]:grid-rows-[auto_minmax(0,1fr)]">
          <section className="ra-panel ra-panelForm flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="ra-modeTabs" role="tablist" aria-label="Creation type">
              {(
                [
                  ['element', 'Recipe'],
                  ['creature', 'Creature'],
                ] as const
              ).map(([key, lab]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={createMode === key}
                  className={`ra-modeTab ${createMode === key ? 'ra-modeTabActive' : ''}`}
                  onClick={() => {
                    if (createMode === key) return
                    if (editingPair || editingSolo) {
                      setEditingPair(null)
                      setEditingSolo(null)
                      resetMainFormFields()
                    }
                    setCreateMode(key)
                  }}
                >
                  {lab}
                </button>
              ))}
            </div>

            <form className="ra-formStack" onSubmit={handleAddSubmit}>
              <div className="ra-formBody">
                {createMode === 'element' && (
                  <div className="ra-formRecipeLayout">
                    {editingSolo ? (
                      <>
                        <VialOptionCombo
                          compact
                          inputId="elResult"
                          label={
                            <>
                              Element<span className="ra-required">*</span>
                            </>
                          }
                          value={elResultInput}
                          onChange={handleElementResultChange}
                          options={elementOptions}
                          allowCustom
                          placeholder="Element…"
                        />
                        <p className="ra-hint">
                          Editing an element register entry from the Recipe tab.
                        </p>
                      </>
                    ) : (
                      <>
                        <VialOptionCombo
                          compact
                          inputId="elA"
                          label={
                            <>
                              Ingredient A<span className="ra-required">*</span>
                            </>
                          }
                          value={elA}
                          onChange={setElA}
                          options={ingredientOptions}
                          placeholder="Ingredient…"
                        />
                        <VialOptionCombo
                          compact
                          inputId="elB"
                          label={
                            <>
                              Ingredient B<span className="ra-required">*</span>
                            </>
                          }
                          value={elB}
                          onChange={setElB}
                          options={ingredientOptions}
                          placeholder="Ingredient…"
                        />
                        <VialOptionCombo
                          compact
                          inputId="elResult"
                          label={
                            <>
                              Element<span className="ra-required">*</span>
                            </>
                          }
                          value={elResultInput}
                          onChange={handleElementResultChange}
                          options={elementOptions}
                          allowCustom
                          placeholder="Element…"
                        />
                        <div className="ra-formVisualStack">
                          <RaColorPickerField
                            id="elPrimaryColor"
                            label={
                              <>
                                Primary<span className="ra-required">*</span>
                              </>
                            }
                            value={elPrimaryColor}
                            onChange={setElPrimaryColor}
                            fallback="#ffffff"
                            hexPlaceholder="#ffffff"
                            aria-label="Primary color"
                          />
                          <RaColorPickerField
                            id="elSecondaryColor"
                            label="Secondary"
                            value={elSecondaryColor}
                            onChange={setElSecondaryColor}
                            fallback="#000000"
                            hexPlaceholder="optional"
                            aria-label="Secondary color"
                          />
                          <div className="ra-formGroup ra-formGroup--fieldRow">
                            <label htmlFor="elTexture">
                              Texture<span className="ra-required">*</span>
                            </label>
                            <TextureSelect
                              id="elTexture"
                              value={elTexture}
                              onChange={setElTexture}
                              options={TEXTURE_OPTIONS}
                            />
                          </div>
                          <div className="ra-formGroup ra-formGroup--fieldRow">
                            <label htmlFor="elOpacity">
                              Opacity<span className="ra-required">*</span>
                            </label>
                            <div className="ra-opacityControl">
                              <input
                                id="elOpacity"
                                type="range"
                                className="ra-opacityRange"
                                min={0}
                                max={1}
                                step={0.01}
                                value={elOpacitySliderValue}
                                onChange={(e) => setElOpacity(String(Number(e.target.value)))}
                                aria-valuemin={0}
                                aria-valuemax={1}
                                aria-valuenow={elOpacitySliderValue}
                                aria-valuetext={`${Math.round(elOpacitySliderValue * 100)}%`}
                              />
                              <output className="ra-opacityReadout" htmlFor="elOpacity">
                                {elOpacitySliderValue.toFixed(2)}
                              </output>
                            </div>
                          </div>
                        </div>
                        {elementPreviewVial && (
                          <div className="ra-previewFlaskWrap">
                            <span className="ra-previewFlaskLabel">Preview</span>
                            <VialFlaskGraphic
                              vial={elementPreviewVial}
                              className="ra-previewFlaskSvg"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {createMode === 'creature' && (
                  <div className="ra-formRecipeLayout">
                    <VialOptionCombo
                      compact
                      inputId="crElement"
                      label="Element"
                      value={crElement}
                      onChange={setCrElement}
                      options={elementOptions}
                      placeholder="Element…"
                    />
                    <div className="ra-formGroup ra-formGroup--fieldRow">
                      <label htmlFor="crName">
                        Creature name<span className="ra-required">*</span>
                      </label>
                      <input
                        id="crName"
                        className="ra-input"
                        value={crName}
                        onChange={(e) => setCrName(e.target.value)}
                        placeholder="Creature vial name"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                )}

                {createMode === 'solo' && (
                  <div className="ra-formRecipeLayout">
                    <div className="ra-formGroup ra-formGroup--fieldRow">
                      <label htmlFor="soloId">
                        Name<span className="ra-required">*</span>
                      </label>
                      <input
                        id="soloId"
                        className="ra-input"
                        value={soloIdInput}
                        onChange={(e) => setSoloIdInput(e.target.value)}
                        placeholder="Element name or technical id"
                        autoComplete="off"
                      />
                    </div>
                    <p className="ra-hint">
                      Catalog recipes are already listed. Here, add an element outside
                      the catalog (craft, etc.).
                    </p>
                  </div>
                )}
              </div>

              <div className="ra-formSubmitBar">
                <button
                  ref={addBtnRef}
                  type="submit"
                  className="ra-btn ra-btnPrimary"
                >
                  {editingPair || editingSolo ? 'Update' : 'Add'}
                </button>
                {(editingPair || editingSolo) && (
                  <button
                    type="button"
                    className="ra-btn ra-btnSecondary"
                    onClick={exitRegisterRowEdit}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

          </section>

          <section className="ra-panel ra-panelTable flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="ra-tableHeader">
              <div className="ra-tableHeaderLeft">
                <h2>Register ({stats.totalRows})</h2>
                <div className="ra-searchWrap">
                  <input
                    className="ra-input ra-searchField"
                    placeholder="Filter…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Filter"
                  />
                </div>
              </div>
              <div className="ra-tableHeaderRight">
                <button
                  type="button"
                  className="ra-btn ra-btnSecondary ra-headerToolbarBtn ra-iconHeaderBtn"
                  onClick={resetDefaults}
                  title="Reload store"
                  aria-label="Reload store"
                >
                  <RefreshCcw size={16} strokeWidth={2.25} aria-hidden />
                </button>
              </div>
            </div>

            <div className="ra-tableWrap flex min-h-0 flex-1 flex-col">
              <div ref={registerTableScrollRef} className="ra-tableScroll">
                <table className="ra-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>
                        <div className="ra-thWithSort">
                          <span>Combination</span>
                          <button
                            type="button"
                            className={`ra-sortHeaderBtn${activeSortKeys.includes('pair') ? ' ra-sortHeaderBtnActive' : ''}`}
                            title={
                              activeSortKeys.length > 1
                                ? `Sort by combination (ingredient names) — priority ${activeSortKeys.indexOf('pair') + 1} of ${activeSortKeys.length} (click to remove)`
                                : 'Sort by both ingredient names (A–Z, A/B order ignored; stackable)'
                            }
                            aria-label="Sort by combination ingredient names"
                            aria-pressed={activeSortKeys.includes('pair')}
                            onClick={() => toggleSortKey('pair')}
                          >
                            {activeSortKeys.length > 1 &&
                              activeSortKeys.includes('pair') && (
                                <span
                                  className="ra-sortPriorityBadge"
                                  aria-hidden
                                >
                                  {activeSortKeys.indexOf('pair') + 1}
                                </span>
                              )}
                            <ArrowDownWideNarrow
                              size={15}
                              strokeWidth={2.25}
                              aria-hidden
                            />
                          </button>
                        </div>
                      </th>
                      <th>
                        <div className="ra-thWithSort">
                          <span>Element</span>
                          <button
                            type="button"
                            className={`ra-sortHeaderBtn${activeSortKeys.includes('result') ? ' ra-sortHeaderBtnActive' : ''}`}
                            title={
                              activeSortKeys.length > 1
                                ? `Sort element A–Z — priority ${activeSortKeys.indexOf('result') + 1} of ${activeSortKeys.length} (click to remove)`
                                : 'Enable sort by element name (stackable with others; order = priority)'
                            }
                            aria-label="Sort by element name"
                            aria-pressed={activeSortKeys.includes('result')}
                            onClick={() => toggleSortKey('result')}
                          >
                            {activeSortKeys.length > 1 &&
                              activeSortKeys.includes('result') && (
                                <span
                                  className="ra-sortPriorityBadge"
                                  aria-hidden
                                >
                                  {activeSortKeys.indexOf('result') + 1}
                                </span>
                              )}
                            <ArrowDownAZ
                              size={15}
                              strokeWidth={2.25}
                              aria-hidden
                            />
                          </button>
                        </div>
                      </th>
                      <th>
                        <div className="ra-thWithSort">
                          <span>Type</span>
                          <button
                            type="button"
                            className={`ra-sortHeaderBtn${activeSortKeys.includes('type') ? ' ra-sortHeaderBtnActive' : ''}`}
                            title={
                              activeSortKeys.length > 1
                                ? `Sort by type — priority ${activeSortKeys.indexOf('type') + 1} of ${activeSortKeys.length} (click to remove)`
                                : 'Enable sort by type (stackable with others; order = priority)'
                            }
                            aria-label="Sort by type"
                            aria-pressed={activeSortKeys.includes('type')}
                            onClick={() => toggleSortKey('type')}
                          >
                            {activeSortKeys.length > 1 &&
                              activeSortKeys.includes('type') && (
                                <span
                                  className="ra-sortPriorityBadge"
                                  aria-hidden
                                >
                                  {activeSortKeys.indexOf('type') + 1}
                                </span>
                              )}
                            <ArrowDownUp
                              size={15}
                              strokeWidth={2.25}
                              aria-hidden
                            />
                          </button>
                        </div>
                      </th>
                      <th className="ra-thActions" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {!registerReady ? (
                      <tr className="ra-loadingRow">
                        <td colSpan={5}>
                          <div className="ra-loadingRegister" role="status" aria-live="polite">
                            <div className="ra-loadingSpinner" aria-hidden>
                              <svg
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <ellipse cx="12" cy="5" rx="4" ry="4">
                                  <animate
                                    id="spinner_jbYs"
                                    begin="0;spinner_JZdr.end"
                                    attributeName="cy"
                                    calcMode="spline"
                                    dur="0.375s"
                                    values="5;20"
                                    keySplines=".33,0,.66,.33"
                                    fill="freeze"
                                  />
                                  <animate
                                    begin="spinner_jbYs.end"
                                    attributeName="rx"
                                    calcMode="spline"
                                    dur="0.05s"
                                    values="4;4.8;4"
                                    keySplines=".33,0,.66,.33;.33,.66,.66,1"
                                  />
                                  <animate
                                    begin="spinner_jbYs.end"
                                    attributeName="ry"
                                    calcMode="spline"
                                    dur="0.05s"
                                    values="4;3;4"
                                    keySplines=".33,0,.66,.33;.33,.66,.66,1"
                                  />
                                  <animate
                                    id="spinner_ADF4"
                                    begin="spinner_jbYs.end"
                                    attributeName="cy"
                                    calcMode="spline"
                                    dur="0.025s"
                                    values="20;20.5"
                                    keySplines=".33,0,.66,.33"
                                  />
                                  <animate
                                    id="spinner_JZdr"
                                    begin="spinner_ADF4.end"
                                    attributeName="cy"
                                    calcMode="spline"
                                    dur="0.4s"
                                    values="20.5;5"
                                    keySplines=".33,.66,.66,1"
                                  />
                                </ellipse>
                              </svg>
                            </div>
                            Loading register…
                          </div>
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="ra-empty">
                            {stats.totalRows === 0
                              ? 'No rows.'
                              : 'No results for this filter.'}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedRegisterRows.map((row, i) => {
                        const rowNum = registerPageStart + i + 1
                        if (row.kind === 'solo') {
                          const s = row.data
                          return (
                            <tr key={`solo-${s.clientId}`}>
                              <td>{rowNum}</td>
                              <td>
                                <span className="ra-dashCell">—</span>
                              </td>
                              <td className="ra-tdResult">
                                {displayName(s.id)}
                              </td>
                              <td>
                                <span
                                  className={`ra-typeTag ${typeClass('fioleSeule')}`}
                                >
                                  {typeLabel('fioleSeule')}
                                </span>
                              </td>
                              <td>
                                <div className="ra-actions">
                                  <button
                                    type="button"
                                    className="ra-iconBtn"
                                    title="Edit"
                                    aria-label="Edit"
                                    onClick={() => {
                                      resetMainFormFields()
                                      setEditingPair(null)
                                      setCreateMode('element')
                                      setElResultInput(displayName(s.id))
                                      setElA('')
                                      setElB('')
                                      setEditingSolo(
                                        s.fromCatalog
                                          ? { ...s, catalogSourceId: s.id }
                                          : { ...s },
                                      )
                                    }}
                                  >
                                    <Pencil size={16} strokeWidth={2.25} />
                                  </button>
                                  <button
                                    type="button"
                                    className="ra-iconBtn ra-iconBtnDanger"
                                    title="Delete"
                                    aria-label="Delete"
                                    onClick={(e) => {
                                      rememberModalAnchor(e.currentTarget)
                                      setRegistreDeletePrompt({
                                        kind: 'solo',
                                        solo: { ...s },
                                      })
                                    }}
                                  >
                                    <Trash2 size={16} strokeWidth={2.25} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        }
                        const p = row.data
                        const rt = resultType(p.resultId)
                        return (
                          <tr key={`pair-${p.clientId}`}>
                            <td>{rowNum}</td>
                            <td>
                              <div className="ra-combo">
                                {hasNoCombination(p) ? (
                                  <span className="ra-dashCell">—</span>
                                ) : isCreatureRecipePair(p) ? (
                                  <span className="ra-pill">
                                    {displayName(p.a)}
                                  </span>
                                ) : (
                                  <>
                                    <span className="ra-pill">
                                      {displayName(p.a)}
                                    </span>
                                    <span className="ra-plus">+</span>
                                    <span className="ra-pill">
                                      {displayName(p.b)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="ra-tdResult">
                              {displayName(p.resultId)}
                            </td>
                            <td>
                              <span
                                className={`ra-typeTag ${typeClass(rt)}`}
                              >
                                {typeLabel(rt)}
                              </span>
                            </td>
                            <td>
                              <div className="ra-actions">
                                <button
                                  type="button"
                                  className="ra-iconBtn"
                                  title="Edit"
                                  aria-label="Edit"
                                  onClick={() => {
                                    resetMainFormFields()
                                    setEditingSolo(null)
                                    if (isCreatureResultId(p.resultId)) {
                                      setCreateMode('creature')
                                      const spell = p.a.trim()
                                        ? p.a.trim()
                                        : p.b.trim()
                                          ? p.b.trim()
                                          : ''
                                      setCrElement(spell)
                                      setCrName(displayName(p.resultId))
                                    } else {
                                      setCreateMode('element')
                                      setElA(p.a)
                                      setElB(p.b)
                                      setElResultInput(displayName(p.resultId))
                                      const vis =
                                        visualOverrides[p.resultId] ??
                                        visualFromTemplate(p.resultId)
                                      setElPrimaryColor(vis.primaryColor)
                                      setElSecondaryColor(vis.secondaryColor)
                                      setElOpacity(String(vis.opacity))
                                      setElTexture(vis.texture)
                                    }
                                    setEditingPair({ ...p })
                                  }}
                                >
                                  <Pencil size={16} strokeWidth={2.25} />
                                </button>
                                <button
                                  type="button"
                                  className="ra-iconBtn ra-iconBtnDanger"
                                  title="Delete"
                                  aria-label="Delete"
                                  onClick={(e) => {
                                    rememberModalAnchor(e.currentTarget)
                                    setRegistreDeletePrompt({
                                      kind: 'pair',
                                      clientId: p.clientId,
                                    })
                                  }}
                                >
                                  <Trash2 size={16} strokeWidth={2.25} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {registerReady && filtered.length > REGISTER_PAGE_SIZE && (
              <div
                className="ra-registerPager"
                role="navigation"
                aria-label="Register pages"
              >
                <span className="ra-registerPagerMeta">
                  Page {safeRegisterPage} of {registerTotalPages}
                </span>
                <div className="ra-registerPagerBtns">
                  <button
                    type="button"
                    className="ra-btn ra-btnSecondary ra-registerPagerBtn"
                    disabled={safeRegisterPage <= 1}
                    aria-label="Previous page"
                    onClick={() => setRegisterPage((p) => Math.max(1, p - 1))}
                  >
                    <MoveLeft size={14} strokeWidth={2.2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="ra-btn ra-btnSecondary ra-registerPagerBtn"
                    disabled={safeRegisterPage >= registerTotalPages}
                    aria-label="Next page"
                    onClick={() =>
                      setRegisterPage((p) =>
                        Math.min(registerTotalPages, p + 1),
                      )
                    }
                  >
                    <MoveRight size={14} strokeWidth={2.2} aria-hidden />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="ra-stats">
          <span className="ra-statInline">
            <strong>{stats.pairs}</strong> pairs
          </span>
          <span className="ra-statInline">
            <strong>{stats.fiolesSeules}</strong> elements
          </span>
          <span className="ra-statInline">
            <strong>{stats.elements}</strong> recipe
          </span>
          <span className="ra-statInline">
            <strong>{stats.creatures}</strong> creature
          </span>
        </div>
      </div>

      {backConfirmOpen && (
        <div
          ref={backConfirmOverlayRef}
          className="ra-modalOverlay ra-modalOverlayConfirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="back-lab-confirm-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseBackConfirm()
          }}
        >
          <div ref={backConfirmDialogRef} className="ra-modal">
            <h3 id="back-lab-confirm-title">Leave recipe workshop</h3>
            <p className="ra-modalBody">
              You have unsaved register changes. Go back to laboratory anyway?
            </p>
            <div className="ra-modalActions">
              <button
                type="button"
                className="ra-btn ra-btnSecondary"
                onClick={() => requestCloseBackConfirm()}
              >
                Stay
              </button>
              <button
                type="button"
                className="ra-btn ra-btnDanger"
                onClick={() => {
                  requestCloseBackConfirm(() => navigate('/'))
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {registreDeletePrompt && (
        <div
          ref={deleteOverlayRef}
          className="ra-modalOverlay ra-modalOverlayConfirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="registre-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseDeletePrompt()
          }}
        >
          <div ref={deleteDialogRef} className="ra-modal">
            <h3 id="registre-delete-title">Remove from register</h3>
            <p className="ra-modalBody">
              {registreDeletePrompt.kind === 'pair'
                ? (() => {
                    const row = pairs.find(
                      (r) =>
                        r.clientId === registreDeletePrompt.clientId,
                    )
                    return row
                      ? (() => {
                          const combo = hasNoCombination(row)
                            ? '—'
                            : isCreatureRecipePair(row)
                              ? displayName(row.a)
                              : `${displayName(row.a)} + ${displayName(row.b)}`
                          return `Delete recipe “${combo} → ${displayName(row.resultId)}”?`
                        })()
                      : 'Delete this register row?'
                  })()
                : `Delete element “${displayName(registreDeletePrompt.solo.id)}”?`}
            </p>
            <div className="ra-modalActions">
              <button
                type="button"
                className="ra-btn ra-btnSecondary"
                onClick={() => requestCloseDeletePrompt()}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ra-btn ra-btnDanger"
                onClick={() => {
                  const payload = registreDeletePrompt
                  if (!payload) return
                  requestCloseDeletePrompt(() => {
                    if (payload.kind === 'pair') {
                      removeRegistrePair(payload.clientId)
                    } else {
                      removeRegistreSolo(payload.solo)
                    }
                  })
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
