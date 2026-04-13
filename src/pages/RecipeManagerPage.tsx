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
import { Link } from 'react-router-dom'
import {
  ArrowDownAZ,
  ArrowDownUp,
  ArrowDownWideNarrow,
  Pencil,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'
import { MANUAL_RECIPE_PAIRS } from '../data/manualRecipePairs'
import { MANUAL_SOLO_ELEMENT_IDS } from '../data/manualSoloElements'
import { STARTER_VIAL_DEFINITIONS } from '../data/starterVials'
import { inferLabelFromRef } from '../lib/inferVialLabel'
import { pairKey } from '../lib/recipeMap'
import type { VialType } from '../types'
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

type CreateMode = 'element' | 'spell' | 'creature' | 'solo'
type SortKey = 'result' | 'pair' | 'type'

type RegistreRow =
  | { kind: 'pair'; data: EditablePair }
  | { kind: 'solo'; data: EditableSolo }

type VialPickOption = { id: string; name: string }

const COMBO_LIST_LIMIT = 120

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
}: {
  inputId: string
  label: ReactNode
  value: string
  onChange: (id: string) => void
  options: VialPickOption[]
  placeholder?: string
  autoComplete?: string
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
    <div className="ra-formGroup">
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

function seedPairs(): EditablePair[] {
  return MANUAL_RECIPE_PAIRS.map((p, i) => ({
    clientId: i + 1,
    a: p.a,
    b: p.b,
    resultId: p.resultId,
  }))
}

function seedSolo(): EditableSolo[] {
  return MANUAL_SOLO_ELEMENT_IDS.map((id, i) => ({
    clientId: 10_000 + i,
    id,
  }))
}

function loadPairs(): EditablePair[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PAIRS)
    if (!raw) return seedPairs()
    const parsed = JSON.parse(raw) as EditablePair[]
    if (!Array.isArray(parsed) || parsed.length === 0) return seedPairs()
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
  if (lower.startsWith('sp-')) return 'spell'
  if (lower.startsWith('leg-')) return 'spell'
  if (lower.startsWith('el-')) return 'element'
  if (lower.startsWith('craft-')) return 'element'

  /**
   * Référence sans entrée catalogue (ex. « feur ») : en atelier c’est presque toujours un sort.
   * Les éléments attendent en pratique le préfixe el- ou craft-.
   */
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(id)) return 'spell'

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

/** Onglet Sort : impose le préfixe `sp-` si l’utilisateur saisit seulement un slug. */
function normalizeAtelierSpellResultId(raw: string): string {
  const t = raw.trim()
  if (!t) return t
  const lower = t.toLowerCase()
  if (
    lower.startsWith('sp-') ||
    lower.startsWith('creature-') ||
    lower.startsWith('el-') ||
    lower.startsWith('craft-') ||
    lower.startsWith('leg-')
  ) {
    return t
  }
  return `sp-${slugifyCreatureName(t)}`
}

