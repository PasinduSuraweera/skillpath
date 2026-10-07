import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { m, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { SPEED, useAtmosphere, useDepth } from '../depth'
import type { Mood } from '../depth'
import { FORCED_COLORS } from '../design/tokens'
import { useScrollFx } from '../motion'

// A fine grain over the glows: low-contrast gradients otherwise band into visible steps.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E" +
  "%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E" +
  "%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

type Light = { color: string; at: string; opacity: [number, number] }

/** The aurora: soft light in the brand hues around the edges of the window (light, dark opacity). */
const AURORA: Light[] = [
  { color: '#6366f1', at: 'ellipse 62% 52% at 6% 0%', opacity: [0.3, 0.34] },
  { color: '#a855f7', at: 'ellipse 52% 46% at 94% 4%', opacity: [0.24, 0.3] },
  { color: '#ec4899', at: 'ellipse 38% 34% at 88% 58%', opacity: [0.1, 0.12] },
  { color: '#22d3ee', at: 'ellipse 56% 44% at 2% 94%', opacity: [0.18, 0.16] },
  { color: '#3b82f6', at: 'ellipse 50% 40% at 62% 104%', opacity: [0.14, 0.18] },
]

/**
 * Each mood's light, laid over the aurora (see depth.ts). The opening is deep and rich, skills
 * work brighter and cooler, the career choice warmer in the accent hues, the wider picture
 * settled in teal. Same hues as the brand, so no change ever looks like a different site.
 */
const MOODS: Record<Mood, Light[]> = {
  dawn: [
    { color: '#4f46e5', at: 'ellipse 70% 55% at 50% -10%', opacity: [0.16, 0.24] },
    { color: '#7c3aed', at: 'ellipse 40% 40% at 100% 30%', opacity: [0.1, 0.16] },
  ],
  focus: [
    { color: '#22d3ee', at: 'ellipse 55% 50% at 0% 45%', opacity: [0.16, 0.14] },
    { color: '#6366f1', at: 'ellipse 50% 45% at 100% 70%', opacity: [0.14, 0.18] },
  ],
  accent: [
    { color: '#d946ef', at: 'ellipse 50% 45% at 100% 35%', opacity: [0.14, 0.16] },
    { color: '#8b5cf6', at: 'ellipse 55% 50% at 0% 75%', opacity: [0.14, 0.2] },
  ],
  calm: [
    { color: '#14b8a6', at: 'ellipse 55% 50% at 0% 80%', opacity: [0.14, 0.13] },
    { color: '#38bdf8', at: 'ellipse 45% 40% at 100% 40%', opacity: [0.12, 0.13] },
  ],
}

const paint = (lights: Light[], dark: boolean) =>
  lights.map((g) => `radial-gradient(${g.at}, ${alpha(g.color, g.opacity[dark ? 1 : 0])}, transparent 72%)`).join(', ')

/** How far the backdrop layers drift over the first DRIFT_RANGE px of scrolling (px; negative is up). */
const DRIFT_RANGE = 3200
const AURORA_DRIFT = -160 // the light: barely moves (depth: far away)
const GRID_DRIFT = -360 // the dot grid: a little more (nearer), so it slips away as the page starts

/**
 * The canvas the glass sits on, fixed behind the page: the aurora, the mood of the section in
 * view (crossfading slowly as the story moves on), a faint dot grid near the top (the
 * "computed" texture of an AI product) and grain. On wide screens the aurora and grid drift up
 * a little as the page scrolls, far slower than the content, so the glass in front gains
 * depth; on phones and with reduced motion they stay still. Only transforms and opacity
 * change (compositor work). Not printed, and not shown in a contrast theme.
 */
export default function AmbientBackground() {
  const fx = useScrollFx()
  const mood = useAtmosphere()
  const { scrollY } = useScroll()
  const auroraY = useTransform(scrollY, [0, DRIFT_RANGE], [0, fx ? AURORA_DRIFT : 0])
  const gridY = useTransform(scrollY, [0, DRIFT_RANGE], [0, fx ? GRID_DRIFT : 0])
  return (
    <Box
      aria-hidden="true"
      className="no-print"
      sx={{
        position: 'fixed',
        inset: 0,
        // the largest viewport, so no strip opens up when a phone's toolbar slides away
        height: '100vh',
        '@supports (height: 100lvh)': { height: '100lvh' },
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
        [FORCED_COLORS]: { display: 'none' },
      }}
    >
      {/* taller than the window by the drift, so moving up never opens a gap at the bottom */}
      <Box
        component={m.div}
        style={{ y: auroraY }}
        sx={(t) => ({ position: 'absolute', inset: `0 0 ${AURORA_DRIFT}px 0`, backgroundImage: paint(AURORA, false), ...t.applyStyles('dark', { backgroundImage: paint(AURORA, true) }) })}
      />
      {/* the moods: all painted once, only the current one shown; the change is a slow crossfade */}
      {(Object.keys(MOODS) as Mood[]).map((k) => (
        <Box
          key={k}
          sx={(t) => ({
            position: 'absolute',
            inset: 0,
            backgroundImage: paint(MOODS[k], false),
            ...t.applyStyles('dark', { backgroundImage: paint(MOODS[k], true) }),
            opacity: k === mood ? 1 : 0,
            transition: 'opacity 1600ms cubic-bezier(0.4, 0, 0.2, 1)',
          })}
        />
      ))}
      {/* dot grid, fading out from the top centre */}
      <Box
        component={m.div}
        style={{ y: gridY }}
        sx={(t) => ({
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(11, 16, 32, 0.09) 1px, transparent 1.4px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, #000 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, #000 0%, transparent 75%)',
          ...t.applyStyles('dark', { backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.07) 1px, transparent 1.4px)' }),
        })}
      />
      <Box sx={(t) => ({ position: 'absolute', inset: 0, backgroundImage: GRAIN, opacity: 0.035, ...t.applyStyles('dark', { opacity: 0.05 }) })} />
    </Box>
  )
}

/**
 * A soft light placed in the page itself, behind a glass surface, so the glass has colour
 * to refract as it scrolls past. A radial gradient (no blur filter): drawn once, cheap.
 * Put it inside a positioned parent with `isolation: isolate`.
 *
 * On wide screens it is a depth layer (depth.ts): it moves at `speed` × the scroll (the
 * light layer by default), sitting where it is placed when centred in the window, so the
 * glass in front visibly slides over it.
 */
export function Glow({ color, size, sx, strength = [0.32, 0.4], speed = SPEED.light }: { color: string; size: number; sx?: SxProps<Theme>; strength?: [number, number]; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const y = useDepth(ref, speed, useScrollFx())
  return (
    <Box
      ref={ref}
      component={m.div}
      style={{ y }}
      aria-hidden="true"
      className="no-print"
      sx={[
        (t) => ({
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: '50%',
          zIndex: -1,
          pointerEvents: 'none',
          backgroundImage: `radial-gradient(closest-side, ${alpha(color, strength[0])}, transparent)`,
          ...t.applyStyles('dark', { backgroundImage: `radial-gradient(closest-side, ${alpha(color, strength[1])}, transparent)` }),
          [FORCED_COLORS]: { display: 'none' },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}
