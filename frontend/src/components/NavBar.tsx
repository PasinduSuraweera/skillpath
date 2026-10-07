import DarkMode from '@mui/icons-material/DarkModeOutlined'
import Insights from '@mui/icons-material/Insights'
import LightMode from '@mui/icons-material/LightModeOutlined'
import PersonOutline from '@mui/icons-material/PersonOutlined'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useColorScheme } from '@mui/material/styles'
import { AnimatePresence, m, useReducedMotion, useScroll, useTransform } from 'motion/react'
import type { MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { TRANSITION, withViewTransition } from '../motion'
import { FORCED_COLORS, HOVER, RADIUS, glass, glassEdge, ink, mergeStyles, shadow, white } from '../design/tokens'

export type View = 'profile' | 'results'

/** The icon swap: the old icon turns away as the new one turns in, settling from slightly smaller and blurred. */
const turn = (deg: number) => ({ opacity: 0, scale: 0.8, rotate: deg, filter: 'blur(2px)' })

/** Phones under 400 px: the wordmark and the nav icons give way, so the bar never wraps. */
const roomy = '@media (min-width: 400px)'

interface Props {
  view: View
  resultsReady: boolean
  disabled: boolean
  onNavigate: (view: View) => void
}

const ITEMS = [
  { id: 'profile' as const, label: 'Profile', icon: PersonOutline },
  { id: 'results' as const, label: 'Results', icon: Insights },
]

/**
 * The app's chrome: a floating glass capsule that the page scrolls under. The brand, the two
 * places in SkillPath (your profile, your results) with an indicator that slides between
 * them, and the light/dark switch.
 */
export default function NavBar({ view, resultsReady, disabled, onNavigate }: Props) {
  const { mode, systemMode, setMode } = useColorScheme()
  const dark = (mode === 'system' ? systemMode : mode) === 'dark'

  // At the top of the page the capsule is light glass resting on the hero; as the page scrolls
  // under it, over the first ~100 px, it becomes full glass with a shadow and settles a few px
  // higher. Scroll-linked (no jump between states), and only opacity and transform change: the
  // blur itself is never animated.
  const { scrollY } = useScroll()
  const reduce = useReducedMotion()
  const settled = useTransform(scrollY, [0, 100], [0, 1])
  const glassOpacity = useTransform(settled, [0, 1], [0.55, 1])
  const lift = useTransform(settled, [0, 1], [0, reduce ? 0 : -4])

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    // the new theme spreads out from the button instead of the page flashing from light to dark
    const r = e.currentTarget.getBoundingClientRect()
    withViewTransition(() => flushSync(() => setMode(dark ? 'light' : 'dark')), { x: r.left + r.width / 2, y: r.top + r.height / 2 })
  }

  return (
    <Box
      component="header"
      sx={(t) => ({
        position: 'sticky',
        top: 0,
        zIndex: t.zIndex.appBar,
        pt: { xs: 1, sm: 1.75 },
        px: { xs: 1, sm: 2 },
        pl: { xs: 'max(8px, env(safe-area-inset-left))', sm: 'max(16px, env(safe-area-inset-left))' },
        pr: { xs: 'max(8px, env(safe-area-inset-right))', sm: 'max(16px, env(safe-area-inset-right))' },
        // a phone held sideways: every pixel of height counts
        '@media (max-height: 500px)': { pt: 0.5 },
        '@media print': { position: 'static', p: 0 },
      })}
    >
      <Box
        component={m.div}
        style={{ y: lift }}
        sx={{
          position: 'relative',
          isolation: 'isolate',
          maxWidth: 1200,
          mx: 'auto',
          height: { xs: 56, sm: 60 },
          '@media (max-height: 500px)': { height: 48 },
          borderRadius: `${RADIUS.pill}px`,
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, sm: 2 },
          pl: { xs: 1, sm: 1.25 },
          pr: { xs: 0.75, sm: 1 },
          '@media print': { height: 'auto', px: 0, mb: 1 },
        }}
      >
        {/* the glass, and its shadow, as layers under the content: their opacity follows the scroll */}
        <Box
          component={m.div}
          aria-hidden="true"
          className="no-print"
          style={{ opacity: glassOpacity }}
          sx={(t) => mergeStyles(glass(t, 'chrome'), glassEdge(t), { position: 'absolute', inset: 0, zIndex: -1, borderRadius: `${RADIUS.pill}px` })}
        />
        <Box
          component={m.div}
          aria-hidden="true"
          className="no-print"
          style={{ opacity: settled }}
          sx={(t) => ({ ...shadow(t, 'mid'), position: 'absolute', inset: 0, zIndex: -2, borderRadius: `${RADIUS.pill}px` })}
        />
        {/* brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flexShrink: 0 }}>
          <Box
            component="img"
            src="/favicon.svg"
            alt=""
            sx={(t) => ({ width: 36, height: 36, borderRadius: '11px', flexShrink: 0, boxShadow: `0 6px 16px -6px rgba(79, 70, 229, 0.6), inset 0 0 0 1px ${white(0.2)}`, ...t.applyStyles('dark', { boxShadow: '0 6px 18px -6px rgba(165, 180, 252, 0.5)' }) })}
          />
          <Box sx={{ display: 'none', [roomy]: { display: 'block' }, lineHeight: 1 }}>
            <Typography component="p" sx={{ fontWeight: 700, letterSpacing: '-0.025em', fontSize: '1.0625rem', lineHeight: 1.15 }}>
              SkillPath
            </Typography>
            <Typography component="p" variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' }, lineHeight: 1.2, fontSize: '0.6875rem' }}>
              AI-aware career intelligence
            </Typography>
          </Box>
        </Box>

        {/* where you are: the profile or the results */}
        <Box
          component="nav"
          aria-label="SkillPath"
          className="no-print"
          sx={(t) => ({
            mx: 'auto',
            display: 'flex',
            gap: 0.25,
            p: 0.5,
            borderRadius: `${RADIUS.pill}px`,
            bgcolor: ink(0.045),
            boxShadow: `inset 0 1px 2px ${ink(0.06)}`,
            ...t.applyStyles('dark', { bgcolor: white(0.05), boxShadow: `inset 0 1px 2px rgba(0, 0, 0, 0.4)` }),
          })}
        >
          {ITEMS.map(({ id, label, icon: Icon }) => {
            const active = view === id
            const locked = id === 'results' && !resultsReady
            const button = (
              <ButtonBase
                key={id}
                data-nav={id}
                aria-current={active ? 'page' : undefined}
                disabled={disabled || locked}
                onClick={() => !active && onNavigate(id)}
                sx={{
                  position: 'relative',
                  isolation: 'isolate',
                  height: { xs: 38, sm: 40 },
                  px: { xs: 1.5, sm: 2 },
                  gap: 0.75,
                  borderRadius: `${RADIUS.pill}px`,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: active ? 'text.primary' : 'text.secondary',
                  transition: 'color 150ms ease',
                  '&.Mui-disabled': { color: 'text.disabled' },
                  [HOVER]: { '&:hover:not(.Mui-disabled)': { color: 'text.primary' } },
                  '& svg': { fontSize: 18, display: 'none', [roomy]: { display: 'block' } },
                  [FORCED_COLORS]: active ? { border: '2px solid CanvasText' } : {},
                }}
              >
                {active && (
                  <Box
                    component={m.span}
                    layoutId="nav-active"
                    transition={{ layout: TRANSITION.spring }}
                    aria-hidden="true"
                    sx={(t) => ({
                      position: 'absolute',
                      inset: 0,
                      zIndex: -1,
                      borderRadius: `${RADIUS.pill}px`,
                      bgcolor: white(0.96),
                      boxShadow: `0 1px 2px ${ink(0.08)}, 0 4px 12px -4px ${ink(0.14)}`,
                      ...t.applyStyles('dark', { bgcolor: white(0.13), boxShadow: `inset 0 1px 0 ${white(0.1)}, 0 4px 14px -4px rgba(0, 0, 0, 0.6)` }),
                    })}
                  />
                )}
                <Icon aria-hidden="true" />
                {label}
              </ButtonBase>
            )
            // a disabled button cannot show a tooltip itself: the span carries it
            return locked ? (
              <Tooltip key={id} title="Your results appear here after Get recommendations">
                <span>{button}</span>
              </Tooltip>
            ) : (
              button
            )
          })}
        </Box>

        {mode && (
          <Tooltip title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton
              onClick={toggle}
              className="no-print"
              aria-label="Toggle dark mode"
              aria-pressed={dark}
              sx={(t) => ({ flexShrink: 0, width: 42, height: 42, color: 'text.primary', [HOVER]: { '&:hover': { bgcolor: ink(0.06), ...t.applyStyles('dark', { bgcolor: white(0.08) }) } } })}
            >
              {/* no animation on page load, only when the theme changes */}
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                  key={String(dark)}
                  style={{ display: 'inline-flex' }}
                  initial={turn(-30)}
                  animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
                  exit={{ ...turn(30), transition: TRANSITION.small }}
                >
                  {dark ? <LightMode /> : <DarkMode />}
                </m.span>
              </AnimatePresence>
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}
