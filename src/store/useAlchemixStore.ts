import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { stampStarterVials } from '../data/starterVials'
import { resolveDrinkSpell, type DrinkSpellResult } from '../lib/drinkSpell'
import type { Vial } from '../types'

const PERSIST_KEY = 'alchemix-save'
const PERSIST_VERSION = 2

function freshStarterState(isoTime: string) {
  return {
    vials: stampStarterVials(isoTime),
    fusionCount: 0,
    spellUseCount: {} as Record<string, number>,
  }
}

type PersistedData = {
  vials: Record<string, Vial>
  fusionCount: number
  spellUseCount: Record<string, number>
}

export type AlchemixState = PersistedData & {
  addVial: (vial: Vial) => void
  recordFusion: () => void
  incrementSpellUse: (vialId: string) => void
  /** Fait boire un sort au personnage : usage + éventuelle créature (première fois). */
  feedSpellToCharacter: (spellVialId: string) => DrinkSpellResult
  resetToStarters: () => void
}

const initialData = freshStarterState(new Date().toISOString())

export const useAlchemixStore = create<AlchemixState>()(
  persist(
    (set, get) => ({
      ...initialData,

      addVial: (vial) =>
        set((s) => ({
          vials: { ...s.vials, [vial.id]: vial },
        })),

      recordFusion: () =>
        set((s) => ({
          fusionCount: s.fusionCount + 1,
        })),

      incrementSpellUse: (vialId) =>
        set((s) => ({
          spellUseCount: {
            ...s.spellUseCount,
            [vialId]: (s.spellUseCount[vialId] ?? 0) + 1,
          },
        })),

      feedSpellToCharacter: (spellVialId) => {
        const spell = get().vials[spellVialId]
        if (!spell || spell.type !== 'spell') {
          return { ok: false, reason: 'not_spell' }
        }
        const vials = get().vials
        const result = resolveDrinkSpell(spell, vials)
        const nextUse = (get().spellUseCount[spellVialId] ?? 0) + 1
        if (result.ok) {
          set((s) => ({
            spellUseCount: { ...s.spellUseCount, [spellVialId]: nextUse },
            vials: { ...s.vials, [result.creature.id]: result.creature },
          }))
        } else {
          set((s) => ({
            spellUseCount: { ...s.spellUseCount, [spellVialId]: nextUse },
          }))
        }
        return result
      },

      resetToStarters: () => set(freshStarterState(new Date().toISOString())),
    }),
    {
      name: PERSIST_KEY,
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedData => ({
        vials: state.vials,
        fusionCount: state.fusionCount,
        spellUseCount: state.spellUseCount,
      }),
      migrate: (persisted, version) => {
        const data = persisted as PersistedData
        if (version < 2 && data.vials) {
          for (const id of Object.keys(data.vials)) {
            if (id.startsWith('creature-')) {
              const v = data.vials[id]
              if (v) data.vials[id] = { ...v, type: 'creature' }
            }
          }
        }
        return data
      },
    },
  ),
)

export function selectDiscoveryCount(state: AlchemixState): number {
  return Object.keys(state.vials).length
}
