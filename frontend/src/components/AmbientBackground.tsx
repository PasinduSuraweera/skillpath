import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { m, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { FORCED_COLORS } from '../design/tokens'
import { useScrollFx } from '../motion'

// A fine grain over the glows: low-contrast gradients otherwise band into visible steps.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E" +
  "%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E" +
  "%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

/** The aurora: soft light in the brand hues around the edges of the window (light, dark opacity). */
const AURORA = [
  { color: '#6366f1', at: 'ellipse 62% 52% at 6% 0%', opacity: [0.3, 0.34] },
  { color: '#a855f7', at: 'ellipse 52% 46% at 94% 4%', opacity: [0.24, 0.3] },
  { color: '#ec4899', at: 'ellipse 38% 34% at 88% 58%', opacity: [0.1, 0.12] },
  { color: '#22d3ee', at: 'ellipse 56% 44% at 2% 94%', opacity: [0.18, 0.16] },
  { color: '#3b82f6', at: 'ellipse 50% 40% at 62% 104%', opacity: [0.14, 0.18] },
] as const

const aurora = (dark: boolean) =>
  AURORA.map((g) => `radial-gradient(${g.at}, ${alpha(g.color, g.opacity[dark ? 1 : 0])}, transparent 72%)`).join(', ')

/** How far the backdrop layers drift over the first DRIFT_RANGE px of scrolling (px; negative is up). */
const DRIFT_RANGE = 2400
const AURORA_DRIFT = -90 // the light: barely moves (depth: far away)
const GRID_DRIFT = -220 // the dot grid: a little more (nearer), so it slips away as the page starts

/**
 * The canvas the glass sits on, fixed behind the page: the aurora, a faint dot grid near the
 * top (the "computed" texture of an AI product) and grain. On wide screens its layers drift
 * up a little as the page scrolls, far slower than the content, so the glass in front gains
 * depth; on phones and with reduced motion it stays still. Only transforms move (compositor
 * work). Not printed, and not shown in a contrast theme.
 */
export default function AmbientBackground() {
  const fx = useScrollFx()
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
        sx={(t) => ({ position: 'absolute', inset: `0 0 ${AURORA_DRIFT}px 0`, backgroundImage: aurora(false), ...t.applyStyles('dark', { backgroundImage: aurora(true) }) })}
      />
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
 * `depth` (0-1) adds parallax on wide screens: while the glow crosses the window it lags
 * behind the content by up to depth × 90 px each way, so it reads as further back than the
 * glass in front of it (depth 1 ≈ moving at 0.6× the content's speed).
 */
export function Glow({ color, size, sx, strength = [0.32, 0.4], depth = 0 }: { color: string; size: number; sx?: SxProps<Theme>; strength?: [number, number]; depth?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const fx = useScrollFx()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const shift = fx ? depth * 90 : 0
  const y = useTransform(scrollYProgress, [0, 1], [-shift, shift])
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
