import type { LiquidTexture, VialType } from '../../../../types'

type VialTextureLayerProps = {
  texture: LiquidTexture
  vialType: VialType
}

/** Effets à l’intérieur du clip — coordonnées viewBox 48×56. */
export function VialTextureLayer({ texture, vialType }: VialTextureLayerProps) {
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
    default:
      return null
  }
}
