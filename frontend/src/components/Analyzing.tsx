import Check from '@mui/icons-material/Check'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { panel } from '../design/surfaces'
import { AURORA, FORCED_COLORS } from '../design/tokens'

type State = 'done' | 'active' | 'pending'

function Row({ state, children, detail }: { state: State; children: ReactNode; detail?: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
      <Box
        aria-hidden="true"
        sx={(t) => ({
          flexShrink: 0,
          mt: '1px',
          width: 22,
          height: 22,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: state === 'done' ? t.palette.success.main : 'primary.main',
          bgcolor: state === 'done' ? alpha(t.palette.success.main, 0.14) : 'transparent',
          border: state === 'pending' ? `1.5px dashed ${t.palette.divider}` : 'none',
        })}
      >
        {state === 'done' && <Check sx={{ fontSize: 15 }} />}
        {state === 'active' && <CircularProgress size={18} thickness={5} />}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: state === 'pending' ? 450 : 600, color: state === 'pending' ? 'text.secondary' : 'text.primary' }}>
          {children}
        </Typography>
        {detail && (
          <Typography variant="caption" color="text.secondary" component="p">
            {detail}
          </Typography>
        )}
      </Box>
    </Stack>
  )
}

/**
 * The analysis "orb": a ring in the aurora colours turning around a softly breathing core.
 * It only exists while a request is actually slow, so its loop never runs for nothing; with
 * reduced motion the core is still and the ring turns slowly (index.css).
 */
function Orb() {
  return (
    <Box aria-hidden="true" sx={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
      <Box
        className="sp-breathe"
        sx={{
          position: 'absolute',
          inset: 8,
          borderRadius: '50%',
          backgroundImage: `radial-gradient(circle at 35% 30%, #fff 0%, ${AURORA[3]} 22%, ${AURORA[1]} 60%, ${AURORA[2]} 100%)`,
          boxShadow: `0 0 24px ${alpha(AURORA[1], 0.6)}`,
          [FORCED_COLORS]: { border: '2px solid CanvasText' },
        }}
      />
      <Box
        className="sp-spin"
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          // a ring with a fading tail, so its turning reads at a glance: a conic gradient masked to a band
          background: `conic-gradient(from 0deg, transparent 0 15%, ${AURORA[0]} 50%, ${AURORA[2]} 80%, ${AURORA[3]})`,
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px))',
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px))',
        }}
      />
    </Box>
  )
}

interface Props {
  answered: number
  questions: number
  technologies: number
  roles: number
  /** the request has been running for several seconds */
  slow: boolean
}

/**
 * Shown over the questions only when a prediction is actually slow (a cold API, a slow
 * network); a normal one returns in milliseconds and goes straight to the results.
 * It describes the real request: the profile is ready (counted from the answers),
 * the model is scoring the roles (the request in flight), and the per-role insights
 * come with the answer. Nothing here is timed or faked.
 */
export default function Analyzing({ answered, questions, technologies, roles, slow }: Props) {
  return (
    <Box role="status" aria-live="polite" sx={(t) => ({ ...panel(t, { elevation: 'high' }), p: { xs: 2.5, sm: 3 }, textAlign: 'left' })}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2.5 }}>
        <Orb />
        <Box>
          <Typography variant="h4" component="p">
            Analysing your profile
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Matching your answers against the 2025 survey.
          </Typography>
        </Box>
      </Stack>
      <Stack spacing={1.5}>
        <Row state="done" detail={`${answered} of ${questions} questions · ${technologies} technologies`}>
          Profile ready
        </Row>
        <Row state="active" detail="Compared with about 18,000 developers who answered the same questions">
          Scoring all {roles} job roles
        </Row>
        <Row state="pending">Adding each role’s AI outlook, pay and skills to grow</Row>
      </Stack>
      {slow && (
        <Typography variant="caption" color="text.secondary" component="p" className="sp-fade" sx={{ mt: 2.5 }}>
          This is taking longer than usual. The SkillPath API may still be starting up.
        </Typography>
      )}
    </Box>
  )
}
