import { SPELL_HEX_BODY_PATH } from '../innerClipPaths'

/**
 * Sort : hexagone (épaules larges en haut), collier doré, cristal violet facetté (sans socle).
 */
export function SpellFlaskChrome() {
  return (
    <g className="lab-flask-spellChrome" fill="none">
      {/* Corps hexagonal — facettes */}
      <path
        d={SPELL_HEX_BODY_PATH}
        fill="rgba(255,255,255,0.07)"
        stroke="#2e2648"
        strokeWidth="1.05"
      />
      <path
        d="M 24 12.5 L 29.5 16 M 24 12.5 L 18.5 16 M 35 18.5 L 35 24 M 13 18.5 L 13 24 M 35 29.5 L 29.5 33.5 M 13 29.5 L 18.5 33.5"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="0.45"
      />
      {/* Collier / anneau doré sous le cristal */}
      <rect
        x="17.5"
        y="9.8"
        width="13"
        height="4.2"
        rx="0.5"
        fill="#d4a017"
        stroke="#7c5a0f"
        strokeWidth="0.4"
      />
      <rect x="18.8" y="10.6" width="4" height="1.2" rx="0.15" fill="#f5e6a8" opacity="0.7" />
      {/* Cristal violet (diamant) */}
      <path
        d="M 24 1.5 L 28.5 8.2 L 24 12.8 L 19.5 8.2 Z"
        fill="#5b21b6"
        stroke="#3b0764"
        strokeWidth="0.5"
      />
      <path
        d="M 24 3.2 L 26.8 7.5 L 24 10.5 L 21.2 7.5 Z"
        fill="#8b5cf6"
        opacity="0.9"
      />
      <path d="M 24 1.5 L 24 10.5 M 21.2 7.5 L 26.8 7.5" stroke="rgba(255,255,255,0.35)" strokeWidth="0.35" />
    </g>
  )
}
