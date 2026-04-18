/** Ouvre la modale « Atelier indisponible » (écouteur dans `LabWorkshopBlockedModalHost`). */
export const WORKSHOP_BLOCKED_MODAL_EVENT = 'alchemix-workshop-blocked-modal'

export function requestWorkshopBlockedModal() {
  window.dispatchEvent(new CustomEvent(WORKSHOP_BLOCKED_MODAL_EVENT))
}
