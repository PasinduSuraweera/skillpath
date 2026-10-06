import DarkMode from '@mui/icons-material/DarkMode'
import LightMode from '@mui/icons-material/LightMode'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha, useColorScheme } from '@mui/material/styles'
import { useState } from 'react'
import type { MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { withViewTransition } from '../motion'

export default function Header() {
  const { mode, systemMode, setMode } = useColorScheme()
  const dark = (mode === 'system' ? systemMode : mode) === 'dark'
  // the icon only animates after a click, not on page load
  const [toggled, setToggled] = useState(false)

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    setToggled(true)
    // the new theme spreads out from the button instead of the page flashing from light to dark
    const r = e.currentTarget.getBoundingClientRect()
    withViewTransition(() => flushSync(() => setMode(dark ? 'light' : 'dark')), { x: r.left + r.width / 2, y: r.top + r.height / 2 })
  }

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      className="sp-material"
      sx={(t) => ({
        '--sp-solid': t.palette.background.default,
        bgcolor: alpha(t.palette.background.default, 0.78),
        backdropFilter: 'saturate(180%) blur(14px)',
        WebkitBackdropFilter: 'saturate(180%) blur(14px)',
        borderBottom: 1,
        borderColor: 'divider',
        backgroundImage: 'none',
      })}
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
              <Box component="span" key={String(dark)} className={toggled ? 'sp-icon-in' : undefined} sx={{ display: 'inline-flex' }}>
                {dark ? <LightMode /> : <DarkMode />}
              </Box>
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  )
}
