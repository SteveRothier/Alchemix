import { CREATURE_BODY_PATH } from '../innerClipPaths'

/** Arêtes extérieures latérales du verre (mêmes sommets que CREATURE_BODY_PATH). */
const CREATURE_LEFT_RAIL =
  'M 22 10 L 22 23 L 12.8 32 L 18 44.5'
const CREATURE_RIGHT_RAIL =
  'M 26 10 L 26 23 L 35.2 32 L 30 44.5'

/**
 * Créature : corps anguleux + ornements symétriques (montants, socle, collier, cristal).
 */
export function CreatureFlaskChrome() {
  return (
    <g className="lab-flask-creatureChrome" fill="none">
      {/* Verre */}
      <path
        d={CREATURE_BODY_PATH}
        fill="rgba(255,255,255,0.07)"
        stroke="#2a2a2a"
        strokeWidth="1.05"
        strokeLinejoin="miter"
      />

      {/* Montants dorés — suivent les bords latéraux du verre (au-dessus du trait) */}
      <path
        d={CREATURE_LEFT_RAIL}
        stroke="#8b6914"
        strokeWidth="1.2"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      <path
        d={CREATURE_RIGHT_RAIL}
        stroke="#8b6914"
        strokeWidth="1.2"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      <path
        d={CREATURE_LEFT_RAIL}
        stroke="#d4a017"
        strokeWidth="0.4"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        opacity="0.75"
      />
      <path
        d={CREATURE_RIGHT_RAIL}
        stroke="#d4a017"
        strokeWidth="0.4"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        opacity="0.75"
      />

      {/* Socle réduit — semelle fine sous la base */}
      <path
        d="M 19 45.2 H 29 L 28.5 46.6 H 19.5 Z"
        fill="#9a7b1a"
        stroke="#4a3a0c"
        strokeWidth="0.35"
      />
      <path d="M 20.2 45.55 H 27.8 V 46.25 H 20.2 Z" fill="#c9a227" opacity="0.45" />

      {/* Collier à la jonction goulot / épaules */}
      <rect
        x="19.8"
        y="21.1"
        width="8.4"
        height="2.4"
        rx="0.45"
        fill="#c9a227"
        stroke="#6b4e0a"
        strokeWidth="0.35"
      />
      <rect x="20.8" y="21.6" width="2.8" height="0.9" rx="0.15" fill="#f5e6a8" opacity="0.65" />

      {/* Anneau sous le cristal */}
      <ellipse
        cx="24"
        cy="10.8"
        rx="5.4"
        ry="1.85"
        fill="#b8860b"
        stroke="#6b4e0a"
        strokeWidth="0.35"
      />
      <ellipse cx="20.5" cy="10.5" rx="1.8" ry="0.75" fill="#f5e6a8" opacity="0.5" />

      {/* Cristal catalyseur (cyan, distinct du violet sort) */}
      <path
        d="M 24 0.9 L 29.2 8.2 L 24 12.2 L 18.8 8.2 Z"
        fill="#0891b2"
        stroke="#0e7490"
        strokeWidth="0.5"
      />
      <path
        d="M 24 2.8 L 27.4 7.8 L 24 10.6 L 20.6 7.8 Z"
        fill="#67e8f9"
        opacity="0.95"
      />
      <path
        d="M 24 0.9 V 10.6 M 20.6 7.8 L 27.4 7.8"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="0.35"
      />

      {/* Étincelles symétriques */}
      <g fill="#e0f7ff" stroke="#0891b2" strokeWidth="0.12" opacity="0.95">
        <path d="M 17.5 3.2 L 18.4 4.2 L 17.5 5.2 L 16.6 4.2 Z" />
        <path d="M 30.5 3.5 L 31.4 4.5 L 30.5 5.5 L 29.6 4.5 Z" />
        <path d="M 24 0.2 L 24.7 1 L 24 1.8 L 23.3 1 Z" />
      </g>
    </g>
  )
}
