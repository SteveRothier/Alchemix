import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDownAZ,
  ArrowDownUp,
  ArrowDownWideNarrow,
  MoveLeft,
  MoveRight,
  Pencil,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'
import { STARTER_VIAL_DEFINITIONS } from '../data/starterVials'
import { gsap } from '../lib/gsap'
import { inferLabelFromRef } from '../lib/inferVialLabel'
import { buildCraftedVialsTs } from '../lib/buildCraftedVialsSource'
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
  placeholder = 'Type to filter or pick…',
  autoComplete = 'on',
  compact = false,
}: {
  inputId: string
  label: ReactNode
  value: string
  onChange: (id: string) => void
  options: VialPickOption[]
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
      if (value) {
        const keep = options.find((o) => o.id === value)
        setText(keep?.name ?? inferLabelFromRef(value))
      } else {
        setText('')
      }
    },
    [options, value, onChange],
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

function seedPairs(): EditablePair[] {
  const rows = Object.entries(CRAFTED_VIAL_TEMPLATES)
    .filter(([id, t]) => t.recipe || t.type === 'creature' || id.startsWith('creature-'))
    .sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' }))

  return rows.map(([resultId, t], i) => ({
    clientId: i + 1,
    a: t.recipe?.ingredientA ?? '',
    b: t.recipe?.ingredientB ?? '',
    resultId,
  }))
}

function seedSolo(): EditableSolo[] {
  const soloIds = Object.entries(CRAFTED_VIAL_TEMPLATES)
    .filter(([, t]) => t.type === 'element' && !t.recipe)
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
    return parsed.map((row, i) => ({
      clientId: typeof row.clientId === 'number' ? row.clientId : i + 1,
      a: String(row.a),
      b: String(row.b),
      resultId: String(row.resultId),
    }))
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
    return parsed.map((row, i) => ({
      clientId: typeof row.clientId === 'number' ? row.clientId : 10_000 + i,
      id: String(row.id ?? ''),
    })).filter((r) => r.id)
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
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function saveHiddenCatalogSoloIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEY_HIDDEN_CATALOG_SOLO, JSON.stringify(ids))
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

