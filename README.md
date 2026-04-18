# Alchemix

**Alchemix** est un jeu d’alchimie développé en React où tu combines des fioles, tu découvres des recettes et tu fais progresser l’inventaire. Page principale = laboratoire ; atelier des recettes = mode développement seulement.

Le concept est **fortement inspirés** de [Infinite Craft](https://neal.fun/infinite-craft/) (Neal.fun).

## Démarrage rapide

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run dev     # développement (atelier + sauvegarde fichier côté serveur)
npm run build
npm run lint
npm run test
```

## Stack

- React 19, TypeScript, Vite 8, Zustand, GSAP Draggable, Vitest, Tailwind + CSS du laboratoire, Lucide Icon

---

## Laboratoire

**Inventaire**

- Liste des fioles découvertes
- Recherche
- Tri : temps, nom, couleur
- Drag → canvas (poser / fusionner)
- Clic sans drag → pose près du centre du canvas
- Clic droit → menu « View Recipes » → livre ouvert sur cette fiole

**Canvas**

- Positions du plateau sauvegardées automatiquement (navigateur)
- Fusion catalogue → nouvelle fiole possible + compteur fusions
- Fusion inconnue → résultat = fiole déposée, pas de nouvelle découverte
- Clic → sélection
- Glisser sur le fond → rectangle de sélection ; Maj → ajouter à la sélection
- Double-clic → dupliquer la carte
- Clic droit → retirer la carte (ou toute la sélection si plusieurs sélectionnées)
- Drag vers la colonne inventaire → retirer du plateau
- Fond constellation

**Clavier** (hors champs texte)

- Ctrl+Z / Cmd+Z → annuler (jusqu’à ~80 pas)
- Ctrl+Maj+Z ou Ctrl+Y → rétablir
- Suppr / Retour arrière → supprimer la sélection du plateau

**Dock**

- Trophées : créatures débloquées, onglets catégories / liste
- Offrande : drag élément sur la fiole ; clic → indices ; déblocage créatures ; scénario Grass / Mort
- Livre de recettes
- Contrôles (rappel raccourcis)
- Langue EN / FR
- Vider le plateau (confirmation)
- Reset progression (confirmation) : 5 starters, plateau vide, undo labo vidé

**Livre de recettes**

- Liste des fioles découvertes + recherche
- Détail : paires catalogue vers cette fiole ; compteur paires dont les deux ingrédients sont dans l’inventaire

**Lien « Atelier » (titre canvas)**

- Développement → ouvre l’atelier
- Production → modale « atelier indisponible »

**Sauvegarde locale**

- Inventaire, fusions, offrandes, plateau, préférences d’intro : tout est conservé dans le navigateur

---

## Atelier des recettes (développement uniquement)

**En-tête**

- Export JSON du registre
- Import JSON
- Save → réécrit le fichier des recettes du jeu via l’API du serveur de dev
- Retour laboratoire ; confirmation si changements non sauvegardés

**Formulaire**

- Onglets Recipe / Creature
- Recipe : ingrédients A, B, résultat, couleurs, texture, opacité
- Validations : paires complètes, pas de doublons de paire / conflits de lignes

**Registre (table)**

- Catalogue du jeu + lignes perso, pagination
- Tri multi-colonnes (combinaison, résultat, type)
- Recherche / filtre
- Édition / suppression par ligne
- Reset registre depuis le code source

**Sauvegarde locale**

- Brouillon du registre conservé dans le navigateur entre les sessions

**Après Save fichier**

- Redémarrer le serveur de dev si besoin pour recharger les données

