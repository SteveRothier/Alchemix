import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FlaskConical, Trophy, X } from 'lucide-react'
import { LabDragContext, type InventoryDragEndInfo } from '../game/LabDragContext'
import {
  clampLabPlacementPercent,
  clientPointInCanvasPlacement,
  clientPointToCanvasPercent,
  fusionCardsOverlap,
  grabCenterClient,
} from '../game/labGeometry'
import { LabSelectionContext } from '../game/LabSelectionContext'
import type { LabPlacedVial } from '../game/labTypes'
import { LabCanvas } from '../game/LabCanvas'
import { InventoryPanel } from '../inventory/InventoryPanel'
import { resolveFusionProduct } from '../../lib/fusion'
import { applyLegacyVialIdRename } from '../../lib/legacyVialIdRenames'
import type { DrinkSpellResult } from '../../lib/drinkSpell'
import { CRAFTED_VIAL_TEMPLATES } from '../../data/craftedVials'
import {
  Draggable,
  gsap,
  registerGsapDraggable,
} from '../../lib/registerGsapDraggable'
import type { Vial } from '../../types'
import { useAlchemixStore } from '../../store/useAlchemixStore'
import { LabControlsFloating } from '../lab/LabControlsFloating'
import '../lab/alchemixLab.css'

registerGsapDraggable()

const LAB_UNDO_MAX = 80
const STORAGE_KEY_LAB_PLACED = 'alchemix-lab-placed'

function parseLabPlaced(raw: unknown): LabPlacedVial[] {
  if (!Array.isArray(raw)) return []
  const out: LabPlacedVial[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (
      typeof r.instanceId === 'string' &&
      typeof r.vialId === 'string' &&
      typeof r.xPct === 'number' &&
      typeof r.yPct === 'number' &&
      Number.isFinite(r.xPct) &&
      Number.isFinite(r.yPct)
    ) {
      out.push({
        instanceId: r.instanceId,
        vialId: r.vialId,
        xPct: r.xPct,
        yPct: r.yPct,
      })
    }
  }
  return out
}

function loadLabPlaced(): LabPlacedVial[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAB_PLACED)
    if (!raw) return []
    const parsed = parseLabPlaced(JSON.parse(raw) as unknown)
    let changed = false
    const migrated = parsed.map((row) => {
      const vialId = applyLegacyVialIdRename(row.vialId)
      if (vialId !== row.vialId) changed = true
      return { ...row, vialId }
    })
    if (changed) {
      saveLabPlaced(migrated)
    }
    return migrated
  } catch {
    return []
  }
}

function saveLabPlaced(placed: LabPlacedVial[]) {
  try {
    localStorage.setItem(STORAGE_KEY_LAB_PLACED, JSON.stringify(placed))
  } catch {
    /* quota / navigation privée */
  }
}

type LabHistorySnapshot = {
  placed: LabPlacedVial[]
  vials: Record<string, Vial>
  fusionCount: number
  offeringUseCount: Record<string, number>
}

function takeLabSnapshot(placed: LabPlacedVial[]): LabHistorySnapshot {
  const s = useAlchemixStore.getState()
  return {
    placed: placed.map((p) => ({ ...p })),
    fusionCount: s.fusionCount,
    offeringUseCount: { ...s.offeringUseCount },
    vials: structuredClone(s.vials),
  }
}

function chipFromDragTarget(target: HTMLElement): HTMLElement | null {
  return (target.querySelector('.lab-chipInventory') as HTMLElement | null) ?? target
}

function chipOverlapsInventoryColumn(chip: HTMLElement): boolean {
  const inv = document.querySelector('.lab-inventoryColumn')
  if (!(inv instanceof HTMLElement)) return false
  const ir = inv.getBoundingClientRect()
  const cr = chip.getBoundingClientRect()
  return (
    cr.right > ir.left &&
    cr.left < ir.right &&
    cr.bottom > ir.top &&
    cr.top < ir.bottom
  )
}

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

