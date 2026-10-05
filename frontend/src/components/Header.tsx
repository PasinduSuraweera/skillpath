import DarkMode from '@mui/icons-material/DarkMode'
import LightMode from '@mui/icons-material/LightMode'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useColorScheme } from '@mui/material/styles'

export default function Header() {
  const { mode, systemMode, setMode } = useColorScheme()
  const dark = (mode === 'system' ? systemMode : mode) === 'dark'

  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar sx={{ gap: 1.5 }}>
        <Box component="img" src="/favicon.svg" alt="" sx={{ width: 32, height: 32 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" component="h1" sx={{ lineHeight: 1.2 }}>
            SkillPath
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="p">
            AI-aware developer career paths, learned from 2025 Stack Overflow survey respondents
          </Typography>
        </Box>
        {mode && (
          <Tooltip title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton onClick={() => setMode(dark ? 'light' : 'dark')} className="no-print" aria-label="Toggle dark mode">
              {dark ? <LightMode /> : <DarkMode />}
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  )
}
