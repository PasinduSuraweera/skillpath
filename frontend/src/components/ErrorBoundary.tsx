import ErrorOutline from '@mui/icons-material/ErrorOutlineOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import { Component } from 'react'
import type { ReactNode } from 'react'
import { IconTile } from '../design/primitives'
import { panel } from '../design/surfaces'
import { FONT, RADIUS } from '../design/tokens'

/**
 * Last resort: if rendering ever throws, show what happened and a way back instead of
 * a blank page. API problems are handled in the app itself; this is for bugs. It looks like
 * the load-error card (App), on the same glass.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Container component="main" maxWidth="sm" sx={{ py: { xs: 4, md: 10 } }}>
        <Box role="alert" className="sp-rise" sx={(t) => ({ ...panel(t, { elevation: 'high', radius: RADIUS.panel }), p: { xs: 3, md: 5 }, textAlign: 'center' })}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <IconTile tone="rose" size={56}>
              <ErrorOutline />
            </IconTile>
          </Box>
          <Typography variant="h3" component="h1">
            Something went wrong on this page
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            SkillPath hit an unexpected problem and stopped. Reloading starts it again; your answers are not kept.
          </Typography>
          <Button variant="contained" size="large" onClick={() => window.location.reload()} sx={{ mt: 3 }}>
            Reload SkillPath
          </Button>
          {this.state.error.message && (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3, fontFamily: FONT.mono, overflowWrap: 'anywhere' }}>
              Details: {this.state.error.message}
            </Typography>
          )}
        </Box>
      </Container>
    )
  }
}