function playIconModalOpen(
  dim: HTMLElement,
  dialog: HTMLElement,
  fab: HTMLElement,
  onComplete: () => void,
) {
  const { dx, dy } = iconToDialogDelta(fab, dialog)
  gsap.killTweensOf([dim, dialog])
  gsap.set(dim, { opacity: 0, '--lab-controls-dim-blur': '0px' })
  gsap.set(dialog, {
    x: dx,
    y: dy,
    scale: 0.12,
    opacity: 0,
    transformOrigin: '50% 50%',
  })
  const tl = gsap.timeline({ onComplete })
  tl.to(
    dim,
    {
      opacity: 1,
      '--lab-controls-dim-blur': '1.5px',
      duration: 0.4,
      ease: 'power1.out',
    },
    0,
  )
  tl.to(
    dialog,
    { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.42, ease: 'power2.out' },
    0,
  )
  return tl
}

function playIconModalClose(
  dim: HTMLElement,
  dialog: HTMLElement,
  fab: HTMLElement,
  onComplete: () => void,
) {
  const { dx, dy } = iconToDialogDelta(fab, dialog)
  gsap.killTweensOf([dim, dialog])
  const tl = gsap.timeline({ onComplete })
  tl.to(
    dialog,
    {
      x: dx,
      y: dy,
      scale: 0.12,
      opacity: 0,
      duration: 0.32,
      ease: 'power2.in',
    },
    0,
  )
  tl.to(
    dim,
    {
      opacity: 0,
      '--lab-controls-dim-blur': '0px',
      duration: 0.32,
      ease: 'power1.in',
    },
    0.04,
  )
  return tl
}

/** Réduction + disparition avant retrait du state (clic droit, retour inventaire). */
function shrinkRemoveLabVial(
  el: HTMLElement | null | undefined,
  onComplete: () => void,
) {
  if (!el) {
    onComplete()
    return
  }
  gsap.killTweensOf(el)
  gsap.to(el, {
    scale: 0,
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
    transformOrigin: '50% 50%',
    onComplete,
  })
}

/** Même principe que la suppression : les deux cartes rétrécissent puis disparition. */
function animateFusionShrinkPair(
  elA: HTMLElement | null | undefined,
  elB: HTMLElement | null | undefined,
  onComplete: () => void,
) {
  const nodes = [elA, elB].filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  )
  if (nodes.length === 0) {
    onComplete()
    return
  }
  for (const el of nodes) {
    gsap.killTweensOf(el)
  }
  const tl = gsap.timeline({ onComplete })
  for (const el of nodes) {
    tl.to(
      el,
      {
        scale: 0,
        opacity: 0,
        duration: 0.16,
        ease: 'power2.in',
        transformOrigin: '50% 50%',
      },
      0,
    )
  }
}

function canvasChipForInstance(
  canvasRoot: HTMLElement | null | undefined,
  instanceId: string,
): HTMLElement | null {
  if (!canvasRoot) return null
  const host = canvasRoot.querySelector(
    `[data-lab-canvas-vial="${CSS.escape(instanceId)}"]`,
  )
  if (!(host instanceof HTMLElement)) return null
  const chip = host.querySelector('.lab-chipInventory')
  return chip instanceof HTMLElement ? chip : null
}

