import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { Component } from 'react'
import type { ReactNode } from 'react'

/**
 * Last resort: if rendering ever throws, show what happened and a way back instead of
 * a blank page. API problems are handled in the app itself; this is for bugs.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Container component="main" maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
        <Paper role="alert" sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}>
          <Typography variant="h6" component="h1">
            Something went wrong on this page
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            SkillPath hit an unexpected problem and stopped. Reloading starts it again; your answers are not kept.
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()} sx={{ mt: 3 }}>
            Reload SkillPath
          </Button>
          {this.state.error.message && (
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ mt: 3, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', overflowWrap: 'anywhere' }}
            >
              Details: {this.state.error.message}
            </Typography>
          )}
        </Paper>
      </Container>
    )
  }
}
