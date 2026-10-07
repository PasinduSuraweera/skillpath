// Glass surface styles (sx objects). Components that are glass spread one of these.
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { AURORA, FORCED_COLORS, RADIUS, glass, glassEdge, glassFill, mergeStyles, shadow, white } from './tokens'
import type { Elevation } from './tokens'

/** Panel glass: the main material of the app (hero, workspace, dashboard tiles). */
export const panel = (t: Theme, { elevation = 'low', radius = RADIUS.card }: { elevation?: Elevation; radius?: number } = {}) =>
  mergeStyles(glass(t, 'panel'), glassEdge(t), shadow(t, elevation), { borderRadius: `${radius}px` })

/**
 * Spotlight glass: the one hero surface of a screen. Panel glass with an aurora wash in its
 * top corner and a gradient rim (a ::before ring), and the deepest elevation.
 */
export const spotlight = (t: Theme) => {
  const [light, dark] = glassFill('panel')
  const wash = (a: number, b: number) =>
    `radial-gradient(120% 90% at 0% 0%, ${alpha(AURORA[0], a)}, transparent 55%), radial-gradient(90% 80% at 100% 0%, ${alpha(AURORA[2], b)}, transparent 60%)`
  return mergeStyles(panel(t, { elevation: 'high', radius: RADIUS.panel }), {
    position: 'relative' as const,
    isolation: 'isolate' as const,
    border: 0,
    backgroundImage: `${wash(0.16, 0.1)}, ${light}`,
    ...t.applyStyles('dark', { backgroundImage: `${wash(0.26, 0.16)}, ${dark}` }),
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderRadius: 'inherit',
      padding: '1px',
      backgroundImage: `linear-gradient(140deg, ${white(0.95)}, ${alpha(AURORA[1], 0.45)} 40%, ${white(0.5)} 70%, ${alpha(AURORA[3], 0.4)})`,
      WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
      WebkitMaskComposite: 'xor',
      mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
      pointerEvents: 'none',
      ...t.applyStyles('dark', {
        backgroundImage: `linear-gradient(140deg, ${alpha(AURORA[0], 0.7)}, ${white(0.08)} 40%, ${alpha(AURORA[2], 0.45)} 75%, ${white(0.1)})`,
      }),
      '@media print': { display: 'none' },
      [FORCED_COLORS]: { display: 'none' },
    },
    // PDF output ignores masks: a plain accent border in print, a system border in contrast themes
    '@media print': { backgroundImage: 'none', border: `1px solid ${t.palette.primary.main}` },
    [FORCED_COLORS]: { border: '2px solid CanvasText' },
  })
}

