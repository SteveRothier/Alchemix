import { createContext, useContext } from 'react'

export type LabSelectionContextValue = {
  /** Lecture synchrone dans les callbacks GSAP / completeLabDrag. */
  selectedIdsRef: React.MutableRefObject<ReadonlySet<string>>
  selectedIds: ReadonlySet<string>
  clearSelection: () => void
  selectSingle: (instanceId: string) => void
  toggleInSelection: (instanceId: string) => void
  addToSelection: (instanceIds: string[]) => void
  setMarqueeSelection: (instanceIds: string[], mode: 'replace' | 'add') => void
  isSelected: (instanceId: string) => boolean
}

export const LabSelectionContext = createContext<LabSelectionContextValue | null>(
  null,
)

export function useLabSelection(): LabSelectionContextValue | null {
  return useContext(LabSelectionContext)
}