export function AlchemixShell() {
  const vialsById = useAlchemixStore((s) => s.vials)
  const resetToStarters = useAlchemixStore((s) => s.resetToStarters)
  const sortName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })

  const inventoryGroups = useMemo(() => {
    const list = Object.values(vialsById)
    return {
      elements: list.filter((v) => v.type === 'element').sort(sortName),
    }
  }, [vialsById])

  const creatureCatalog = useMemo(
    () =>
      Object.values(CRAFTED_VIAL_TEMPLATES)
        .filter((v) => v.type === 'creature')
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
    [],
  )
  const discoveredCreatureIds = useMemo(() => {
    const ids = new Set<string>()
    for (const v of Object.values(vialsById)) {
      if (v.type === 'creature') ids.add(v.id)
    }
    return ids
  }, [vialsById])

  const [placed, setPlaced] = useState<LabPlacedVial[]>(() => loadLabPlaced())
  const [selectedIdsArr, setSelectedIdsArr] = useState<string[]>([])
  const selectedIds = useMemo(() => new Set(selectedIdsArr), [selectedIdsArr])
  const selectedIdsRef = useRef<ReadonlySet<string>>(selectedIds)
  selectedIdsRef.current = selectedIds

  const [sipHint, setSipHint] = useState<string | null>(null)
  const [inventoryGhostActive, setInventoryGhostActive] = useState(false)
  const [trophyOpen, setTrophyOpen] = useState(false)
  const offerDockRef = useRef<HTMLButtonElement>(null)
  const trophyFabRef = useRef<HTMLButtonElement>(null)
  const trophyDimRef = useRef<HTMLDivElement>(null)
  const trophyDialogRef = useRef<HTMLDivElement>(null)
  const trophyClosingRef = useRef(false)
  const trophyOpenRef = useRef(trophyOpen)
  trophyOpenRef.current = trophyOpen
  const sipTimerRef = useRef(0)

  const canvasRef = useRef<HTMLDivElement>(null)
  const grabOffsetRef = useRef<{ dx: number; dy: number } | null>(null)
  const placedRef = useRef(placed)
  placedRef.current = placed

  useEffect(() => {
    saveLabPlaced(placed)
  }, [placed])

  useEffect(() => {
    setPlaced((prev) => {
      const next = prev.filter((p) => vialsById[p.vialId])
      return next.length === prev.length ? prev : next
    })
  }, [vialsById])

  const labUndoPastRef = useRef<LabHistorySnapshot[]>([])
  const labUndoFutureRef = useRef<LabHistorySnapshot[]>([])
  const labApplyingHistoryRef = useRef(false)

  const snapshotLabNow = useCallback(
    () => takeLabSnapshot(placedRef.current),
    [],
  )

  const pushLabUndoHistory = useCallback(() => {
    if (labApplyingHistoryRef.current) return
    labUndoPastRef.current.push(snapshotLabNow())
    if (labUndoPastRef.current.length > LAB_UNDO_MAX) {
      labUndoPastRef.current.shift()
    }
    labUndoFutureRef.current = []
  }, [snapshotLabNow])

  const applyLabHistorySnapshot = useCallback((snap: LabHistorySnapshot) => {
    useAlchemixStore.setState({
      vials: snap.vials,
      fusionCount: snap.fusionCount,
      offeringUseCount: snap.offeringUseCount,
    })
    setPlaced(snap.placed)
    setSelectedIdsArr([])
  }, [])

  const undoLab = useCallback(() => {
    if (labUndoPastRef.current.length === 0) return
    const cur = snapshotLabNow()
    const prev = labUndoPastRef.current.pop()!
    labUndoFutureRef.current.push(cur)
    labApplyingHistoryRef.current = true
    applyLabHistorySnapshot(prev)
    labApplyingHistoryRef.current = false
  }, [applyLabHistorySnapshot, snapshotLabNow])

  const redoLab = useCallback(() => {
    if (labUndoFutureRef.current.length === 0) return
    const cur = snapshotLabNow()
    const next = labUndoFutureRef.current.pop()!
    labUndoPastRef.current.push(cur)
    labApplyingHistoryRef.current = true
    applyLabHistorySnapshot(next)
    labApplyingHistoryRef.current = false
  }, [applyLabHistorySnapshot, snapshotLabNow])

  const clearLabUndoHistory = useCallback(() => {
    labUndoPastRef.current = []
    labUndoFutureRef.current = []
  }, [])

  useEffect(() => {
    const valid = new Set(placed.map((p) => p.instanceId))
    setSelectedIdsArr((prev) => prev.filter((id) => valid.has(id)))
  }, [placed])

  const clearLabSelection = useCallback(() => {
    setSelectedIdsArr([])
  }, [])

  const selectSingleLab = useCallback((instanceId: string) => {
    setSelectedIdsArr([instanceId])
  }, [])

  const toggleLabSelection = useCallback((instanceId: string) => {
    setSelectedIdsArr((prev) => {
      const s = new Set(prev)
      if (s.has(instanceId)) s.delete(instanceId)
      else s.add(instanceId)
      return [...s]
    })
  }, [])

  const addToLabSelection = useCallback((instanceIds: string[]) => {
    if (instanceIds.length === 0) return
    setSelectedIdsArr((prev) => [...new Set([...prev, ...instanceIds])])
  }, [])

  const setMarqueeLabSelection = useCallback(
    (instanceIds: string[], mode: 'replace' | 'add') => {
      const next = new Set(mode === 'add' ? [...selectedIdsRef.current] : [])
      for (const id of instanceIds) next.add(id)
      setSelectedIdsArr([...next])
    },
    [],
  )

  const isLabSelected = useCallback(
    (instanceId: string) => selectedIds.has(instanceId),
    [selectedIds],
  )

  const removeSelectedPlaced = useCallback(() => {
    const ids = [...selectedIdsRef.current]
    if (ids.length === 0) return
    pushLabUndoHistory()
    const root = canvasRef.current
    if (!root) {
      setPlaced((prev) => prev.filter((p) => !ids.includes(p.instanceId)))
      setSelectedIdsArr([])
      return
    }
    const chips = ids
      .map((id) => canvasChipForInstance(root, id))
      .filter((c): c is HTMLElement => c !== null)
    if (chips.length === 0) {
      setPlaced((prev) => prev.filter((p) => !ids.includes(p.instanceId)))
      setSelectedIdsArr([])
      return
    }
    let remaining = chips.length
    const onOneDone = () => {
      remaining -= 1
      if (remaining <= 0) {
        setPlaced((prev) => prev.filter((p) => !ids.includes(p.instanceId)))
        setSelectedIdsArr([])
      }
    }
    for (const ch of chips) shrinkRemoveLabVial(ch, onOneDone)
  }, [pushLabUndoHistory])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]'))
        return

      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z' && !e.altKey) {
        e.preventDefault()
        if (e.shiftKey) redoLab()
        else undoLab()
        return
      }
      if (mod && key === 'y' && !e.altKey) {
        e.preventDefault()
        redoLab()
        return
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (selectedIdsRef.current.size === 0) return
      e.preventDefault()
      removeSelectedPlaced()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [redoLab, removeSelectedPlaced, undoLab])

  const requestCloseTrophy = useCallback(() => {
    if (!trophyOpenRef.current || trophyClosingRef.current) return
    trophyClosingRef.current = true
    const dim = trophyDimRef.current
    const dlg = trophyDialogRef.current
    const fab = trophyFabRef.current
    if (!dim || !dlg || !fab) {
      setTrophyOpen(false)
      trophyClosingRef.current = false
      return
    }
    playIconModalClose(dim, dlg, fab, () => {
      setTrophyOpen(false)
      trophyClosingRef.current = false
    })
  }, [])

  useLayoutEffect(() => {
    if (!trophyOpen) return
    const dim = trophyDimRef.current
    const dlg = trophyDialogRef.current
    const fab = trophyFabRef.current
    if (!dim || !dlg || !fab) return
    const tl = playIconModalOpen(dim, dlg, fab, () => {
      dlg.querySelector<HTMLButtonElement>('.lab-controls-close')?.focus()
    })
    return () => {
      tl.kill()
      gsap.killTweensOf([dim, dlg])
    }
  }, [trophyOpen])

  useEffect(() => {
    if (!trophyOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      requestCloseTrophy()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestCloseTrophy, trophyOpen])

  const labSelectionValue = useMemo(
    () => ({
      selectedIdsRef,
      selectedIds,
      clearSelection: clearLabSelection,
      selectSingle: selectSingleLab,
      toggleInSelection: toggleLabSelection,
      addToSelection: addToLabSelection,
      setMarqueeSelection: setMarqueeLabSelection,
      isSelected: isLabSelected,
    }),
    [
      selectedIds,
      clearLabSelection,
      selectSingleLab,
      toggleLabSelection,
      addToLabSelection,
      setMarqueeLabSelection,
      isLabSelected,
    ],
  )

  const showSipHint = useCallback((msg: string) => {
    window.clearTimeout(sipTimerRef.current)
    setSipHint(msg)
    sipTimerRef.current = window.setTimeout(() => setSipHint(null), 3200)
  }, [])

  useEffect(
    () => () => {
      window.clearTimeout(sipTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!inventoryGhostActive) return
    document.body.classList.add('lab-invGhostDrag')
    return () => {
      document.body.classList.remove('lab-invGhostDrag')
    }
  }, [inventoryGhostActive])

  const findHitPlacedVial = useCallback(
    (chip: Element, excludeInstanceId?: string): LabPlacedVial | null => {
      for (const p of placedRef.current) {
        if (excludeInstanceId && p.instanceId === excludeInstanceId) continue
        const el = document.querySelector(
          `[data-lab-drop-target="${CSS.escape(p.instanceId)}"]`,
        )
        if (
          chip instanceof HTMLElement &&
          el instanceof HTMLElement &&
          fusionCardsOverlap(chip, el)
        ) {
          return p
        }
      }
      return null
    },
    [],
  )

  const tryOfferAtDock = useCallback(
    (vialId: string, instanceId: string | undefined, chip: HTMLElement) => {
      const sipEl = offerDockRef.current
      const canvasEl = canvasRef.current
      if (!sipEl || !canvasEl) return false
      if (!Draggable.hitTest(chip, sipEl, '30%')) return false

      const store = useAlchemixStore.getState()
      const vial = store.vials[vialId]
      if (!vial || vial.type !== 'element') {
        showSipHint('Only elements can be offered.')
        return true
      }
      pushLabUndoHistory()
      const result: DrinkSpellResult = store.offerElementToCharacter(vialId)
      if (instanceId) {
        setPlaced((prev) => prev.filter((p) => p.instanceId !== instanceId))
      }
      switch (result.ok) {
        case true:
          showSipHint(`Trophy unlocked: ${result.creature.name}`)
          break
        case false: {
          const { reason } = result
          if (reason === 'no_creature') {
            showSipHint('No trophy creature for this element yet.')
          } else if (reason === 'already_owned') {
            showSipHint('Trophy already unlocked.')
          }
          break
        }
      }
      return true
    },
    [pushLabUndoHistory, showSipHint],
  )

  const completeInventoryDrag = useCallback(
    (vialId: string, info: InventoryDragEndInfo) => {
      const target = info.target
      const chip = chipFromDragTarget(target)
      const canvasEl = canvasRef.current
      if (!chip || !canvasEl) return

      const hitVial = findHitPlacedVial(chip)
      if (hitVial) {
        const { vials, addVial, recordFusion } = useAlchemixStore.getState()
        const va = vials[hitVial.vialId]
        const vb = vials[vialId]
        if (!va || !vb) return
        const outcome = resolveFusionProduct(va, vb, vials)
        if (!outcome.ok) {
          showSipHint('This mix stays inert.')
          return
        }
        pushLabUndoHistory()
        const { vial: result, wasNew } = outcome
        if (wasNew) addVial(result)
        recordFusion()
        const targetInstanceId = hitVial.instanceId
        const targetChip = canvasChipForInstance(canvasEl, targetInstanceId)
        const newEntry: LabPlacedVial = {
          instanceId: crypto.randomUUID(),
          vialId: result.id,
          xPct: hitVial.xPct,
          yPct: hitVial.yPct,
        }
        const applyFusion = () =>
          setPlaced((cur) => {
            const hasTarget = cur.some((p) => p.instanceId === targetInstanceId)
            if (!hasTarget) return cur
            return cur
              .filter((p) => p.instanceId !== targetInstanceId)
              .concat(newEntry)
          })

        if (targetChip) {
          return new Promise<void>((resolve) => {
            animateFusionShrinkPair(chip, targetChip, () => {
              applyFusion()
              resolve()
            })
          })
        }
        applyFusion()
        return
      }

      if (tryOfferAtDock(vialId, undefined, chip)) return

      /* Retour sur la colonne inventaire (drag annulé) : même animation que retirer une fiole du labo. */
      if (chipOverlapsInventoryColumn(chip)) {
        return new Promise<void>((resolve) => {
          shrinkRemoveLabVial(chip, resolve)
        })
      }

      /* Centre réel de la carte (fantôme) au lâcher — évite tout décalage si grabOffsetRef était pris avant le 1er clamp. */
      const cr = chip.getBoundingClientRect()
      if (cr.width >= 1 && cr.height >= 1) {
        const cx = cr.left + cr.width / 2
        const cy = cr.top + cr.height / 2
        if (clientPointInCanvasPlacement(canvasEl, cx, cy)) {
          const pos = clientPointToCanvasPercent(canvasEl, cx, cy)
          pushLabUndoHistory()
          setPlaced((prev) => [
            ...prev,
            {
              instanceId: crypto.randomUUID(),
              vialId,
              ...pos,
            },
          ])
        }
      }
    },
    [findHitPlacedVial, pushLabUndoHistory, showSipHint, tryOfferAtDock],
  )

  const completeLabDrag = useCallback(
    (instanceId: string, vialId: string, drag: Draggable): boolean => {
      const target = drag.target as HTMLElement
      const chip = chipFromDragTarget(target)
      const canvasEl = canvasRef.current
      if (!chip || !canvasEl) return false

      const sel = selectedIdsRef.current
      const groupIds =
        sel.size > 1 && sel.has(instanceId) ? [...sel] : [instanceId]
      const isGroupDrag = groupIds.length > 1

      const hitVial = !isGroupDrag
        ? findHitPlacedVial(chip, instanceId)
        : null
      if (hitVial) {
        const targetInstanceId = hitVial.instanceId
        const targetPlaced = placedRef.current.find(
          (p) => p.instanceId === targetInstanceId,
        )
        const sourcePlaced = placedRef.current.find(
          (p) => p.instanceId === instanceId,
        )
        if (!targetPlaced || !sourcePlaced) return false
        const { vials, addVial, recordFusion } = useAlchemixStore.getState()
        const va = vials[targetPlaced.vialId]
        const vb = vials[vialId]
        if (!va || !vb) return false
        const outcome = resolveFusionProduct(va, vb, vials)
        if (!outcome.ok) {
          showSipHint('This mix stays inert.')
          return false
        }
        pushLabUndoHistory()
        const { vial: result, wasNew } = outcome
        if (wasNew) addVial(result)
        recordFusion()
        const newEntry: LabPlacedVial = {
          instanceId: crypto.randomUUID(),
          vialId: result.id,
          xPct: targetPlaced.xPct,
          yPct: targetPlaced.yPct,
        }
        const sourceChip = chip
        const targetChip = canvasChipForInstance(canvasEl, targetInstanceId)
        const applyFusion = () =>
          setPlaced((cur) => {
            const hasBoth =
              cur.some((p) => p.instanceId === targetInstanceId) &&
              cur.some((p) => p.instanceId === instanceId)
            if (!hasBoth) return cur
            return cur
              .filter(
                (p) =>
                  p.instanceId !== targetInstanceId &&
                  p.instanceId !== instanceId,
              )
              .concat(newEntry)
          })

        if (sourceChip && targetChip) {
          animateFusionShrinkPair(sourceChip, targetChip, applyFusion)
          return true
        }
        applyFusion()
        return false
      }

      if (!isGroupDrag && tryOfferAtDock(vialId, instanceId, chip))
        return false

      if (chipOverlapsInventoryColumn(chip)) {
        pushLabUndoHistory()
        const canvasRoot = canvasEl
        if (chip instanceof HTMLElement && canvasRoot.contains(chip)) {
          if (isGroupDrag) {
            const chips = groupIds
              .map((id) => canvasChipForInstance(canvasEl, id))
              .filter((c): c is HTMLElement => c !== null)
            if (chips.length === 0) {
              setPlaced((prev) =>
                prev.filter((p) => !groupIds.includes(p.instanceId)),
              )
              setSelectedIdsArr([])
              return false
            }
            let remaining = chips.length
            const onOneDone = () => {
              remaining -= 1
              if (remaining <= 0) {
                setPlaced((prev) =>
                  prev.filter((p) => !groupIds.includes(p.instanceId)),
                )
                setSelectedIdsArr([])
              }
            }
            for (const ch of chips) shrinkRemoveLabVial(ch, onOneDone)
            return true
          }
          shrinkRemoveLabVial(chip, () => {
            setPlaced((prev) => prev.filter((p) => p.instanceId !== instanceId))
          })
          return true
        }
        setPlaced((prev) =>
          prev.filter((p) => !groupIds.includes(p.instanceId)),
        )
        return false
      }

      const grab = grabOffsetRef.current
      const { cx, cy } = grabCenterClient(drag, grab, chip)
      if (clientPointInCanvasPlacement(canvasEl, cx, cy)) {
        const pos = clientPointToCanvasPercent(canvasEl, cx, cy)
        const leaderOld = placedRef.current.find(
          (p) => p.instanceId === instanceId,
        )
        if (!leaderOld) return false
        const dx = pos.xPct - leaderOld.xPct
        const dy = pos.yPct - leaderOld.yPct
        if (dx !== 0 || dy !== 0) {
          pushLabUndoHistory()
          setPlaced((prev) =>
            prev.map((p) => {
              if (!groupIds.includes(p.instanceId)) return p
              const np = clampLabPlacementPercent(p.xPct + dx, p.yPct + dy)
              return { ...p, ...np }
            }),
          )
        }
      }
      return false
    },
    [findHitPlacedVial, pushLabUndoHistory, showSipHint, tryOfferAtDock],
  )

  const placeInventoryVialNearLabCenter = useCallback((vialId: string) => {
    const v = useAlchemixStore.getState().vials[vialId]
    if (!v) return
    /** Rayon max en % du centre (50,50) — répartition uniforme dans le disque, puis clamp labo. */
    const maxRadiusPct = 30
    const angle = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * maxRadiusPct
    const rawX = 50 + Math.cos(angle) * r
    const rawY = 50 + Math.sin(angle) * r
    const { xPct, yPct } = clampLabPlacementPercent(rawX, rawY)
    pushLabUndoHistory()
    setPlaced((prev) => [
      ...prev,
      { instanceId: crypto.randomUUID(), vialId, xPct, yPct },
    ])
  }, [pushLabUndoHistory])

  const labDragValue = useMemo(
    () => ({
      grabOffsetRef,
      labCanvasRef: canvasRef,
      completeInventoryDrag,
      completeLabDrag,
      setInventoryGhostDragging: setInventoryGhostActive,
      placeInventoryVialNearLabCenter,
    }),
    [completeInventoryDrag, completeLabDrag, placeInventoryVialNearLabCenter],
  )

  const removePlaced = useCallback(
    (instanceId: string) => {
      pushLabUndoHistory()
      const root = canvasRef.current
      const host = root?.querySelector(
        `[data-lab-canvas-vial="${CSS.escape(instanceId)}"]`,
      ) as HTMLElement | null
      const chipEl = host?.querySelector(
        '.lab-chipInventory',
      ) as HTMLElement | null
      shrinkRemoveLabVial(chipEl, () => {
        setPlaced((prev) => prev.filter((p) => p.instanceId !== instanceId))
      })
    },
    [pushLabUndoHistory],
  )

  const duplicatePlaced = useCallback(
    (source: LabPlacedVial) => {
      /** Décalage centre → centre pour l’empilement visuel (bas-droite), en px CSS. */
      const stepPx = 18
      const canvasEl = canvasRef.current
      const rect = canvasEl?.getBoundingClientRect()
      let dxPct = 3.2
      let dyPct = 2.8
      if (rect && rect.width > 0 && rect.height > 0) {
        dxPct = (stepPx / rect.width) * 100
        dyPct = (stepPx / rect.height) * 100
      }
      pushLabUndoHistory()
      setPlaced((prev) => [
        ...prev,
        {
          instanceId: crypto.randomUUID(),
          vialId: source.vialId,
          xPct: Math.min(94, Math.max(6, source.xPct + dxPct)),
          yPct: Math.min(90, Math.max(10, source.yPct + dyPct)),
        },
      ])
    },
    [pushLabUndoHistory],
  )

  const clearLabCanvas = useCallback(() => {
    const ids = placedRef.current.map((p) => p.instanceId)
    if (ids.length === 0) return
    pushLabUndoHistory()
    const root = canvasRef.current
    if (!root) {
      setPlaced([])
      setSelectedIdsArr([])
      return
    }
    let remaining = ids.length
    const onOneDone = () => {
      remaining -= 1
      if (remaining <= 0) {
        setPlaced([])
        setSelectedIdsArr([])
      }
    }
    for (const id of ids) {
      const chip = canvasChipForInstance(root, id)
      shrinkRemoveLabVial(chip, onOneDone)
    }
  }, [pushLabUndoHistory])

  const handleReset = () => {
    clearLabUndoHistory()
    resetToStarters()
    setPlaced([])
  }

  return (
    <div
      className="alchemix-lab flex h-full min-h-0 min-w-0 flex-1 flex-col"
      onContextMenu={(e) => e.preventDefault()}
    >
      <LabDragContext.Provider value={labDragValue}>
        <LabSelectionContext.Provider value={labSelectionValue}>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(220px,19.5rem)] gap-0 text-left max-[560px]:grid-cols-[minmax(0,1fr)_minmax(140px,36vw)]">
          <div className="relative z-10 h-full min-h-0 min-w-0 border-r border-[color:var(--border)] bg-[color:var(--panel-bg,var(--code-bg))]">
            <section
              className="absolute inset-0 overflow-visible"
              aria-label="Play area"
            >
              <LabCanvas
                placed={placed}
                vialsById={vialsById}
                canvasRef={canvasRef}
                onRemovePlaced={removePlaced}
                onRemoveSelectedPlaced={removeSelectedPlaced}
                onDuplicatePlaced={duplicatePlaced}
              />
            </section>
            <LabControlsFloating
              onClearCanvas={clearLabCanvas}
              canClearCanvas={placed.length > 0}
              onResetProgress={handleReset}
              leadingFabs={
                <div className="lab-fabWithTooltip pointer-events-auto">
                  <button
                    ref={trophyFabRef}
                    type="button"
                    className="lab-controls-fab"
                    onClick={() => {
                      if (trophyClosingRef.current) return
                      if (trophyOpenRef.current) requestCloseTrophy()
                      else setTrophyOpen(true)
                    }}
                    aria-expanded={trophyOpen}
                    aria-haspopup="dialog"
                    aria-label="Creatures"
                  >
                    <Trophy size={22} strokeWidth={2} aria-hidden className="shrink-0" />
                  </button>
                  <span className="lab-fabTooltip" aria-hidden="true">
                    Creatures
                  </span>
                </div>
              }
            />
            <div className="lab-offerDock pointer-events-none absolute bottom-0 left-0 z-40 p-2 max-[560px]:p-1.5">
              <div className="lab-fabWithTooltip pointer-events-auto">
                <button
                  ref={offerDockRef}
                  type="button"
                  className="lab-controls-fab lab-offerFab"
                  aria-label="Offer element for creature unlock"
                >
                  <FlaskConical size={40} strokeWidth={2} aria-hidden className="shrink-0" />
                </button>
              </div>
              {sipHint ? (
                <p className="lab-offerHint pointer-events-none" aria-live="polite">
                  {sipHint}
                </p>
              ) : null}
            </div>
            {trophyOpen ? (
              <div
                className="lab-trophyOverlay"
                role="presentation"
                ref={trophyDimRef}
                onClick={(e) => {
                  if (e.target === e.currentTarget) requestCloseTrophy()
                }}
              >
                <div className="lab-trophyDialogLayer">
                  <div
                    className="lab-trophyPopup"
                    ref={trophyDialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Creatures to discover"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <header className="lab-trophyPopupHeader">
                      <h3 className="lab-trophyPopupTitle">Creatures to discover</h3>
                      <button
                        type="button"
                        className="lab-controls-close"
                        onClick={requestCloseTrophy}
                        aria-label="Close creature popup"
                      >
                        <X size={16} strokeWidth={2} aria-hidden />
                      </button>
                    </header>
                    <ul className="lab-trophyList" role="list">
                      {creatureCatalog.map((creature) => {
                        const discovered = discoveredCreatureIds.has(creature.id)
                        return (
                          <li key={creature.id} className="lab-trophyRow">
                          <span className="lab-trophyThumb" aria-hidden />
                            <span className="lab-trophyName">
                              {discovered ? creature.name : '???'}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <aside
            className="lab-inventoryColumn relative z-0 flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
            aria-label="Inventory"
          >
            <InventoryPanel
              elements={inventoryGroups.elements}
            />
          </aside>
        </div>
        </LabSelectionContext.Provider>
      </LabDragContext.Provider>
    </div>
  )
}
