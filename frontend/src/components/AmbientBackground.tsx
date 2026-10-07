import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { FORCED_COLORS } from '../design/tokens'

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

/**
 * The canvas the glass sits on, fixed behind the page: the aurora, a faint dot grid near the
 * top (the "computed" texture of an AI product) and grain. Static: nothing in it moves or
 * follows the scroll, so it is drawn once and the glass above it blurs a still image. Not
 * printed, and not shown in a contrast theme.
 */
export default function AmbientBackground() {
  return (
    <Box
      aria-hidden="true"
      className="no-print"
      sx={(t) => ({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        // the largest viewport, so no strip opens up when a phone's toolbar slides away
        height: '100vh',
        '@supports (height: 100lvh)': { height: '100lvh' },
        zIndex: -1,
        pointerEvents: 'none',
        [FORCED_COLORS]: { display: 'none' },
        backgroundImage: aurora(false),
        ...t.applyStyles('dark', { backgroundImage: aurora(true) }),
        // dot grid, fading out from the top centre
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(11, 16, 32, 0.09) 1px, transparent 1.4px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, #000 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, #000 0%, transparent 75%)',
          ...t.applyStyles('dark', { backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.07) 1px, transparent 1.4px)' }),
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: GRAIN,
          opacity: 0.035,
          ...t.applyStyles('dark', { opacity: 0.05 }),
        },
      })}
    />
  )
}

/**
 * A soft light placed in the page itself, behind a glass surface, so the glass has colour
 * to refract as it scrolls past. A radial gradient (no blur filter): drawn once, cheap.
 * Put it inside a positioned parent with `isolation: isolate`.
 */
export function Glow({ color, size, sx, strength = [0.32, 0.4] }: { color: string; size: number; sx?: SxProps<Theme>; strength?: [number, number] }) {
  return (
    <Box
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