const TYPE_ORDER: Record<string, number> = {
  element: 0,
  spell: 1,
  creature: 2,
  unknown: 3,
  fioleSeule: 4,
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

function buildManualPairsTs(pairs: EditablePair[]): string {
  const body = pairs
    .map(
      (p) =>
        `  { a: ${JSON.stringify(p.a)}, b: ${JSON.stringify(p.b)}, resultId: ${JSON.stringify(p.resultId)} },`,
    )
    .join('\n')
  return `/**\n * Catalog recipes (symmetric in-game: a/b order does not matter).\n * Updated from the recipe workshop (/#/recipes) — Save button.\n */\nexport const MANUAL_RECIPE_PAIRS: { a: string; b: string; resultId: string }[] = [\n${body}\n]\n`
}

function buildManualSoloTs(ids: string[]): string {
  const sorted = [...new Set(ids.map((x) => x.trim()).filter(Boolean))].sort()
  const json = JSON.stringify(sorted, null, 2)
  return `/**\n * Vial references declared alone (no pair recipe).\n * Updated from the recipe workshop (/#/recipes) — Save button.\n */\nexport const MANUAL_SOLO_ELEMENT_IDS: string[] = ${json}\n`
}

type AlertItem = { id: number; message: string; kind: 'success' | 'error' }

export function RecipeManagerPage() {
  const vialOptions = useMemo(() => buildVialOptions(), [])
  const spellOptions = useMemo(
    () => vialOptions.filter((v) => v.type === 'spell'),
    [vialOptions],
  )
  const knownVialIdSet = useMemo(
    () => new Set(vialOptions.map((v) => v.id)),
    [vialOptions],
  )
  const knownSpellIdSet = useMemo(
    () => new Set(spellOptions.map((v) => v.id)),
    [spellOptions],
  )

  const catalogElementIds = useMemo(() => {
    const ids = vialOptions
      .filter((v) => v.type === 'element')
      .map((v) => v.id)
    return ids.sort((a, b) => {
      const na =
        vialOptions.find((o) => o.id === a)?.name ?? inferLabelFromRef(a)
      const nb =
        vialOptions.find((o) => o.id === b)?.name ?? inferLabelFromRef(b)
      return na.localeCompare(nb, 'en', { sensitivity: 'base' })
    })
  }, [vialOptions])

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

  const [createMode, setCreateMode] = useState<CreateMode>('element')
  const [elA, setElA] = useState('')
  const [elB, setElB] = useState('')
  const [elRes, setElRes] = useState('')
  const [spA, setSpA] = useState('')
  const [spB, setSpB] = useState('')
  const [spRes, setSpRes] = useState('')
  const [crSpell, setCrSpell] = useState('')
  const [crName, setCrName] = useState('')
  const [soloIdInput, setSoloIdInput] = useState('')

  const pushAlert = useCallback((message: string, kind: AlertItem['kind']) => {
    const id = Date.now()
    setAlerts((prev) => [...prev, { id, message, kind }])
    window.setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    }, 2200)
  }, [])

  useEffect(() => {
    savePairs(pairs)
  }, [pairs])

  useEffect(() => {
    saveSolo(soloRows)
  }, [soloRows])

  useEffect(() => {
    saveHiddenCatalogSoloIds(hiddenCatalogSoloIds)
  }, [hiddenCatalogSoloIds])

  const displayName = useCallback(
    (id: string) =>
      vialOptions.find((o) => o.id === id)?.name ?? inferLabelFromRef(id),
    [vialOptions],
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

  const stats = useMemo(() => {
    let elements = 0
    let spells = 0
    let creatures = 0
    for (const p of pairs) {
      const t = resultType(p.resultId)
      if (t === 'element') elements += 1
      else if (t === 'spell') spells += 1
      else if (t === 'creature') creatures += 1
    }
    return {
      totalRows: pairs.length + mergedSoloEntries.length,
      pairs: pairs.length,
      fiolesSeules: mergedSoloEntries.length,
      elements,
      spells,
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
      } else if ((ta && !tb) || (!ta && tb)) {
        pushAlert(
          'Either fill both ingredients or leave both empty (not just one).',
          'error',
        )
        return false
      }

      let dup: boolean
      if (ta === '' && tb === '') {
        dup = pairs.some(
          (p) =>
            !p.a.trim() &&
            !p.b.trim() &&
            p.resultId.trim() === tr,
        )
      } else {
        const key = pairKey(ta, tb)
        dup = pairs.some((p) => pairKey(p.a.trim(), p.b.trim()) === key)
      }
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
            setElA('')
            setElB('')
            setElRes('')
          }
          break
        case 'spell': {
          if (!spRes.trim()) {
            pushAlert('Enter the produced spell reference (result).', 'error')
            return
          }
          const sA = spA.trim()
          const sB = spB.trim()
          if ((sA && !sB) || (!sA && sB)) {
            pushAlert(
              'Pick both ingredients or leave both empty (not just one).',
              'error',
            )
            return
          }
          if ((sA && !knownVialIdSet.has(sA)) || (sB && !knownVialIdSet.has(sB))) {
            pushAlert('Pick ingredients that exist in the list.', 'error')
            return
          }
          const spellResultId = normalizeAtelierSpellResultId(spRes)
          if (
            tryAddPair(spA, spB, spellResultId, 'Combination added.', {
              allowEmptyIngredients: true,
            })
          ) {
            setSpA('')
            setSpB('')
            setSpRes('')
          }
          break
        }
        case 'creature': {
          const slug = slugifyCreatureName(crName)
          if (!slug) {
            pushAlert('Enter a creature name.', 'error')
            return
          }
          const spell = crSpell.trim()
          if (spell && !knownSpellIdSet.has(spell)) {
            pushAlert('Pick a spell that exists in the list.', 'error')
            return
          }
          const resultId = `creature-${slug}`
          if (
            tryAddPair(
              spell,
              spell,
              resultId,
              'Creature added.',
              { allowEmptyIngredients: true },
            )
          ) {
            setCrSpell('')
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
      spA,
      spB,
      spRes,
      crSpell,
      crName,
      pushAlert,
      knownVialIdSet,
      knownSpellIdSet,
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
    if (
      !window.confirm(
        'Reload data from the store? Local changes will be lost.',
      )
    ) {
      return
    }
    setPairs(seedPairs())
    setSoloRows(seedSolo())
    setHiddenCatalogSoloIds([])
    pushAlert('Data reset from source code.', 'success')
  }, [pushAlert])

  const saveToSourceFiles = useCallback(async () => {
    const pairsTs = buildManualPairsTs(pairs)
    const soloTs = buildManualSoloTs(soloRows.map((s) => s.id))

    try {
      const res = await fetch('/api/save-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairsTs, soloTs }),
      })
      if (res.ok) {
        pushAlert(
          'Files updated directly in src/data. Restart the dev server if needed.',
          'success',
        )
        return
      }
    } catch {
      // Fallback handled below for non-dev contexts.
    }

    const download = (name: string, content: string) => {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u
      a.download = name
      a.click()
      URL.revokeObjectURL(u)
    }

    type SavePickerWindow = Window & {
      showSaveFilePicker?: (options: {
        suggestedName?: string
        types?: { description: string; accept: Record<string, string[]> }[]
      }) => Promise<{
        createWritable: () => Promise<FileSystemWritableFileStream>
      }>
    }
    const w = window as SavePickerWindow

    if (typeof w.showSaveFilePicker === 'function') {
      try {
        const h1 = await w.showSaveFilePicker({
          suggestedName: 'manualRecipePairs.ts',
          types: [
            {
              description: 'TypeScript',
              accept: { 'text/plain': ['.ts'] },
            },
          ],
        })
        const wr1 = await h1.createWritable()
        await wr1.write(pairsTs)
        await wr1.close()
        pushAlert(
          'Pairs saved. Now choose manualSoloElements.ts in src/data/.',
          'success',
        )
        const h2 = await w.showSaveFilePicker({
          suggestedName: 'manualSoloElements.ts',
          types: [
            {
              description: 'TypeScript',
              accept: { 'text/plain': ['.ts'] },
            },
          ],
        })
        const wr2 = await h2.createWritable()
        await wr2.write(soloTs)
        await wr2.close()
        pushAlert(
          'Both files are up to date. Restart the dev server if needed.',
          'success',
        )
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        download('manualRecipePairs.ts', pairsTs)
        download('manualSoloElements.ts', soloTs)
        pushAlert(
          'Could not save in place: both files were downloaded.',
          'success',
        )
      }
    } else {
      download('manualRecipePairs.ts', pairsTs)
      download('manualSoloElements.ts', soloTs)
      pushAlert(
        'Download the files and replace src/data/manualRecipePairs.ts and manualSoloElements.ts.',
        'success',
      )
    }
  }, [pairs, soloRows, pushAlert])

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
        pushAlert(
          'Several vials share the same name: use the technical reference or a unique name.',
          'error',
        )
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
        pushAlert(
          'Several vials share the same name: use the technical reference or a unique name.',
          'error',
        )
        return
      }
      const spellRef = rs.ref.trim()
      if (spellRef && !knownSpellIdSet.has(spellRef)) {
        pushAlert('Pick a spell that exists in the list.', 'error')
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
        pushAlert(
          'Several vials share the same name: use the technical reference or a unique name.',
          'error',
        )
        return
      }
      ta = ra.ref.trim()
      tb = rb.ref.trim()
      if ((ta && !knownVialIdSet.has(ta)) || (tb && !knownVialIdSet.has(tb))) {
        pushAlert('Pick ingredients that exist in the list.', 'error')
        return
      }
      if ((ta && !tb) || (!ta && tb)) {
        pushAlert(
          'Either fill both ingredients or leave both empty (not just one).',
          'error',
        )
        return
      }
    }
    let clash: boolean
    if (ta === '' && tb === '') {
      clash = pairs.some(
        (p) =>
          p.clientId !== clientId &&
          !p.a.trim() &&
          !p.b.trim() &&
          p.resultId.trim() === tr,
      )
    } else {
      clash = pairs.some(
        (p) =>
          p.clientId !== clientId &&
          pairKey(p.a.trim(), p.b.trim()) === pairKey(ta, tb),
      )
    }
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
    setEditingPair(null)
    pushAlert('Combination updated.', 'success')
  }, [
    editingPair,
    pairEditDraft,
    pairs,
    pushAlert,
    displayName,
    allKnownVialIds,
    knownVialIdSet,
    knownSpellIdSet,
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
      pushAlert(
        'Several vials share the same name: use the technical reference or a unique name.',
        'error',
      )
      return
    }
    const newId = resolved.ref.trim()
    const src = editingSolo.catalogSourceId

    if (src) {
      if (soloRows.some((r) => r.id === newId)) {
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
      setEditingSolo(null)
      pushAlert('Element saved.', 'success')
      return
    }

    const clash = soloRows.some(
      (s) => s.clientId !== editingSolo.clientId && s.id === newId,
    )
    if (clash) {
      pushAlert('This reference already exists as an element.', 'error')
      return
    }
    setSoloRows((prev) =>
      prev.map((s) =>
        s.clientId === editingSolo.clientId ? { ...s, id: newId } : s,
      ),
    )
    setEditingSolo(null)
    pushAlert('Reference updated.', 'success')
  }, [
    editingSolo,
    soloEditDraft,
    soloRows,
    nextClientId,
    pushAlert,
    displayName,
    allKnownVialIds,
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
    if (t === 'spell') return 'Spell'
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
            <Link className="ra-navLink" to="/">
              Back to laboratory
            </Link>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-[0.65rem] overflow-hidden min-[901px]:grid-cols-[minmax(240px,0.95fr)_minmax(0,2fr)] min-[901px]:grid-rows-1 max-[900px]:grid-rows-[auto_minmax(0,1fr)]">
          <section className="ra-panel ra-panelForm flex min-h-0 min-w-0 flex-1 flex-col">
            <h2 className="ra-panelTitle">New entry</h2>

            <div className="ra-modeTabs" role="tablist" aria-label="Creation type">
              {(
                [
                  ['element', 'Recipe'],
                  ['spell', 'Spell'],
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
                  <>
                    <VialOptionCombo
                      inputId="elA"
                      label={
                        <>
                          Ingredient A<span className="ra-required">*</span>
                        </>
                      }
                      value={elA}
                      onChange={setElA}
                      options={vialOptions}
                      placeholder="Type to search for an ingredient…"
                    />
                    <VialOptionCombo
                      inputId="elB"
                      label={
                        <>
                          Ingredient B<span className="ra-required">*</span>
                        </>
                      }
                      value={elB}
                      onChange={setElB}
                      options={vialOptions}
                      placeholder="Type to search for an ingredient…"
                    />
                    <div className="ra-formGroup">
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
                  </>
                )}

                {createMode === 'spell' && (
                  <>
                    <div className="grid max-[520px]:grid-cols-1 grid-cols-2 gap-[0.45rem]">
                      <VialOptionCombo
                        inputId="spA"
                        label="Ingredient A"
                        value={spA}
                        onChange={setSpA}
                        options={vialOptions}
                        placeholder="Type to search for an ingredient…"
                      />
                      <VialOptionCombo
                        inputId="spB"
                        label="Ingredient B"
                        value={spB}
                        onChange={setSpB}
                        options={vialOptions}
                        placeholder="Type to search for an ingredient…"
                      />
                    </div>
                    <div className="ra-formGroup">
                      <label htmlFor="spRes">
                        Produced result<span className="ra-required">*</span>
                      </label>
                      <input
                        id="spRes"
                        className="ra-input"
                        value={spRes}
                        onChange={(e) => setSpRes(e.target.value)}
                        placeholder="Created spell reference (result)"
                        autoComplete="off"
                      />
                    </div>
                  </>
                )}

                {createMode === 'creature' && (
                  <>
                    <VialOptionCombo
                      inputId="crSpell"
                      label="Sort"
                      value={crSpell}
                      onChange={setCrSpell}
                      options={spellOptions}
                      placeholder="Type to search for a spell…"
                    />
                    <div className="ra-formGroup">
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
                  </>
                )}

                {createMode === 'solo' && (
                  <>
                    <div className="ra-formGroup">
                      <label htmlFor="soloId">
                        Vial reference<span className="ra-required">*</span>
                      </label>
                      <input
                        id="soloId"
                        className="ra-input"
                        value={soloIdInput}
                        onChange={(e) => setSoloIdInput(e.target.value)}
                        placeholder="Outside catalog recipes already listed"
                        autoComplete="off"
                      />
                    </div>
                    <p className="ra-hint">
                      Catalog recipes are already listed. Here, add an element outside
                      the catalog (spell, craft, etc.).
                    </p>
                  </>
                )}
              </div>

              <div className="ra-formSubmitBar">
                <button type="submit" className="ra-btn ra-btnPrimary">
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
              <div className="ra-tableScroll">
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
                    {filtered.length === 0 ? (
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
                      filtered.map((row, i) => {
                        if (row.kind === 'solo') {
                          const s = row.data
                          return (
                            <tr key={`solo-${s.clientId}`}>
                              <td>{i + 1}</td>
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
                                    onClick={() =>
                                      setRegistreDeletePrompt({
                                        kind: 'solo',
                                        solo: { ...s },
                                      })
                                    }
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
                            <td>{i + 1}</td>
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
                                    setPairEditDraft(toPairEditDraft(p))
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
                                  onClick={() =>
                                    setRegistreDeletePrompt({
                                      kind: 'pair',
                                      clientId: p.clientId,
                                    })
                                  }
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
            <strong>{stats.elements}</strong> → recipe
          </span>
          <span className="ra-statInline">
            <strong>{stats.spells}</strong> → spell
          </span>
          <span className="ra-statInline">
            <strong>{stats.creatures}</strong> → creature
          </span>
        </div>
      </div>

      {registreDeletePrompt && (
        <div
          className="ra-modalOverlay ra-modalOverlayConfirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="registre-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRegistreDeletePrompt(null)
          }}
        >
          <div className="ra-modal">
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
                onClick={() => setRegistreDeletePrompt(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ra-btn ra-btnDanger"
                onClick={() => {
                  const payload = registreDeletePrompt
                  if (!payload) return
                  setRegistreDeletePrompt(null)
                  if (payload.kind === 'pair') {
                    removeRegistrePair(payload.clientId)
                  } else {
                    removeRegistreSolo(payload.solo)
                  }
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
          className="ra-modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-pair-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingPair(null)
          }}
        >
          <div className="ra-modal">
            <h3 id="edit-pair-title">
              {isCreatureResultId(editingPair.resultId)
                ? 'Edit creature'
                : 'Edit combination'}
            </h3>
            {isCreatureResultId(editingPair.resultId) ? (
              <VialOptionCombo
                inputId="edCreatureSpell"
                label="Sort"
                value={pairEditDraft.a}
                onChange={(id) =>
                  setPairEditDraft((d) => ({
                    ...d,
                    a: id,
                    b: id,
                  }))
                }
                options={spellOptions}
                placeholder="Type to search for a spell…"
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
                onClick={() => setEditingPair(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSolo && (
        <div
          className="ra-modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-solo-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingSolo(null)
          }}
        >
          <div className="ra-modal">
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
                onClick={() => setEditingSolo(null)}
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
