import type { LiquidTexture, VialType } from '../../../../types'

type VialTextureLayerProps = {
  texture: LiquidTexture
  vialType: VialType
  /** Préfixe unique pour les ids de gradients (définitions par fiole). */
  defsId: string
}

/** Effets à l’intérieur du clip — coordonnées viewBox 48×56. */
export function VialTextureLayer({
  texture,
  vialType,
  defsId,
}: VialTextureLayerProps) {
  switch (texture) {
    case 'liquid':
      return null
    case 'wave':
      return (
        <g className="lab-flask-tex-waveGroup" fill="none">
          <path
            className="lab-flask-tex-wave"
            d="M 10 30 Q 24 26.5 38 30"
            stroke="rgba(255,255,255,0.42)"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          <path
            className="lab-flask-tex-wave lab-flask-tex-wave2"
            d="M 10 34 Q 24 30.5 38 34"
            stroke="rgba(255,255,255,0.24)"
            strokeWidth="0.65"
            strokeLinecap="round"
          />
        </g>
      )
    case 'bubbles':
      return (
        <g className="lab-flask-tex-bubbles" fill="rgba(255,255,255,0.5)">
          <circle className="lab-flask-bubble" cx="18" cy="38" r="1.1" />
          <circle className="lab-flask-bubble" cx="28" cy="34" r="0.7" />
          <circle className="lab-flask-bubble" cx="30" cy="40" r="0.85" />
          <circle className="lab-flask-bubble" cx="20" cy="28" r="0.55" />
          <circle className="lab-flask-bubble" cx="24" cy="39" r="0.62" />
        </g>
      )
    case 'smoke':
      return (
        <g className="lab-flask-tex-smoke">
          <ellipse
            className="lab-flask-smokePuff"
            cx="20"
            cy="22"
            rx="5.5"
            ry="3"
            fill="rgba(255,255,255,0.22)"
          />
          <ellipse
            className="lab-flask-smokePuff lab-flask-smokePuff2"
            cx="28"
            cy="21"
            rx="4.5"
            ry="2.4"
            fill="rgba(240,240,255,0.2)"
          />
          <ellipse
            className="lab-flask-smokePuff lab-flask-smokePuff3"
            cx="24"
            cy="25"
            rx="7"
            ry="3.5"
            fill="rgba(255,255,255,0.14)"
          />
          {vialType === 'spell' ? (
            <circle
              className="lab-flask-spellGlow"
              cx="24"
              cy="27"
              r="7"
              fill="none"
              stroke="rgba(200,180,255,0.38)"
              strokeWidth="0.75"
            />
          ) : null}
        </g>
      )
    case 'spark':
      return (
        <g className="lab-flask-tex-spark">
          <circle data-spark cx="19" cy="36" r="0.65" fill="#fff" opacity="0.92" />
          <circle data-spark cx="29" cy="32" r="0.52" fill="#e0f7ff" opacity="0.88" />
          <circle data-spark cx="24" cy="40" r="0.48" fill="#fff" opacity="0.78" />
          <circle data-spark cx="21" cy="30" r="0.42" fill="#fef08a" opacity="0.82" />
          <circle data-spark cx="31" cy="38" r="0.45" fill="#fff" opacity="0.72" />
          <circle data-spark cx="16" cy="34" r="0.38" fill="#a5f3fc" opacity="0.68" />
        </g>
      )
    case 'ember': {
      return (
        <g className="lab-flask-tex-ember">
          <circle data-ember cx="20" cy="36" r="0.7" fill="#ffb347" opacity="0.9" />
          <circle data-ember cx="28" cy="33" r="0.55" fill="#ff6b35" opacity="0.88" />
          <circle data-ember cx="24" cy="40" r="0.5" fill="#fef08a" opacity="0.82" />
          <circle data-ember cx="17" cy="32" r="0.45" fill="#ff922b" opacity="0.78" />
          <circle data-ember cx="30" cy="38" r="0.48" fill="#ffd166" opacity="0.75" />
        </g>
      )
    }
    case 'mist':
      return (
        <g className="lab-flask-tex-mist">
          <ellipse
            className="lab-flask-mistPuff"
            cx="17"
            cy="26"
            rx="6.5"
            ry="3.2"
            fill="rgba(230,240,255,0.16)"
          />
          <ellipse
            className="lab-flask-mistPuff lab-flask-mistPuff2"
            cx="28"
            cy="24"
            rx="5"
            ry="2.6"
            fill="rgba(245,250,255,0.12)"
          />
          <ellipse
            className="lab-flask-mistPuff lab-flask-mistPuff3"
            cx="24"
            cy="29"
            rx="8"
            ry="3.8"
            fill="rgba(220,235,255,0.1)"
          />
        </g>
      )
    case 'swirl':
      return (
        <g className="lab-flask-tex-swirl" transform="translate(24 32)">
          <g className="lab-flask-swirlSpin">
            <path
              d="M -8 4 Q 0 -6 8 4 Q 0 10 -8 4"
              fill="none"
              stroke="rgba(255,255,255,0.38)"
              strokeWidth="0.75"
              strokeLinecap="round"
            />
            <path
              d="M -5 2 Q 0 -3 5 2"
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="0.55"
              strokeLinecap="round"
            />
          </g>
        </g>
      )
    case 'crystal':
      return (
        <g className="lab-flask-tex-crystal">
          <polygon
            className="lab-flask-crystalShard"
            points="18,38 20,32.5 22,38 20,41.5"
            fill="rgba(220,240,255,0.72)"
          />
          <polygon
            className="lab-flask-crystalShard lab-flask-crystalShard2"
            points="26,35 27.8,30.5 29.2,35 27.8,38.5"
            fill="rgba(200,230,255,0.65)"
          />
          <polygon
            className="lab-flask-crystalShard lab-flask-crystalShard3"
            points="22,29 24,25 26,29 24,32"
            fill="rgba(235,248,255,0.58)"
          />
        </g>
      )
    case 'ooze':
      return (
        <g className="lab-flask-tex-ooze" fill="rgba(255,255,255,0.24)">
          <ellipse className="lab-flask-oozeBlob" cx="21" cy="38" rx="4.2" ry="3" />
          <ellipse className="lab-flask-oozeBlob lab-flask-oozeBlob2" cx="28" cy="36" rx="3.6" ry="2.4" />
          <ellipse className="lab-flask-oozeBlob lab-flask-oozeBlob3" cx="24" cy="41" rx="5.2" ry="2.2" />
        </g>
      )
    case 'static':
      return (
        <g className="lab-flask-tex-static">
          <polyline
            className="lab-flask-staticZap"
            points="13,33 17,27 21,34 25,26 29,35 33,28 37,32"
            fill="none"
            stroke="rgba(220,230,255,0.88)"
            strokeWidth="0.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )
    case 'sheen': {
      const sid = `${defsId}-sheen-lg`
      return (
        <g className="lab-flask-tex-sheen">
          <defs>
            <linearGradient
              id={sid}
              x1="8"
              y1="34"
              x2="40"
              y2="30"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="42%" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.45)" />
              <stop offset="58%" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          <path
            className="lab-flask-sheenArc"
            d="M 11 39 Q 24 28 37 39"
            fill="none"
            stroke={`url(#${sid})`}
            strokeWidth="1.15"
            strokeLinecap="round"
          />
        </g>
      )
    }
    case 'drip':
      return (
        <g className="lab-flask-tex-drip">
          <path
            className="lab-flask-dripDrop"
            d="M 24 27 L 26.2 33.5 Q 24 39.5 21.8 33.5 Z"
            fill="rgba(255,255,255,0.42)"
          />
          <ellipse
            className="lab-flask-dripTail"
            cx="24"
            cy="40.5"
            rx="1.3"
            ry="2.1"
            fill="rgba(255,255,255,0.5)"
          />
        </g>
      )
    case 'glow': {
      const gid = `${defsId}-tex-glow-rad`
      return (
        <g className="lab-flask-tex-glow">
          <defs>
            <radialGradient id={gid} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.42)" />
              <stop offset="55%" stopColor="rgba(255,255,255,0.14)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <ellipse
            className="lab-flask-glowCore"
            cx="24"
            cy="33"
            rx="10"
            ry="12"
            fill={`url(#${gid})`}
          />
        </g>
      )
    }
    case 'flakes':
      return (
        <g className="lab-flask-tex-flakes" fill="rgba(255,255,255,0.72)">
          <path
            className="lab-flask-flake"
            d="M 15 33 l1.3 -2.6 l1.3 2.6 l-2.6 0 z"
          />
          <path
            className="lab-flask-flake lab-flask-flake2"
            d="M 22 28 l1 -2 l1 2 l-2 0 z"
          />
          <path
            className="lab-flask-flake lab-flask-flake3"
            d="M 30 35 l1.4 -2.8 l1.4 2.8 l-2.8 0 z"
          />
          <path
            className="lab-flask-flake lab-flask-flake4"
            d="M 25 40 l0.9 -1.8 l0.9 1.8 l-1.8 0 z"
          />
        </g>
      )
    default: {
      const _exhaustive: never = texture
      return _exhaustive
    }
  }
}
