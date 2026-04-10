import { useId, useRef } from 'react'
import type { Vial } from '../../../types'
import {
  CREATURE_BODY_PATH,
  CREATURE_CLIP_ORIGIN,
  CREATURE_CLIP_SCALE,
  ELEMENT_BULB_BODY_PATH,
  ELEMENT_CLIP_ORIGIN,
  ELEMENT_CLIP_SCALE,
  CREATURE_VIEWBOX,
  FLASK_VIEWBOX,
  INNER_CLIP_PATH,
  SPELL_VIEWBOX,
  SPELL_CLIP_ORIGIN,
  SPELL_CLIP_SCALE,
  SPELL_HEX_BODY_PATH,
} from './innerClipPaths'
import { VialTextureLayer } from './layers/VialTextureLayer'
import { CreatureFlaskChrome } from './shapes/CreatureFlaskChrome'
import { ElementFlaskChrome } from './shapes/ElementFlaskChrome'
import { SpellFlaskChrome } from './shapes/SpellFlaskChrome'
import { useVialFlaskMotion } from './useVialFlaskMotion'

import './vialFlaskSvg.css'

function GlassGlint({ type }: { type: Vial['type'] }) {
  if (type === 'element') {
    return (
      <ellipse
        cx="17.5"
        cy="32"
        rx="3.2"
        ry="9"
        fill="white"
        opacity="0.14"
        pointerEvents="none"
      />
    )
  }
  if (type === 'spell') {
    return (
      <>
        <path
          d="M 17 20 L 21 25 L 17 31 Z"
          fill="white"
          opacity="0.12"
          pointerEvents="none"
        />
        <path
          d="M 27 22 L 30 26 L 27 30 Z"
          fill="white"
          opacity="0.06"
          pointerEvents="none"
        />
      </>
    )
  }
  if (type === 'creature') {
    return (
      <>
        <path
          d="M 15.5 28 L 18 34 L 15.5 40 Z"
          fill="white"
          opacity="0.11"
          pointerEvents="none"
        />
        <path
          d="M 32.5 28 L 30 34 L 32.5 40 Z"
          fill="white"
          opacity="0.11"
          pointerEvents="none"
        />
      </>
    )
  }
  return null
}

function ChromeForType({ type }: { type: Vial['type'] }) {
  if (type === 'spell') return <SpellFlaskChrome />
  if (type === 'creature') return <CreatureFlaskChrome />
  return <ElementFlaskChrome />
}

function elementClipTransform(): string {
  const { x, y } = ELEMENT_CLIP_ORIGIN
  return `translate(${x} ${y}) scale(${ELEMENT_CLIP_SCALE}) translate(${-x} ${-y})`
}

function spellClipTransform(): string {
  const { x, y } = SPELL_CLIP_ORIGIN
  return `translate(${x} ${y}) scale(${SPELL_CLIP_SCALE}) translate(${-x} ${-y})`
}

function creatureClipTransform(): string {
  const { x, y } = CREATURE_CLIP_ORIGIN
  return `translate(${x} ${y}) scale(${CREATURE_CLIP_SCALE}) translate(${-x} ${-y})`
}

type VialFlaskGraphicProps = {
  vial: Vial
  className?: string
}

export function VialFlaskGraphic({ vial, className = '' }: VialFlaskGraphicProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const reactId = useId().replace(/:/g, '')
  const gradId = `${reactId}-lg`
  const clipId = `${reactId}-clip`

  useVialFlaskMotion(svgRef, vial)

  const a = vial.liquid.primaryColor
  const b = vial.liquid.secondaryColor ?? vial.liquid.primaryColor
  const clipPath = INNER_CLIP_PATH[vial.type]

  const gradY1 =
    vial.type === 'element'
      ? 20
      : vial.type === 'spell'
        ? 11
        : vial.type === 'creature'
          ? 8
          : 14
  const gradY2 =
    vial.type === 'element'
      ? 47
      : vial.type === 'spell'
        ? 39
        : vial.type === 'creature'
          ? 46
          : 48

  const glassFill = (
    <>
      <rect x="0" y="0" width="48" height="56" fill="rgba(255,255,255,0.06)" />
      <rect x="0" y="0" width="48" height="56" fill={`url(#${gradId})`} />
    </>
  )

  return (
    <svg
      ref={svgRef}
      className={`lab-flaskSvg${vial.type === 'spell' ? ' lab-flaskSvg--spell' : ''} ${className}`.trim()}
      viewBox={
        vial.type === 'spell'
          ? SPELL_VIEWBOX
          : vial.type === 'creature'
            ? CREATURE_VIEWBOX
            : FLASK_VIEWBOX
      }
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="24"
          y1={gradY1}
          x2="24"
          y2={gradY2}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={b} stopOpacity={0.92} />
          <stop offset="52%" stopColor={a} stopOpacity={1} />
          <stop offset="100%" stopColor={a} stopOpacity={0.78} />
        </linearGradient>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          {vial.type === 'element' ? (
            <path transform={elementClipTransform()} d={ELEMENT_BULB_BODY_PATH} />
          ) : vial.type === 'spell' ? (
            <path transform={spellClipTransform()} d={SPELL_HEX_BODY_PATH} />
          ) : vial.type === 'creature' ? (
            <path transform={creatureClipTransform()} d={CREATURE_BODY_PATH} />
          ) : (
            <path d={clipPath} />
          )}
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`} style={{ opacity: vial.liquid.opacity }}>
        {vial.type === 'element' ? (
          <>
            {glassFill}
            <VialTextureLayer texture={vial.liquid.texture} vialType={vial.type} />
          </>
        ) : vial.type === 'spell' ? (
          <>
            {glassFill}
            <VialTextureLayer texture={vial.liquid.texture} vialType={vial.type} />
          </>
        ) : vial.type === 'creature' ? (
          <>
            {glassFill}
            <VialTextureLayer texture={vial.liquid.texture} vialType={vial.type} />
          </>
        ) : (
          <>
            <rect x="0" y="0" width="48" height="56" fill={`url(#${gradId})`} />
            <VialTextureLayer texture={vial.liquid.texture} vialType={vial.type} />
          </>
        )}
      </g>

      <ChromeForType type={vial.type} />
      <GlassGlint type={vial.type} />
    </svg>
  )
}
