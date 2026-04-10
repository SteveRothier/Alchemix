import { ELEMENT_BULB_BODY_PATH } from '../innerClipPaths'

/**
 * Élément : sphère + base plate, goulot court, anneau argenté, petit bouchon liège.
 */
export function ElementFlaskChrome() {
  return (
    <g className="lab-flask-elementChrome" fill="none">
      {/* Sphère (corps) — même géométrie que ELEMENT_BULB_BODY_PATH */}
      <path
        d={ELEMENT_BULB_BODY_PATH}
        fill="rgba(255,255,255,0.08)"
        stroke="#2f2f2f"
        strokeWidth="1.05"
      />
      {/* Goulot verre (sous l’anneau) */}
      <rect
        x="19.4"
        y="9.8"
        width="9.2"
        height="8.2"
        rx="0.55"
        fill="rgba(255,255,255,0.1)"
        stroke="#3d3d3d"
        strokeWidth="0.65"
      />
      {/* Anneau métallique à la jonction corps / goulot */}
      <rect
        x="16"
        y="17.5"
        width="16"
        height="3.4"
        rx="0.45"
        fill="#a8adb8"
        stroke="#5c636e"
        strokeWidth="0.4"
      />
      <rect x="17" y="18.2" width="4.5" height="1.1" rx="0.2" fill="#d8dce4" opacity="0.85" />
      {/* Bouchon court — surtout dans le goulot, ~1 unité visible au-dessus */}
      <rect
        x="17.8"
        y="8.4"
        width="12.4"
        height="3.9"
        rx="0.75"
        fill="#9a6b2d"
        stroke="#5c3d16"
        strokeWidth="0.45"
      />
      <rect x="18.6" y="9.1" width="2.6" height="2.6" rx="0.2" fill="#b8894a" opacity="0.45" />
    </g>
  )
}
