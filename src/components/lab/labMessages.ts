export const LAB_MESSAGES = {
  common: {
    yes: 'Yes',
    no: 'No',
  },
  offer: {
    onlyElements: 'Only elements can be offered.',
    neverAgain: 'Never again !',
    deathAdded: 'Death added to inventory.',
    noCreatureYet: 'No trophy creature for this element yet.',
    alreadyUnlocked: 'Trophy already unlocked.',
    unlocked: (creatureName: string) => `Trophy unlocked: ${creatureName}`,
    deathDescription: 'An ominous essence born from forbidden offering.',
  },
  fusion: {
    inert: 'This mix stays inert.',
  },
  dock: {
    creaturesLabel: 'Creatures',
    creaturesTooltip: 'Creatures',
    offerAriaLabel: 'Offer element for creature unlock',
    resetAriaLabel: 'Reset progress',
    resetTooltip: 'Reset progress',
    clearAriaLabel: 'Clear canvas',
    clearTooltip: 'Clear canvas',
    controlsAriaLabel: 'Controls',
    controlsTooltip: 'Controls',
    languageAriaLabel: 'Choose language',
    languageTooltip: 'EN / FR',
    playAreaAriaLabel: 'Play area',
    inventoryAriaLabel: 'Inventory',
  },
  dialogs: {
    controlsTitle: 'Controls',
    controlsCloseAriaLabel: 'Close controls',
    clearQuestion: 'Clear all items on the canvas?',
    resetQuestion:
      'Reset progress? Inventory will return to the 5 starter elements and the laboratory will be cleared.',
    chooseLanguageAriaLabel: 'Choose language',
    closeCreaturePopupAriaLabel: 'Close creature popup',
    creaturesToDiscoverTitle: 'Creatures to discover',
  },
  controlsRows: [
    { keys: 'Left click', detail: 'Select item' },
    { keys: 'Right click', detail: 'Delete item' },
    { keys: 'Double click', detail: 'Duplicate item' },
    { keys: 'Ctrl+Z', detail: 'Undo' },
    { keys: 'Ctrl+Y', detail: 'Redo' },
  ],
  languageOptions: {
    english: 'English',
    french: 'Français',
  },
  inventory: {
    elementsSectionTitle: 'Elements',
    searchPlaceholder: 'Search...',
    searchAriaLabel: 'Search elements',
    unitSingular: 'vial',
    unitPlural: 'vials',
  },
  canvas: {
    laboratoryTitle: 'Laboratory',
    recipesLinkLabel: 'Recipes',
    recipesLinkTitle: 'Manage vial combinations',
    placementAreaAriaLabel:
      'Vial placement area — drag on the background to select multiple vials',
  },
} as const
