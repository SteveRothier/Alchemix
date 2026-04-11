# Alchemix

Jeu d’alchimie en React : tu combines des fioles (éléments, sorts, créatures), tu découvres de nouvelles recettes, et tu fais progresser ton inventaire.

## Démarrage rapide

```bash
npm install
npm run dev
```

Application disponible ensuite sur l’URL affichée par Vite (souvent `http://localhost:5173`).

## Scripts utiles

```bash
npm run dev     # lancement local
npm run build   # vérification TypeScript + build production Vite
npm run lint    # ESLint
npm run test    # Vitest
```

## Stack technique

- React 19 + TypeScript
- Vite 8
- Zustand (persistance `localStorage`)
- GSAP + plugin `Draggable` (drag & drop inventaire / laboratoire)
- Vitest (tests unitaires)
- Tailwind CSS + CSS custom ciblée pour le rendu visuel du laboratoire

## Boucle de jeu

1. **Inventaire** : colonne de droite avec les fioles découvertes.
2. **Laboratoire** : glisser-déposer les fioles sur le canvas.
3. **Fusion** : superposer une fiole sur une autre pour créer un nouveau résultat.
4. **Atelier des recettes** : consulter les recettes déjà découvertes.
5. **Personnage** : certains sorts peuvent être donnés à boire et déclencher des effets/manifestations.
6. **Progression** : les découvertes sont conservées automatiquement.

## Interactions utiles

- Glisser une fiole inventaire vers le labo pour la poser.
- Déplacer une fiole déjà posée dans le labo.
- Déposer une fiole sur une autre pour tenter une fusion.
- Double-clic sur une fiole du labo : duplication sur le plateau.
- Clic droit sur une fiole du labo : retrait du plateau.
- Bouton `Reset` : réinitialisation de la progression locale.

## Atelier des recettes

L’atelier des recettes est la vue de consultation des combinaisons connues.

- Accès depuis le laboratoire via le bouton/lien `Recettes`.
- Affiche les recettes déjà débloquées pendant la partie.
- Permet de retrouver rapidement quoi fusionner pour obtenir une fiole cible.
- Complète le laboratoire : test dans le canvas, consultation dans l’atelier.



