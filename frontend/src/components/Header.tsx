import DarkMode from '@mui/icons-material/DarkMode'
import LightMode from '@mui/icons-material/LightMode'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useColorScheme } from '@mui/material/styles'
import { AnimatePresence, m } from 'motion/react'
import type { MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { TRANSITION, withViewTransition } from '../motion'
import { glass } from '../theme'

/** The icon swap: the old icon turns away as the new one turns in, settling from slightly smaller and blurred. */
const turn = (deg: number) => ({ opacity: 0, scale: 0.8, rotate: deg, filter: 'blur(2px)' })

export default function Header() {
  const { mode, systemMode, setMode } = useColorScheme()
  const dark = (mode === 'system' ? systemMode : mode) === 'dark'

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    // the new theme spreads out from the button instead of the page flashing from light to dark
    const r = e.currentTarget.getBoundingClientRect()
    withViewTransition(() => flushSync(() => setMode(dark ? 'light' : 'dark')), { x: r.left + r.width / 2, y: r.top + r.height / 2 })
  }

  return (
    // the chrome glass layer: the page scrolls under it
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={(t) => {
        const chrome = glass(t, 'chrome')
        return {
          ...chrome,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundImage: 'none',
          '@media print': { ...chrome['@media print'], position: 'static' },
        }
      }}
    >
      <Toolbar
        sx={{
          gap: 1.5,
          minHeight: { xs: 56, sm: 60 },
          // a phone held sideways: every pixel of height counts
          '@media (max-height: 500px)': { minHeight: '48px !important' },
          pl: 'max(16px, env(safe-area-inset-left))',
          pr: 'max(16px, env(safe-area-inset-right))',
        }}
      >
        <Box component="img" src="/favicon.svg" alt="" sx={{ width: 30, height: 30, flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" component="p" sx={{ lineHeight: 1.2, fontWeight: 700, letterSpacing: '-0.01em' }}>
            SkillPath
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            component="p"
            sx={{ display: { xs: 'none', sm: 'block' }, '@media (max-height: 500px)': { display: 'none' } }}
          >
            AI-aware developer career paths, learned from 2025 Stack Overflow survey respondents
          </Typography>
        </Box>
        {mode && (
          <Tooltip title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton onClick={toggle} className="no-print" aria-label="Toggle dark mode" aria-pressed={dark}>
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
      </Toolbar>
    </AppBar>
  )
}
