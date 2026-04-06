import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { stampStarterVials } from '../data/starterVials'
import type { Vial } from '../types'

const PERSIST_KEY = 'alchemix-save'
const PERSIST_VERSION = 1

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
  resetToStarters: () => void
}

const initialData = freshStarterState(new Date().toISOString())

export const useAlchemixStore = create<AlchemixState>()(
  persist(
    (set) => ({
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
        void version
        return persisted as PersistedData
      },
    },
  ),
)

export function selectDiscoveryCount(state: AlchemixState): number {
  return Object.keys(state.vials).length
}
