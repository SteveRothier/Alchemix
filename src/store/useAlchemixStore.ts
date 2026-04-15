import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { stampStarterVials } from '../data/starterVials'
import {
  migrateElNatureToGrassInStore,
  reconcileStarterVialsWithDefinitions,
} from '../lib/legacyVialIdRenames'
import { resolveDrinkSpell, type DrinkSpellResult } from '../lib/drinkSpell'
import type { Vial } from '../types'

const PERSIST_KEY = 'alchemix-save'
const PERSIST_VERSION = 4

function freshStarterState(isoTime: string) {
  return {
    vials: stampStarterVials(isoTime),
    fusionCount: 0,
    offeringUseCount: {} as Record<string, number>,
  }
}

type PersistedData = {
  vials: Record<string, Vial>
  fusionCount: number
  offeringUseCount: Record<string, number>
}

export type AlchemixState = PersistedData & {
  addVial: (vial: Vial) => void
  recordFusion: () => void
  incrementOfferingUse: (vialId: string) => void
  /** Offer an element to the character and maybe unlock a creature trophy. */
  offerElementToCharacter: (vialId: string) => DrinkSpellResult
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

      incrementOfferingUse: (vialId) =>
        set((s) => ({
          offeringUseCount: {
            ...s.offeringUseCount,
            [vialId]: (s.offeringUseCount[vialId] ?? 0) + 1,
          },
        })),

      offerElementToCharacter: (vialId) => {
        const offered = get().vials[vialId]
        if (!offered || offered.type !== 'element') {
          return { ok: false, reason: 'not_element' }
        }
        const vials = get().vials
        const result = resolveDrinkSpell(offered, vials)
        const nextUse = (get().offeringUseCount[vialId] ?? 0) + 1
        if (result.ok) {
          set((s) => ({
            offeringUseCount: { ...s.offeringUseCount, [vialId]: nextUse },
            vials: { ...s.vials, [result.creature.id]: result.creature },
          }))
        } else {
          set((s) => ({
            offeringUseCount: { ...s.offeringUseCount, [vialId]: nextUse },
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
        offeringUseCount: state.offeringUseCount,
      }),
      migrate: (persisted, version) => {
        const data = persisted as PersistedData & {
          spellUseCount?: Record<string, number>
        }
        if (!data.offeringUseCount) {
          data.offeringUseCount = data.spellUseCount ?? {}
        }
        if (version < 2 && data.vials) {
          for (const id of Object.keys(data.vials)) {
            if (id.startsWith('creature-')) {
              const v = data.vials[id]
              if (v) data.vials[id] = { ...v, type: 'creature' }
            }
          }
        }
        if (data.vials) {
          migrateElNatureToGrassInStore(data.vials, data.offeringUseCount)
        }
        if (version < 4 && data.vials) {
          reconcileStarterVialsWithDefinitions(data.vials)
        }
        return data
      },
    },
  ),
)

export function selectDiscoveryCount(state: AlchemixState): number {
  return Object.keys(state.vials).length
}
