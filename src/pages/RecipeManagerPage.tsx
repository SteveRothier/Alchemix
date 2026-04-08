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
import styles from './RecipeManagerPage.module.css'

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
  placeholder = 'Tape pour filtrer ou choisir…',
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
        (o) => o.name.localeCompare(t, 'fr', { sensitivity: 'base' }) === 0,
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
        className={styles.vialComboList}
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
              className={styles.vialComboOption}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o.id)
              }}
            >
              <span className={styles.vialComboName}>{o.name}</span>
            </button>
          </li>
        ))}
      </ul>,
      document.body,
    )

  return (
    <div className={styles.formGroup}>
      <label htmlFor={inputId}>{label}</label>
      <div ref={wrapRef} className={styles.vialComboAnchor}>
        <input
          id={inputId}
          type="text"
          className={styles.input}
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
                v.localeCompare(cur.name, 'fr', { sensitivity: 'base' }) !==
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
    if (lab.localeCompare(t, 'fr', { sensitivity: 'base' }) === 0) {
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
    x.name.localeCompare(y.name, 'fr', { sensitivity: 'base' }),
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
  return nx.localeCompare(ny, 'fr', { sensitivity: 'base' })
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
  if (na.localeCompare(nb, 'fr', { sensitivity: 'base' }) <= 0) {
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
  const c1 = ax.localeCompare(bx, 'fr', { sensitivity: 'base' })
  if (c1 !== 0) return c1
  return ay.localeCompare(by, 'fr', { sensitivity: 'base' })
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
  return nx.localeCompare(ny, 'fr', { sensitivity: 'base' })
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
  return `/**\n * Recettes catalogue (symétriques côté jeu : ordre a/b indifférent).\n * Mis à jour depuis l’atelier recettes (/#/recipes) — bouton Enregistrer.\n */\nexport const MANUAL_RECIPE_PAIRS: { a: string; b: string; resultId: string }[] = [\n${body}\n]\n`
}

function buildManualSoloTs(ids: string[]): string {
  const sorted = [...new Set(ids.map((x) => x.trim()).filter(Boolean))].sort()
  const json = JSON.stringify(sorted, null, 2)
  return `/**\n * Références de fioles déclarées seules (sans recette de paire).\n * Mis à jour depuis l’atelier recettes (/#/recipes) — bouton Enregistrer.\n */\nexport const MANUAL_SOLO_ELEMENT_IDS: string[] = ${json}\n`
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
      return na.localeCompare(nb, 'fr', { sensitivity: 'base' })
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
  const fileRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (!editingPair) return
    if (isCreatureResultId(editingPair.resultId)) {
      const spellDisp =
        !editingPair.a.trim() && !editingPair.b.trim()
          ? ''
          : editingPair.a.trim()
            ? displayName(editingPair.a)
            : displayName(editingPair.b)
      setPairEditDraft({
        a: spellDisp,
        b: spellDisp,
        resultId: displayName(editingPair.resultId),
      })
    } else {
      setPairEditDraft({
        a: displayName(editingPair.a),
        b: displayName(editingPair.b),
        resultId: displayName(editingPair.resultId),
      })
    }
  }, [editingPair, displayName])

  useEffect(() => {
    if (!editingSolo) return
    setSoloEditDraft(displayName(editingSolo.id))
  }, [editingSolo, displayName])

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
            ? 'Renseigne au moins le résultat.'
            : 'Renseigne les deux ingrédients et le résultat.',
          'error',
        )
        return false
      }

      if (!allowEmpty) {
        if (!ta || !tb) {
          pushAlert('Renseigne les deux ingrédients et le résultat.', 'error')
          return false
        }
      } else if ((ta && !tb) || (!ta && tb)) {
        pushAlert(
          'Les deux ingrédients doivent être renseignés, ou aucun (pas un seul seul).',
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
            ? 'Cette entrée existe déjà : même résultat sans combinaison.'
            : 'Cette combinaison existe déjà : même paire d’ingrédients (ordre indifférent).',
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
      pushAlert('Saisis une référence.', 'error')
      return
    }
    const norm = id
    if (catalogElementIdSet.has(norm)) {
      pushAlert(
        'Cette référence est déjà couverte : toutes les recettes du catalogue y figurent.',
        'error',
      )
      return
    }
    if (soloRows.some((s) => s.id === norm)) {
      pushAlert('Cette référence est déjà dans tes entrées « élément ».', 'error')
      return
    }
    setSoloRows((prev) => [
      ...prev,
      { clientId: nextClientId(), id: norm },
    ])
    setSoloIdInput('')
    pushAlert('Élément ajouté.', 'success')
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
            pushAlert('Choisis des ingrédients existants dans la liste.', 'error')
            return
          }
          if (tryAddPair(elA, elB, elRes, 'Recette ajoutée.')) {
            setElA('')
            setElB('')
            setElRes('')
          }
          break
        case 'spell': {
          if (!spRes.trim()) {
            pushAlert('Saisis la référence du sort produit (résultat).', 'error')
            return
          }
          const sA = spA.trim()
          const sB = spB.trim()
          if ((sA && !sB) || (!sA && sB)) {
            pushAlert(
              'Choisis les deux ingrédients ou laisse les deux vides (pas un seul).',
              'error',
            )
            return
          }
          if ((sA && !knownVialIdSet.has(sA)) || (sB && !knownVialIdSet.has(sB))) {
            pushAlert('Choisis des ingrédients existants dans la liste.', 'error')
            return
          }
          const spellResultId = normalizeAtelierSpellResultId(spRes)
          if (
            tryAddPair(spA, spB, spellResultId, 'Combinaison ajoutée.', {
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
            pushAlert('Saisis un nom de créature.', 'error')
            return
          }
          const spell = crSpell.trim()
          if (spell && !knownSpellIdSet.has(spell)) {
            pushAlert('Choisis un sort existant dans la liste.', 'error')
            return
          }
          const resultId = `creature-${slug}`
          if (
            tryAddPair(
              spell,
              spell,
              resultId,
              'Créature ajoutée.',
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
      pushAlert('Combinaison supprimée.', 'success')
    },
    [pushAlert],
  )

  const removeRegistreSolo = useCallback(
    (s: EditableSolo) => {
      if (s.fromCatalog) {
        setHiddenCatalogSoloIds((prev) =>
          prev.includes(s.id) ? prev : [...prev, s.id],
        )
        pushAlert('Élément retiré du registre (tu peux réinitialiser le dépôt pour tout revoir).', 'success')
        return
      }
      setSoloRows((prev) => prev.filter((r) => r.clientId !== s.clientId))
      pushAlert('Entrée supprimée.', 'success')
    },
    [pushAlert],
  )

  const resetDefaults = useCallback(() => {
    if (
      !window.confirm(
        'Recharger les données depuis le dépôt ? Les modifications locales seront perdues.',
      )
    ) {
      return
    }
    setPairs(seedPairs())
    setSoloRows(seedSolo())
    setHiddenCatalogSoloIds([])
    pushAlert('Données réinitialisées depuis le code source.', 'success')
  }, [pushAlert])

  const exportJson = useCallback(() => {
    if (pairs.length === 0 && soloRows.length === 0) {
      pushAlert('Rien à exporter.', 'error')
      return
    }
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 3,
            exportedAt: new Date().toISOString(),
            pairs: pairs.map(({ a, b, resultId }) => ({ a, b, resultId })),
            soloElements: soloRows.map((s) => s.id),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `alchemix-recipes-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    pushAlert('JSON téléchargé.', 'success')
  }, [pairs, soloRows, pushAlert])

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
          'Fichiers mis a jour directement dans src/data. Relance le serveur de dev si besoin.',
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
          'Paires enregistrées. Choisis maintenant manualSoloElements.ts dans src/data/.',
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
          'Les deux fichiers sont à jour. Relance le serveur de dev si besoin.',
          'success',
        )
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        download('manualRecipePairs.ts', pairsTs)
        download('manualSoloElements.ts', soloTs)
        pushAlert(
          'Enregistrement direct impossible : les deux fichiers ont été téléchargés.',
          'success',
        )
      }
    } else {
      download('manualRecipePairs.ts', pairsTs)
      download('manualSoloElements.ts', soloTs)
      pushAlert(
        'Télécharge les fichiers et remplace src/data/manualRecipePairs.ts et manualSoloElements.ts.',
        'success',
      )
    }
  }, [pairs, soloRows, pushAlert])

  const onImportFile = useCallback(
    (ev: ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0]
      ev.target.value = ''
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result))
          const raw = Array.isArray(data.pairs)
            ? data.pairs
            : Array.isArray(data.recipes)
              ? data.recipes
              : null
          if (!raw) {
            pushAlert('JSON invalide : attendu pairs ou recipes.', 'error')
            return
          }
          const mapped: EditablePair[] = raw.map(
            (
              row: { a?: string; b?: string; resultId?: string; result?: string },
              i: number,
            ) => ({
              clientId: i + 1,
              a: String(row.a ?? ''),
              b: String(row.b ?? ''),
              resultId: String(row.resultId ?? row.result ?? ''),
            }),
          )
          const valid = mapped.filter((p) => {
            const tr = p.resultId.trim()
            if (!tr) return false
            const hasA = Boolean(p.a.trim())
            const hasB = Boolean(p.b.trim())
            return (hasA && hasB) || (!hasA && !hasB)
          })
          if (valid.length === 0) {
            pushAlert('Aucune paire valide dans le fichier.', 'error')
            return
          }
          let nid = 1
          setPairs(
            valid.map((p) => ({
              ...p,
              clientId: nid++,
            })),
          )
          let soloMsg = ''
          if ('soloElements' in data && Array.isArray(data.soloElements)) {
            const solos = data.soloElements.map(String).filter(Boolean)
            setSoloRows(
              solos.map((id: string, i: number) => ({
                clientId: 10_000 + i,
                id,
              })),
            )
            soloMsg = `, ${solos.length} seul(s)`
          }
          pushAlert(`${valid.length} paire(s)${soloMsg} importé(s).`, 'success')
        } catch {
          pushAlert('Fichier JSON illisible.', 'error')
        }
      }
      reader.readAsText(file)
    },
    [pushAlert],
  )

  const saveEditPair = useCallback(() => {
    if (!editingPair) return
    const { clientId } = editingPair
    const creatureEdit = isCreatureResultId(editingPair.resultId)

    const rr = resolveRefFromDisplayInput(
      pairEditDraft.resultId,
      displayName,
      allKnownVialIds,
    )
    if (rr.error === 'empty' || !rr.ref.trim()) {
      pushAlert('Le résultat est obligatoire.', 'error')
      return
    }
    if (rr.error === 'ambiguous') {
      pushAlert(
        'Plusieurs fioles correspondent à un même nom : précise la référence technique ou un nom unique.',
        'error',
      )
      return
    }
    const tr = rr.ref.trim()

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
          'Plusieurs fioles correspondent à un même nom : précise la référence technique ou un nom unique.',
          'error',
        )
        return
      }
      const spellRef = rs.ref.trim()
      if (spellRef && !knownSpellIdSet.has(spellRef)) {
        pushAlert('Choisis un sort existant dans la liste.', 'error')
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
          'Plusieurs fioles correspondent à un même nom : précise la référence technique ou un nom unique.',
          'error',
        )
        return
      }
      ta = ra.ref.trim()
      tb = rb.ref.trim()
      if ((ta && !knownVialIdSet.has(ta)) || (tb && !knownVialIdSet.has(tb))) {
        pushAlert('Choisis des ingrédients existants dans la liste.', 'error')
        return
      }
      if ((ta && !tb) || (!ta && tb)) {
        pushAlert(
          'Les deux ingrédients doivent être renseignés, ou aucun (pas un seul seul).',
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
          ? 'Une autre ligne a déjà ce résultat sans combinaison.'
          : 'Une autre ligne utilise déjà cette paire d’ingrédients.',
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
    pushAlert('Combinaison mise à jour.', 'success')
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
      pushAlert('Le nom ou la référence est vide.', 'error')
      return
    }
    if (resolved.error === 'ambiguous') {
      pushAlert(
        'Plusieurs fioles correspondent à un même nom : précise la référence technique ou un nom unique.',
        'error',
      )
      return
    }
    const newId = resolved.ref.trim()
    const src = editingSolo.catalogSourceId

    if (src) {
      if (soloRows.some((r) => r.id === newId)) {
        pushAlert('Cette référence existe déjà dans tes entrées « élément ».', 'error')
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
      pushAlert('Élément enregistré.', 'success')
      return
    }

    const clash = soloRows.some(
      (s) => s.clientId !== editingSolo.clientId && s.id === newId,
    )
    if (clash) {
      pushAlert('Cette référence existe déjà comme élément.', 'error')
      return
    }
    setSoloRows((prev) =>
      prev.map((s) =>
        s.clientId === editingSolo.clientId ? { ...s, id: newId } : s,
      ),
    )
    setEditingSolo(null)
    pushAlert('Référence mise à jour.', 'success')
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
    if (t === 'fioleSeule') return styles.typeSolo
    if (t === 'element') return styles.typeElement
    if (t === 'spell') return styles.typeSpell
    if (t === 'creature') return styles.typeCreature
    return styles.typeUnknown
  }

  const typeLabel = (t: VialType | 'unknown' | 'fioleSeule') => {
    if (t === 'fioleSeule') return 'Élément'
    if (t === 'element') return 'Recette'
    if (t === 'spell') return 'Sort'
    if (t === 'creature') return 'Créature'
    return 'Inconnu'
  }

  return (
    <div className={styles.page}>
      <div className={styles.alerts} aria-live="polite">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`${styles.alert} ${a.kind === 'success' ? styles.alertSuccess : styles.alertError}`}
          >
            <span>{a.message}</span>
            <button
              type="button"
              className={styles.alertClose}
              aria-label="Fermer"
              onClick={() =>
                setAlerts((prev) => prev.filter((x) => x.id !== a.id))
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className={styles.container}>
        <header className={styles.topBar}>
          <h1 className={styles.pageTitle}>Alchemix — Atelier des recettes</h1>
          <Link className={styles.navLink} to="/">
            Retour au laboratoire
          </Link>
        </header>

        <div className={styles.mainGrid}>
          <section className={`${styles.panel} ${styles.panelForm}`}>
            <h2 className={styles.panelTitle}>Nouvelle entrée</h2>

            <div className={styles.modeTabs} role="tablist" aria-label="Type de création">
              {(
                [
                  ['element', 'Recette'],
                  ['spell', 'Sort'],
                  ['creature', 'Créature'],
                  ['solo', 'Élément'],
                ] as const
              ).map(([key, lab]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={createMode === key}
                  className={`${styles.modeTab} ${createMode === key ? styles.modeTabActive : ''}`}
                  onClick={() => setCreateMode(key)}
                >
                  {lab}
                </button>
              ))}
            </div>

            <form className={styles.formStack} onSubmit={handleAddSubmit}>
              <div className={styles.formBody}>
                {createMode === 'element' && (
                  <>
                    <VialOptionCombo
                      inputId="elA"
                      label={
                        <>
                          Ingrédient A<span className={styles.required}>*</span>
                        </>
                      }
                      value={elA}
                      onChange={setElA}
                      options={vialOptions}
                      placeholder="Tape pour chercher un ingrédient…"
                    />
                    <VialOptionCombo
                      inputId="elB"
                      label={
                        <>
                          Ingrédient B<span className={styles.required}>*</span>
                        </>
                      }
                      value={elB}
                      onChange={setElB}
                      options={vialOptions}
                      placeholder="Tape pour chercher un ingrédient…"
                    />
                    <div className={styles.formGroup}>
                      <label htmlFor="elRes">
                        Résultat<span className={styles.required}>*</span>
                      </label>
                      <input
                        id="elRes"
                        className={styles.input}
                        value={elRes}
                        onChange={(e) => setElRes(e.target.value)}
                        placeholder="Référence produite"
                        autoComplete="off"
                      />
                    </div>
                  </>
                )}

                {createMode === 'spell' && (
                  <>
                    <div className={styles.formRow}>
                      <VialOptionCombo
                        inputId="spA"
                        label="Ingrédient A"
                        value={spA}
                        onChange={setSpA}
                        options={vialOptions}
                        placeholder="Tape pour chercher un ingrédient…"
                      />
                      <VialOptionCombo
                        inputId="spB"
                        label="Ingrédient B"
                        value={spB}
                        onChange={setSpB}
                        options={vialOptions}
                        placeholder="Tape pour chercher un ingrédient…"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="spRes">
                        Résultat produit<span className={styles.required}>*</span>
                      </label>
                      <input
                        id="spRes"
                        className={styles.input}
                        value={spRes}
                        onChange={(e) => setSpRes(e.target.value)}
                        placeholder="Référence du sort créé (résultat)"
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
                      placeholder="Tape pour chercher un sort…"
                    />
                    <div className={styles.formGroup}>
                      <label htmlFor="crName">
                        Nom de la créature<span className={styles.required}>*</span>
                      </label>
                      <input
                        id="crName"
                        className={styles.input}
                        value={crName}
                        onChange={(e) => setCrName(e.target.value)}
                        placeholder="Nom de la fiole créature"
                        autoComplete="off"
                      />
                    </div>
                  </>
                )}

                {createMode === 'solo' && (
                  <>
                    <div className={styles.formGroup}>
                      <label htmlFor="soloId">
                        Référence fiole<span className={styles.required}>*</span>
                      </label>
                      <input
                        id="soloId"
                        className={styles.input}
                        value={soloIdInput}
                        onChange={(e) => setSoloIdInput(e.target.value)}
                        placeholder="Hors recettes déjà listées du catalogue"
                        autoComplete="off"
                      />
                    </div>
                    <p className={styles.hint}>
                      Les recettes du catalogue sont déjà listées. Ici, ajoute un élément
                      hors catalogue (sort, craft, etc.).
                    </p>
                  </>
                )}
              </div>

              <div className={styles.formSubmitBar}>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Ajouter
                </button>
              </div>
            </form>

            <div className={styles.ioRow}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={saveToSourceFiles}
              >
                Enregistrer (fichiers)
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={exportJson}
              >
                JSON
              </button>
            </div>
            <div className={styles.ioRow}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => fileRef.current?.click()}
              >
                Importer JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={onImportFile}
              />
            </div>
          </section>

          <section className={`${styles.panel} ${styles.panelTable}`}>
            <div className={styles.tableHeader}>
              <div className={styles.tableHeaderLeft}>
                <h2>Registre ({stats.totalRows})</h2>
                <div className={styles.searchWrap}>
                  <input
                    className={`${styles.input} ${styles.searchField}`}
                    placeholder="Filtrer…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Filtrer"
                  />
                </div>
              </div>
              <div className={styles.tableHeaderRight}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.headerToolbarBtn} ${styles.iconHeaderBtn}`}
                  onClick={resetDefaults}
                  title="Recharger le dépôt"
                  aria-label="Recharger le dépôt"
                >
                  <RefreshCcw size={16} strokeWidth={2.25} aria-hidden />
                </button>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>
                        <div className={styles.thWithSort}>
                          <span>Combinaison</span>
                          <button
                            type="button"
                            className={`${styles.sortHeaderBtn} ${activeSortKeys.includes('pair') ? styles.sortHeaderBtnActive : ''}`}
                            title={
                              activeSortKeys.length > 1
                                ? `Tri combinaison (noms des ingrédients) — priorité ${activeSortKeys.indexOf('pair') + 1} sur ${activeSortKeys.length} (cliquer pour retirer)`
                                : 'Trier par les noms des deux ingrédients (A–Z, ordre A/B indifférent ; cumulable)'
                            }
                            aria-label="Trier par noms des ingrédients de la combinaison"
                            aria-pressed={activeSortKeys.includes('pair')}
                            onClick={() => toggleSortKey('pair')}
                          >
                            {activeSortKeys.length > 1 &&
                              activeSortKeys.includes('pair') && (
                                <span
                                  className={styles.sortPriorityBadge}
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
                        <div className={styles.thWithSort}>
                          <span>Résultat</span>
                          <button
                            type="button"
                            className={`${styles.sortHeaderBtn} ${activeSortKeys.includes('result') ? styles.sortHeaderBtnActive : ''}`}
                            title={
                              activeSortKeys.length > 1
                                ? `Tri résultat A–Z — priorité ${activeSortKeys.indexOf('result') + 1} sur ${activeSortKeys.length} (cliquer pour retirer)`
                                : 'Activer le tri par nom du résultat (cumulable avec les autres ; ordre = priorité)'
                            }
                            aria-label="Trier par nom du résultat"
                            aria-pressed={activeSortKeys.includes('result')}
                            onClick={() => toggleSortKey('result')}
                          >
                            {activeSortKeys.length > 1 &&
                              activeSortKeys.includes('result') && (
                                <span
                                  className={styles.sortPriorityBadge}
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
                        <div className={styles.thWithSort}>
                          <span>Type</span>
                          <button
                            type="button"
                            className={`${styles.sortHeaderBtn} ${activeSortKeys.includes('type') ? styles.sortHeaderBtnActive : ''}`}
                            title={
                              activeSortKeys.length > 1
                                ? `Tri par type — priorité ${activeSortKeys.indexOf('type') + 1} sur ${activeSortKeys.length} (cliquer pour retirer)`
                                : 'Activer le tri par type (cumulable avec les autres ; ordre = priorité)'
                            }
                            aria-label="Trier par type"
                            aria-pressed={activeSortKeys.includes('type')}
                            onClick={() => toggleSortKey('type')}
                          >
                            {activeSortKeys.length > 1 &&
                              activeSortKeys.includes('type') && (
                                <span
                                  className={styles.sortPriorityBadge}
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
                      <th className={styles.thActions} aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <div className={styles.empty}>
                            {stats.totalRows === 0
                              ? 'Aucune ligne.'
                              : 'Aucun résultat pour ce filtre.'}
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
                                <span className={styles.dashCell}>—</span>
                              </td>
                              <td className={styles.tdResult}>
                                {displayName(s.id)}
                              </td>
                              <td>
                                <span
                                  className={`${styles.typeTag} ${typeClass('fioleSeule')}`}
                                >
                                  {typeLabel('fioleSeule')}
                                </span>
                              </td>
                              <td>
                                <div className={styles.actions}>
                                  <button
                                    type="button"
                                    className={styles.iconBtn}
                                    title="Modifier"
                                    aria-label="Modifier"
                                    onClick={() =>
                                      setEditingSolo(
                                        s.fromCatalog
                                          ? { ...s, catalogSourceId: s.id }
                                          : { ...s },
                                      )
                                    }
                                  >
                                    <Pencil size={16} strokeWidth={2.25} />
                                  </button>
                                  <button
                                    type="button"
                                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                    title="Supprimer"
                                    aria-label="Supprimer"
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
                              <div className={styles.combo}>
                                {hasNoCombination(p) ? (
                                  <span className={styles.dashCell}>—</span>
                                ) : isCreatureRecipePair(p) ? (
                                  <span className={styles.pill}>
                                    {displayName(p.a)}
                                  </span>
                                ) : (
                                  <>
                                    <span className={styles.pill}>
                                      {displayName(p.a)}
                                    </span>
                                    <span className={styles.plus}>+</span>
                                    <span className={styles.pill}>
                                      {displayName(p.b)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className={styles.tdResult}>
                              {displayName(p.resultId)}
                            </td>
                            <td>
                              <span
                                className={`${styles.typeTag} ${typeClass(rt)}`}
                              >
                                {typeLabel(rt)}
                              </span>
                            </td>
                            <td>
                              <div className={styles.actions}>
                                <button
                                  type="button"
                                  className={styles.iconBtn}
                                  title="Modifier"
                                  aria-label="Modifier"
                                  onClick={() => setEditingPair({ ...p })}
                                >
                                  <Pencil size={16} strokeWidth={2.25} />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                  title="Supprimer"
                                  aria-label="Supprimer"
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

        <div className={styles.stats}>
          <span className={styles.statInline}>
            <strong>{stats.pairs}</strong> paires
          </span>
          <span className={styles.statInline}>
            <strong>{stats.fiolesSeules}</strong> éléments
          </span>
          <span className={styles.statInline}>
            <strong>{stats.elements}</strong> → recette
          </span>
          <span className={styles.statInline}>
            <strong>{stats.spells}</strong> → sort
          </span>
          <span className={styles.statInline}>
            <strong>{stats.creatures}</strong> → créature
          </span>
        </div>
      </div>

      {registreDeletePrompt && (
        <div
          className={`${styles.modalOverlay} ${styles.modalOverlayConfirm}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="registre-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRegistreDeletePrompt(null)
          }}
        >
          <div className={styles.modal}>
            <h3 id="registre-delete-title">Supprimer du registre</h3>
            <p className={styles.modalBody}>
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
                          return `Supprimer la recette « ${combo} → ${displayName(row.resultId)} » ?`
                        })()
                      : 'Supprimer cette ligne du registre ?'
                  })()
                : `Supprimer l’élément « ${displayName(registreDeletePrompt.solo.id)} » ?`}
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setRegistreDeletePrompt(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
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
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPair && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-pair-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingPair(null)
          }}
        >
          <div className={styles.modal}>
            <h3 id="edit-pair-title">
              {isCreatureResultId(editingPair.resultId)
                ? 'Modifier la créature'
                : 'Modifier la combinaison'}
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
                placeholder="Tape pour chercher un sort…"
                autoComplete="on"
              />
            ) : (
              <>
                <VialOptionCombo
                  inputId="edA"
                  label="Ingrédient A"
                  value={pairEditDraft.a}
                  onChange={(id) =>
                    setPairEditDraft((d) => ({ ...d, a: id }))
                  }
                  options={vialOptions}
                  placeholder="Tape pour chercher un ingrédient…"
                />
                <VialOptionCombo
                  inputId="edB"
                  label="Ingrédient B"
                  value={pairEditDraft.b}
                  onChange={(id) =>
                    setPairEditDraft((d) => ({ ...d, b: id }))
                  }
                  options={vialOptions}
                  placeholder="Tape pour chercher un ingrédient…"
                />
              </>
            )}
            <div className={styles.formGroup}>
              <label htmlFor="edR">Résultat</label>
              <input
                id="edR"
                className={styles.input}
                value={pairEditDraft.resultId}
                onChange={(e) =>
                  setPairEditDraft((d) => ({ ...d, resultId: e.target.value }))
                }
                autoComplete="off"
              />
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={saveEditPair}
              >
                Enregistrer
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setEditingPair(null)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSolo && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-solo-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingSolo(null)
          }}
        >
          <div className={styles.modal}>
            <h3 id="edit-solo-title">
              {editingSolo.catalogSourceId
                ? 'Enregistrer cet élément'
                : 'Modifier l’élément'}
            </h3>
            <div className={styles.formGroup}>
              <label htmlFor="edSolo">Nom de l’élément</label>
              <input
                id="edSolo"
                className={styles.input}
                value={soloEditDraft}
                onChange={(e) => setSoloEditDraft(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={saveEditSolo}
              >
                Enregistrer
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setEditingSolo(null)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
