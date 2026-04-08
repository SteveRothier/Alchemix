# Alchemix



## Stack technique

- **React 19** + **TypeScript**
- **Vite 8** (build & dev server)
- **Zustand** avec persistance (`localStorage`) pour l’inventaire et les compteurs
- **@dnd-kit** pour le drag & drop (inventaire → labo, fusions sur le plateau)
- **GSAP** (animations côté effets / UI si utilisés)
- **Vitest** pour quelques tests sur la logique de fusion

## Lancer le projet

```bash
npm install
npm run dev
```

Autres commandes utiles :

```bash
npm run build   # TypeScript + build Vite
npm run lint
npm run test    # Vitest (fusions dynamiques, noms d’éléments)
```

## Boucle de jeu

1. **Inventaire** (colonne de droite) : éléments, sorts et créatures découverts.
2. **Laboratoire** : tu poses des fioles sur le plateau, tu les déplaces, tu en superposes une sur une pour **fusionner**.
3. **Personnage** : certaines fioles de type **sort** peuvent être données à boire au personnage ; cela peut faire apparaître une **créature** (liée au sort dans la config).
4. **Reset** : réinitialise la progression et repart des éléments de départ (voir ci‑dessous).

## Système de fusion

## UX laboratoire & inventaire

- **Double-clic** sur une fiole déjà posée dans le labo : **duplication** sur le plateau (léger décalage).
- **Clic droit** sur une fiole du labo : retirer du plateau.

## Structure utile du code


| Zone                        | Fichiers / dossiers                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Shell UI, DnD, état plateau | `src/components/layout/AlchemixShell.tsx`                                                             |
| Zone labo                   | `src/components/game/LabCanvas.tsx`, `CanvasVialItem.tsx`                                             |
| Inventaire                  | `src/components/inventory/`                                                                           |
| Données fioles & recettes   | `src/data/craftedVials.ts`, `src/data/starterVials.ts`                                                |
| Fusion & dynamique          | `src/lib/fusion.ts`, `src/lib/dynamicVial.ts`, `src/lib/dynamicElement.ts`, `src/lib/dynamicSpell.ts` |
| Persistance                 | `src/store/useAlchemixStore.ts`                                                                       |
| Types                       | `src/types/index.ts`                                                                                  |


