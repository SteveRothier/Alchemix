import type { Vial } from '../types'

export type NewVialDraft = Omit<Vial, 'id' | 'discoveredAt'>

export interface DynamicVialGenerator {
  generateElement(ingredientA: Vial, ingredientB: Vial): NewVialDraft
  generateSpell(ingredientA: Vial, ingredientB: Vial): NewVialDraft
}