/** Ingrédient vide autorisé ; sinon résolution comme `resolveRefFromDisplayInput`. */
function resolveIngredientDraft(
  input: string,
  displayName: (id: string) => string,
  allIds: Set<string>,
): { ref: string; error?: 'ambiguous' } {
  if (!input.trim()) return { ref: '' }
  const r = resolveRefFromDisplayInput(input, displayName, allIds)
  if (r.error === 'empty') return { ref: '' }
  return { ref: r.ref, error: r.error }
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
  const [pairEditDraft, setPairEditDraft] = useState({
    a: '',
    b: '',
    resultId: '',
  })
  const [editingSolo, setEditingSolo] = useState<EditingSoloState | null>(null)
  const [soloEditDraft, setSoloEditDraft] = useState('')
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
  const [elRes, setElRes] = useState('')
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
  const [pairVisualEditDraft, setPairVisualEditDraft] =
    useState<VisualOverrideDraft>(visualFromTemplate(''))
  const [backConfirmOpen, setBackConfirmOpen] = useState(false)
  const [registerPage, setRegisterPage] = useState(1)
  const [registerReady, setRegisterReady] = useState(false)
  const [pairsVersion, setPairsVersion] = useState(0)
  const [soloVersion, setSoloVersion] = useState(0)
  const [hiddenVersion, setHiddenVersion] = useState(0)
  const [baselineVersions, setBaselineVersions] = useState({
    pairs: 0,
    solo: 0,
    hidden: 0,
  })
  const registerLoadTokenRef = useRef(0)
  const didMountPairsRef = useRef(false)
  const didMountSoloRef = useRef(false)
  const didMountHiddenRef = useRef(false)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const registerTableScrollRef = useRef<HTMLDivElement>(null)
  const backNavLinkRef = useRef<HTMLAnchorElement>(null)
  const modalAnchorRef = useRef<HTMLElement | null>(null)
  const deleteOverlayRef = useRef<HTMLDivElement>(null)
  const deleteDialogRef = useRef<HTMLDivElement>(null)
  const editPairOverlayRef = useRef<HTMLDivElement>(null)
  const editPairDialogRef = useRef<HTMLDivElement>(null)
  const editSoloOverlayRef = useRef<HTMLDivElement>(null)
  const editSoloDialogRef = useRef<HTMLDivElement>(null)
  const backConfirmOverlayRef = useRef<HTMLDivElement>(null)
  const backConfirmDialogRef = useRef<HTMLDivElement>(null)
  const deleteClosingRef = useRef(false)
  const editPairClosingRef = useRef(false)
  const editSoloClosingRef = useRef(false)
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

  const requestCloseEditPair = useCallback(
    (afterClose?: () => void) => {
      if (editPairClosingRef.current || !editingPair) return
      const overlay = editPairOverlayRef.current
      const dialog = editPairDialogRef.current
      const anchor = modalAnchorRef.current
      if (!overlay || !dialog) {
        setEditingPair(null)
        afterClose?.()
        return
      }
      editPairClosingRef.current = true
      playActionModalClose(overlay, dialog, anchor, () => {
        editPairClosingRef.current = false
        setEditingPair(null)
        afterClose?.()
      })
    },
    [editingPair],
  )

  const requestCloseEditSolo = useCallback(
    (afterClose?: () => void) => {
      if (editSoloClosingRef.current || !editingSolo) return
      const overlay = editSoloOverlayRef.current
      const dialog = editSoloDialogRef.current
      const anchor = modalAnchorRef.current
      if (!overlay || !dialog) {
        setEditingSolo(null)
        afterClose?.()
        return
      }
      editSoloClosingRef.current = true
      playActionModalClose(overlay, dialog, anchor, () => {
        editSoloClosingRef.current = false
        setEditingSolo(null)
        afterClose?.()
      })
    },
    [editingSolo],
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
    if (!editingPair) return
    const anchor = modalAnchorRef.current
    const overlay = editPairOverlayRef.current
    const dialog = editPairDialogRef.current
    if (!anchor || !overlay || !dialog) return
    const tl = playActionModalOpen(overlay, dialog, anchor)
    return () => {
      tl.kill()
    }
  }, [editingPair])

  useLayoutEffect(() => {
    if (!editingSolo) return
    const anchor = modalAnchorRef.current
    const overlay = editSoloOverlayRef.current
    const dialog = editSoloDialogRef.current
    if (!anchor || !overlay || !dialog) return
    const tl = playActionModalOpen(overlay, dialog, anchor)
    return () => {
      tl.kill()
    }
  }, [editingSolo])

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

  const hasRegisterChanges = useMemo(
    () =>
      pairsVersion !== baselineVersions.pairs ||
      soloVersion !== baselineVersions.solo ||
      hiddenVersion !== baselineVersions.hidden,
    [pairsVersion, soloVersion, hiddenVersion, baselineVersions],
  )

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
    if (!didMountPairsRef.current) {
      didMountPairsRef.current = true
      return
    }
    setPairsVersion((v) => v + 1)
  }, [pairs])

  useEffect(() => {
    saveSolo(soloRows)
    if (!didMountSoloRef.current) {
      didMountSoloRef.current = true
      return
    }
    setSoloVersion((v) => v + 1)
  }, [soloRows])

  useEffect(() => {
    saveHiddenCatalogSoloIds(hiddenCatalogSoloIds)
    if (!didMountHiddenRef.current) {
      didMountHiddenRef.current = true
      return
    }
    setHiddenVersion((v) => v + 1)
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
  const toPairEditDraft = useCallback(
    (pair: EditablePair) => {
      if (isCreatureResultId(pair.resultId)) {
        const spellDisp =
          !pair.a.trim() && !pair.b.trim()
            ? ''
            : pair.a.trim()
              ? displayName(pair.a)
              : displayName(pair.b)
        return {
          a: spellDisp,
          b: spellDisp,
          resultId: displayName(pair.resultId),
        }
      }
      return {
        a: displayName(pair.a),
        b: displayName(pair.b),
        resultId: displayName(pair.resultId),
      }
    },
    [displayName],
  )
  const toSoloEditDraft = useCallback((solo: EditableSolo) => displayName(solo.id), [
    displayName,
  ])

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

  const pairEditOpacityClamped = useMemo(() => {
    const raw = Number(pairVisualEditDraft.opacity)
    return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.85
  }, [pairVisualEditDraft.opacity])

  const elementPreviewVial = useMemo((): Vial | null => {
    if (createMode !== 'element') return null
    const parsedOpacity = Number(elOpacity)
    const opacity = Number.isFinite(parsedOpacity)
      ? Math.min(1, Math.max(0, parsedOpacity))
      : 0.85
    const resultId = elRes.trim() || 'preview-element'
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
  }, [createMode, elOpacity, elRes, elPrimaryColor, elSecondaryColor, elTexture])

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
            ? 'Enter at least the result.'
            : 'Enter both ingredients and the result.',
          'error',
        )
        return false
      }

      if (!allowEmpty) {
        if (!ta || !tb) {
          pushAlert('Enter both ingredients and the result.', 'error')
          return false
        }
      } else if (hasHalfFilledPair(ta, tb)) {
        pushAlert(HALF_PAIR_ERROR, 'error')
        return false
      }

      const dup = hasPairConflict(pairs, ta, tb, tr)
      if (dup) {
        pushAlert(
          ta === '' && tb === ''
            ? 'This entry already exists: same result with no combination.'
            : 'This combination already exists: same ingredient pair (order does not matter).',
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
    const id = soloIdInput.trim()
    if (!id) {
      pushAlert('Enter a reference.', 'error')
      return
    }
    const norm = id
    if (catalogElementIdSet.has(norm)) {
      pushAlert(
        'This reference is already covered: all catalog recipes are listed for it.',
        'error',
      )
      return
    }
    if (soloRows.some((s) => s.id === norm)) {
      pushAlert('This reference is already in your element entries.', 'error')
      return
    }
    setSoloRows((prev) => [
      ...prev,
      { clientId: nextClientId(), id: norm },
    ])
    setSoloIdInput('')
    pushAlert('Element added.', 'success')
  }, [
    soloIdInput,
    soloRows,
    nextClientId,
    pushAlert,
    catalogElementIdSet,
  ])

  const handleAddSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      switch (createMode) {
        case 'element':
          if (!knownVialIdSet.has(elA.trim()) || !knownVialIdSet.has(elB.trim())) {
            pushAlert('Pick ingredients that exist in the list.', 'error')
            return
          }
          if (tryAddPair(elA, elB, elRes, 'Recipe added.')) {
            upsertVisualOverride(elRes, {
              primaryColor: elPrimaryColor,
              secondaryColor: elSecondaryColor,
              opacity: elOpacity,
              texture: elTexture,
            })
            setElA('')
            setElB('')
            setElRes('')
            setElPrimaryColor('#ffffff')
            setElSecondaryColor('')
            setElOpacity('0.85')
            setElTexture('liquid')
          }
          break
        case 'creature': {
          const slug = slugifyCreatureName(crName)
          if (!slug) {
            pushAlert('Enter a creature name.', 'error')
            return
          }
          const element = crElement.trim()
          if (element && !knownElementIdSet.has(element)) {
            pushAlert('Pick an element that exists in the list.', 'error')
            return
          }
          const resultId = `creature-${slug}`
          if (
            tryAddPair(
              element,
              element,
              resultId,
              'Creature added.',
              { allowEmptyIngredients: true },
            )
          ) {
            setCrElement('')
            setCrName('')
          }
          break
        }
        case 'solo':
          tryAddSolo()
          break
      }
    },
    [
      createMode,
      tryAddPair,
      tryAddSolo,
      elA,
      elB,
      elRes,
      elPrimaryColor,
      elSecondaryColor,
      elOpacity,
      elTexture,
      crElement,
      crName,
      pushAlert,
      knownVialIdSet,
      knownElementIdSet,
      upsertVisualOverride,
    ],
  )

  const removeRegistrePair = useCallback(
    (clientId: number) => {
      setPairs((prev) => prev.filter((row) => row.clientId !== clientId))
      pushAlert('Combination removed.', 'success')
    },
    [pushAlert],
  )

  const removeRegistreSolo = useCallback(
    (s: EditableSolo) => {
      if (s.fromCatalog) {
        setHiddenCatalogSoloIds((prev) =>
          prev.includes(s.id) ? prev : [...prev, s.id],
        )
        pushAlert(
          'Element removed from the register (reload the store to see everything again).',
          'success',
        )
        return
      }
      setSoloRows((prev) => prev.filter((r) => r.clientId !== s.clientId))
      pushAlert('Entry removed.', 'success')
    },
    [pushAlert],
  )

  const resetDefaults = useCallback(() => {
    triggerRegisterLoading()
    setPairs(seedPairs())
    setSoloRows(seedSolo())
    setHiddenCatalogSoloIds([])
    pushAlert('Data reset from source code.', 'success')
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
        setBaselineVersions({
          pairs: pairsVersion,
          solo: soloVersion,
          hidden: hiddenVersion,
        })
        pushAlert(
          'craftedVials updated directly in src/data. Restart the dev server if needed.',
          'success',
        )
        return
      }
    } catch {
      // Fallback handled below for non-dev contexts.
    }

    pushAlert(
      'Could not save in this context. Run with the local save API enabled.',
      'error',
    )
  }, [
    pairs,
    soloRows,
    visualOverrides,
    pushAlert,
    pairsVersion,
    soloVersion,
    hiddenVersion,
  ])

  const saveEditPair = useCallback(() => {
    if (!editingPair) return
    const { clientId } = editingPair
    const creatureEdit = isCreatureResultId(editingPair.resultId)
    let tr = ''
    if (creatureEdit) {
      const raw = pairEditDraft.resultId.trim()
      if (!raw) {
        pushAlert('Creature name is required.', 'error')
        return
      }
      const lower = raw.toLowerCase()
      const base = lower.startsWith('creature-')
        ? raw.slice('creature-'.length)
        : raw
      const slug = slugifyCreatureName(base)
      if (!slug) {
        pushAlert('Creature name is invalid.', 'error')
        return
      }
      tr = `creature-${slug}`
    } else {
      const rr = resolveRefFromDisplayInput(
        pairEditDraft.resultId,
        displayName,
        allKnownVialIds,
      )
      if (rr.error === 'empty' || !rr.ref.trim()) {
        pushAlert('Result is required.', 'error')
        return
      }
      if (rr.error === 'ambiguous') {
        pushAlert(AMBIGUOUS_NAME_ERROR, 'error')
        return
      }
      tr = rr.ref.trim()
    }

    let ta: string
    let tb: string
    if (creatureEdit) {
      const rs = resolveIngredientDraft(
        pairEditDraft.a,
        displayName,
        allKnownVialIds,
      )
      if (rs.error === 'ambiguous') {
        pushAlert(AMBIGUOUS_NAME_ERROR, 'error')
        return
      }
      const spellRef = rs.ref.trim()
      if (spellRef && !knownElementIdSet.has(spellRef)) {
        pushAlert('Pick an element that exists in the list.', 'error')
        return
      }
      ta = spellRef
      tb = spellRef
    } else {
      const ra = resolveIngredientDraft(
        pairEditDraft.a,
        displayName,
        allKnownVialIds,
      )
      const rb = resolveIngredientDraft(
        pairEditDraft.b,
        displayName,
        allKnownVialIds,
      )
      if (ra.error === 'ambiguous' || rb.error === 'ambiguous') {
        pushAlert(AMBIGUOUS_NAME_ERROR, 'error')
        return
      }
      ta = ra.ref.trim()
      tb = rb.ref.trim()
      if ((ta && !knownVialIdSet.has(ta)) || (tb && !knownVialIdSet.has(tb))) {
        pushAlert('Pick ingredients that exist in the list.', 'error')
        return
      }
      if (hasHalfFilledPair(ta, tb)) {
        pushAlert(HALF_PAIR_ERROR, 'error')
        return
      }
    }
    const clash = hasPairConflict(pairs, ta, tb, tr, clientId)
    if (clash) {
      pushAlert(
        ta === '' && tb === ''
          ? 'Another row already has this result with no combination.'
          : 'Another row already uses this ingredient pair.',
        'error',
      )
      return
    }
    setPairs((prev) =>
      prev.map((p) =>
        p.clientId === clientId ? { ...p, a: ta, b: tb, resultId: tr } : p,
      ),
    )
    if (!creatureEdit) {
      upsertVisualOverride(tr, {
        primaryColor: pairVisualEditDraft.primaryColor,
        secondaryColor: pairVisualEditDraft.secondaryColor,
        opacity: pairVisualEditDraft.opacity,
        texture: pairVisualEditDraft.texture,
      })
    }
    requestCloseEditPair()
    pushAlert('Combination updated.', 'success')
  }, [
    editingPair,
    pairEditDraft,
    pairs,
    pushAlert,
    displayName,
    allKnownVialIds,
    knownVialIdSet,
    knownElementIdSet,
    pairVisualEditDraft,
    upsertVisualOverride,
    requestCloseEditPair,
  ])

  const saveEditSolo = useCallback(() => {
    if (!editingSolo) return
    const resolved = resolveRefFromDisplayInput(
      soloEditDraft,
      displayName,
      allKnownVialIds,
    )
    if (resolved.error === 'empty' || !resolved.ref.trim()) {
      pushAlert('Name or reference is empty.', 'error')
      return
    }
    if (resolved.error === 'ambiguous') {
      pushAlert(AMBIGUOUS_NAME_ERROR, 'error')
      return
    }
    const newId = resolved.ref.trim()
    const src = editingSolo.catalogSourceId

    if (src) {
      if (hasSoloConflict(soloRows, newId)) {
        pushAlert('This reference already exists in your element entries.', 'error')
        return
      }
      setHiddenCatalogSoloIds((prev) =>
        prev.includes(src) ? prev : [...prev, src],
      )
      setSoloRows((prev) => [
        ...prev,
        { clientId: nextClientId(), id: newId },
      ])
      requestCloseEditSolo()
      pushAlert('Element saved.', 'success')
      return
    }

    const clash = hasSoloConflict(soloRows, newId, editingSolo.clientId)
    if (clash) {
      pushAlert('This reference already exists as an element.', 'error')
      return
    }
    setSoloRows((prev) =>
      prev.map((s) =>
        s.clientId === editingSolo.clientId ? { ...s, id: newId } : s,
      ),
    )
    requestCloseEditSolo()
    pushAlert('Reference updated.', 'success')
  }, [
    editingSolo,
    soloEditDraft,
    soloRows,
    nextClientId,
    pushAlert,
    displayName,
    allKnownVialIds,
    requestCloseEditSolo,
  ])

  const typeClass = (t: VialType | 'unknown' | 'fioleSeule') => {
    if (t === 'fioleSeule') return 'ra-typeSolo'
    if (t === 'element') return 'ra-typeElement'
    if (t === 'spell') return 'ra-typeSpell'
    if (t === 'creature') return 'ra-typeCreature'
    return 'ra-typeUnknown'
  }

  const typeLabel = (t: VialType | 'unknown' | 'fioleSeule') => {
    if (t === 'fioleSeule') return 'Element'
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
                  ['solo', 'Element'],
                ] as const
              ).map(([key, lab]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={createMode === key}
                  className={`ra-modeTab ${createMode === key ? 'ra-modeTabActive' : ''}`}
                  onClick={() => setCreateMode(key)}
                >
                  {lab}
                </button>
              ))}
            </div>

            <form className="ra-formStack" onSubmit={handleAddSubmit}>
              <div className="ra-formBody">
                {createMode === 'element' && (
                  <div className="ra-formRecipeLayout">
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
                      options={vialOptions}
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
                      options={vialOptions}
                      placeholder="Ingredient…"
                    />
                    <div className="ra-formGroup ra-formGroup--fieldRow">
                      <label htmlFor="elRes">
                        Result<span className="ra-required">*</span>
                      </label>
                      <input
                        id="elRes"
                        className="ra-input"
                        value={elRes}
                        onChange={(e) => setElRes(e.target.value)}
                        placeholder="Produced reference"
                        autoComplete="off"
                      />
                    </div>
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
                        ELEMENT<span className="ra-required">*</span>
                      </label>
                      <input
                        id="soloId"
                        className="ra-input"
                        value={soloIdInput}
                        onChange={(e) => setSoloIdInput(e.target.value)}
                        placeholder="New element"
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
                  Add
                </button>
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
                          <span>Result</span>
                          <button
                            type="button"
                            className={`ra-sortHeaderBtn${activeSortKeys.includes('result') ? ' ra-sortHeaderBtnActive' : ''}`}
                            title={
                              activeSortKeys.length > 1
                                ? `Sort result A–Z — priority ${activeSortKeys.indexOf('result') + 1} of ${activeSortKeys.length} (click to remove)`
                                : 'Enable sort by result name (stackable with others; order = priority)'
                            }
                            aria-label="Sort by result name"
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
                                    onClick={(e) => {
                                      rememberModalAnchor(e.currentTarget)
                                      setSoloEditDraft(toSoloEditDraft(s))
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
                                  onClick={(e) => {
                                    rememberModalAnchor(e.currentTarget)
                                    setPairEditDraft(toPairEditDraft(p))
                                    setPairVisualEditDraft(
                                      visualOverrides[p.resultId] ?? visualFromTemplate(p.resultId),
                                    )
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

      {editingPair && (
        <div
          ref={editPairOverlayRef}
          className="ra-modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-pair-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseEditPair()
          }}
        >
          <div ref={editPairDialogRef} className="ra-modal">
            <h3 id="edit-pair-title">
              {isCreatureResultId(editingPair.resultId)
                ? 'Edit creature'
                : 'Edit combination'}
            </h3>
            {isCreatureResultId(editingPair.resultId) ? (
              <VialOptionCombo
                inputId="edCreatureElement"
                label="Element offered"
                value={pairEditDraft.a}
                onChange={(id) =>
                  setPairEditDraft((d) => ({
                    ...d,
                    a: id,
                    b: id,
                  }))
                }
                options={elementOptions}
                placeholder="Type to search for an element…"
                autoComplete="on"
              />
            ) : (
              <>
                <VialOptionCombo
                  inputId="edA"
                  label="Ingredient A"
                  value={pairEditDraft.a}
                  onChange={(id) =>
                    setPairEditDraft((d) => ({ ...d, a: id }))
                  }
                  options={vialOptions}
                  placeholder="Type to search for an ingredient…"
                />
                <VialOptionCombo
                  inputId="edB"
                  label="Ingredient B"
                  value={pairEditDraft.b}
                  onChange={(id) =>
                    setPairEditDraft((d) => ({ ...d, b: id }))
                  }
                  options={vialOptions}
                  placeholder="Type to search for an ingredient…"
                />
              </>
            )}
            <div className="ra-formGroup">
              <label htmlFor="edR">Result</label>
              <input
                id="edR"
                className="ra-input"
                value={pairEditDraft.resultId}
                onChange={(e) =>
                  setPairEditDraft((d) => ({ ...d, resultId: e.target.value }))
                }
                autoComplete="off"
              />
            </div>
            {!isCreatureResultId(editingPair.resultId) && (
              <div className="ra-formVisualStack ra-formVisualStack--modal">
                <RaColorPickerField
                  id="edPrimaryColor"
                  label="Primary"
                  value={pairVisualEditDraft.primaryColor}
                  onChange={(v) =>
                    setPairVisualEditDraft((d) => ({ ...d, primaryColor: v }))
                  }
                  fallback="#ffffff"
                  hexPlaceholder="#ffffff"
                  aria-label="Primary color"
                />
                <RaColorPickerField
                  id="edSecondaryColor"
                  label="Secondary"
                  value={pairVisualEditDraft.secondaryColor}
                  onChange={(v) =>
                    setPairVisualEditDraft((d) => ({ ...d, secondaryColor: v }))
                  }
                  fallback="#000000"
                  hexPlaceholder="optional"
                  aria-label="Secondary color"
                />
                <div className="ra-formGroup ra-formGroup--fieldRow">
                  <label htmlFor="edTexture">Texture</label>
                  <TextureSelect
                    id="edTexture"
                    value={pairVisualEditDraft.texture}
                    onChange={(texture) =>
                      setPairVisualEditDraft((d) => ({ ...d, texture }))
                    }
                    options={TEXTURE_OPTIONS}
                  />
                </div>
                <div className="ra-formGroup ra-formGroup--fieldRow">
                  <label htmlFor="edOpacity">Opacity</label>
                  <div className="ra-opacityControl">
                    <input
                      id="edOpacity"
                      type="range"
                      className="ra-opacityRange"
                      min={0}
                      max={1}
                      step={0.01}
                      value={pairEditOpacityClamped}
                      onChange={(e) =>
                        setPairVisualEditDraft((d) => ({
                          ...d,
                          opacity: Number(e.target.value),
                        }))
                      }
                      aria-valuemin={0}
                      aria-valuemax={1}
                      aria-valuenow={pairEditOpacityClamped}
                      aria-valuetext={`${Math.round(pairEditOpacityClamped * 100)}%`}
                    />
                    <output className="ra-opacityReadout" htmlFor="edOpacity">
                      {pairEditOpacityClamped.toFixed(2)}
                    </output>
                  </div>
                </div>
              </div>
            )}
            <div className="ra-modalActions">
              <button
                type="button"
                className="ra-btn ra-btnPrimary"
                onClick={saveEditPair}
              >
                Save
              </button>
              <button
                type="button"
                className="ra-btn ra-btnSecondary"
                onClick={() => requestCloseEditPair()}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSolo && (
        <div
          ref={editSoloOverlayRef}
          className="ra-modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-solo-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseEditSolo()
          }}
        >
          <div ref={editSoloDialogRef} className="ra-modal">
            <h3 id="edit-solo-title">
              {editingSolo.catalogSourceId
                ? 'Save this element'
                : 'Edit element'}
            </h3>
            <div className="ra-formGroup">
              <label htmlFor="edSolo">Element name</label>
              <input
                id="edSolo"
                className="ra-input"
                value={soloEditDraft}
                onChange={(e) => setSoloEditDraft(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="ra-modalActions">
              <button
                type="button"
                className="ra-btn ra-btnPrimary"
                onClick={saveEditSolo}
              >
                Save
              </button>
              <button
                type="button"
                className="ra-btn ra-btnSecondary"
                onClick={() => requestCloseEditSolo()}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
