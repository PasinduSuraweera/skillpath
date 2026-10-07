import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import { AMBIENT } from '../theme'

// A fine grain over the glows: low-contrast gradients otherwise band into visible steps.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E" +
  "%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E" +
  "%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

/** Soft glows in the brand hues, strongest at the top where the page starts (light, dark opacity). */
const GLOWS = [
  { color: AMBIENT.indigo, at: 'ellipse 85% 75% at 0% 0%', opacity: [0.2, 0.3] },
  { color: AMBIENT.violet, at: 'ellipse 75% 70% at 100% 5%', opacity: [0.17, 0.25] },
  { color: AMBIENT.blue, at: 'ellipse 70% 55% at 10% 100%', opacity: [0.1, 0.1] },
] as const

const glows = (dark: boolean) =>
  GLOWS.map((g) => `radial-gradient(${g.at}, ${alpha(g.color, g.opacity[dark ? 1 : 0])}, transparent 75%)`).join(', ')

/**
 * The backdrop the glass surfaces sit on, fixed behind the page. Static: nothing in it moves
 * or follows the scroll, so it is drawn once. Not printed.
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
        backgroundImage: glows(false),
        ...t.applyStyles('dark', { backgroundImage: glows(true) }),
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
