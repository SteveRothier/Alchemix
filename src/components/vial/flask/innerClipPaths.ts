import type { VialType } from '../../../types'

/**
 * Contour du globe (corps) fiole élément — identique au chrome dans ElementFlaskChrome.
 * Le clip liquide / cavité est ce path homothétique depuis le centre (voir VialFlaskGraphic).
 */
export const ELEMENT_BULB_BODY_PATH =
  'M 24 20.2 C 11.5 20.2 7.2 27.5 7.2 33.8 C 7.2 40.8 12.8 46.2 24 47.2 C 35.2 46.2 40.8 40.8 40.8 33.8 C 40.8 27.5 36.5 20.2 24 20.2 Z'

/** Centre d’homothétie (intérieur du globe) + facteur ≈ « demi-trait » vers l’intérieur du verre. */
export const ELEMENT_CLIP_ORIGIN = { x: 24, y: 33.65 }
export const ELEMENT_CLIP_SCALE = 0.968

/**
 * Contour du corps hexagonal fiole sort — identique au chrome dans SpellFlaskChrome.
 */
export const SPELL_HEX_BODY_PATH =
  'M 24 12.5 L 35 18.5 V 29.5 L 24 37.5 L 13 29.5 V 18.5 Z'

export const SPELL_CLIP_ORIGIN = { x: 24, y: 25 }
export const SPELL_CLIP_SCALE = 0.968

/**
 * Créature : corps anguleux (épaules larges, base plate, goulot étroit). Ornements dans CreatureFlaskChrome.
 */
/** Symétrique par rapport à x = 24 : épaules 12,8 / 35,2 ; goulot 22–26 (arêtes verticales). */
export const CREATURE_BODY_PATH =
  'M 18 44.5 L 30 44.5 L 35.2 32 L 26 23 L 26 10 L 22 10 L 22 23 L 12.8 32 L 18 44.5 Z'

export const CREATURE_CLIP_ORIGIN = { x: 24, y: 29 }
export const CREATURE_CLIP_SCALE = 0.968

/**
 * Référence ; `element`, `spell` et `creature` utilisent le corps chrome + transform dans VialFlaskGraphic.
 */
export const INNER_CLIP_PATH: Record<VialType, string> = {
  element: ELEMENT_BULB_BODY_PATH,
  spell: SPELL_HEX_BODY_PATH,
  creature: CREATURE_BODY_PATH,
}

/** Cadre global (élément, créature). */
export const FLASK_VIEWBOX = '0 0 48 56' as const

/**
 * Cadrage sort : zoom sur l’hex + cristal, sans changer les coordonnées des paths.
 */
export const SPELL_VIEWBOX = '10.5 0 27 40' as const

/**
 * Cadrage créature : corps + cristal / ornements haut, socle bas.
 */
export const CREATURE_VIEWBOX = '10 0 28 48' as const
