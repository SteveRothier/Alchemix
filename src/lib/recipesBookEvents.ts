/** Émis sur `window` pour ouvrir la modale Recettes sur le détail d’une fiole (ex. inventaire : clic droit). */
export const RECIPES_BOOK_OPEN_EVENT = 'alchemix-open-recipes-book'

export type RecipesBookOpenDetail = { vialId: string }

export function requestOpenRecipesBookToVial(vialId: string) {
  window.dispatchEvent(
    new CustomEvent<RecipesBookOpenDetail>(RECIPES_BOOK_OPEN_EVENT, {
      detail: { vialId: vialId.trim() },
    }),
  )
}
