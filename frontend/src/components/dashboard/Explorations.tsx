import History from '@mui/icons-material/History'
import Undo from '@mui/icons-material/Undo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { m } from 'motion/react'
import { Pill, Tile } from '../../design/primitives'
import type { SurfaceMotion } from '../../design/primitives'
import { AURORA, FONT, RADIUS, gradientRing, insetFill, ink, white } from '../../design/tokens'
import { explorationLabel } from '../../explorations'
import type { Exploration } from '../../explorations'
import { pct, points } from '../../format'
import { TRANSITION, revealChild } from '../../motion'

const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

interface Props {
  history: Exploration[]
  currentId: number
  busy: boolean
  onRestore: (e: Exploration) => void
  /** the tile's entrance (see SurfaceMotion) */
  motion?: SurfaceMotion
}

/**
 * The session's explorations as a timeline: each run, what changed to start it, and the best
 * match it produced (with how far it moved). Any earlier run is one press from coming back
 * (it is run again, so the comparison shows what that changes). Memory only, never saved.
 */
export default function Explorations({ history, currentId, busy, onRestore, motion }: Props) {
  return (
    <Tile icon={<History />} tone="cyan" title="Your explorations" subtitle="This session only · nothing is saved" className="no-print" motion={motion}>
      {history.length < 2 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: -0.5, mb: 2, maxWidth: 720 }}>
          Try a what-if: add a suggested skill or change an answer. Each run appears here, so you can see how your matches
          moved and go back to any of them.
        </Typography>
      )}
      <Box
        component="ol"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0.5,
          mx: -0.5,
          display: 'grid',
          gap: 1.25,
          // a row on wide screens (scrolling sideways inside the tile when long), a column on phones
          gridAutoFlow: { xs: 'row', sm: 'column' },
          gridAutoColumns: { sm: 'minmax(232px, 1fr)' },
          overflowX: { sm: 'auto' },
          scrollSnapType: { sm: 'x proximity' },
        }}
      >
          {history.map((e, i) => {
            const top = e.result.roles[0]
            const prev = history[i - 1]
            const before = prev?.result.ranking.find((r) => r.job_role === top.job_role)?.probability
            const newTop = prev && prev.result.roles[0].job_role !== top.job_role
            const current = e.id === currentId
            return (
              <Box
                key={e.id}
                component={m.li}
                layout="position"
                // in order as the tile reveals; a run added later rises in on its own
                {...revealChild('item')}
                transition={{ layout: TRANSITION.move }}
                sx={(t) => ({
                  position: 'relative',
                  isolation: 'isolate',
                  scrollSnapAlign: 'start',
                  minWidth: 0,
                  p: 1.75,
                  borderRadius: `${RADIUS.inset}px`,
                  border: `1px solid ${t.palette.divider}`,
                  ...insetFill(t, current ? 'raised' : 'quiet'),
                  ...(current && {
                    border: 0,
                    backgroundImage: `linear-gradient(160deg, ${alpha(AURORA[0], 0.1)}, ${alpha(AURORA[3], 0.05)})`,
                    '&::before': gradientRing(`linear-gradient(140deg, ${AURORA[0]}, ${AURORA[2]} 60%, ${AURORA[3]})`),
                  }),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                })}
              >
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                  <Box
                    component="span"
                    sx={(t) => ({ fontFamily: FONT.mono, fontSize: '0.75rem', fontWeight: 700, px: 0.75, borderRadius: '6px', color: 'text.secondary', bgcolor: ink(0.06), ...t.applyStyles('dark', { bgcolor: white(0.08) }) })}
                  >
                    Run {e.id}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {time.format(e.at)}
                  </Typography>
                  {current && (
                    <Pill tone="brand" sx={{ ml: 'auto' }}>
                      Viewing
                    </Pill>
                  )}
                </Stack>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" component="p" noWrap>
                    {explorationLabel(e)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="p" noWrap title={e.changes.join('\n')}>
                    {e.changes[0] ?? 'Starting point'}
                  </Typography>
                </Box>
                <Box sx={{ mt: 'auto', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary" component="p">
                    Best match
                  </Typography>
                  <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1 }}>
                    <Typography variant="subtitle2" component="p" noWrap sx={{ minWidth: 0 }}>
                      {top.label}
                    </Typography>
                    <Typography variant="subtitle2" component="p" sx={{ ml: 'auto', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {pct(top.probability)}
                    </Typography>
                  </Stack>
                  {prev && (
                    <Typography variant="caption" component="p" sx={{ fontWeight: 600, color: newTop ? 'primary.main' : before !== undefined && top.probability - before >= 0.0005 ? 'success.main' : before !== undefined && top.probability - before <= -0.0005 ? 'error.main' : 'text.secondary' }}>
                      {newTop ? 'New best match' : before !== undefined ? `${points(top.probability - before)} on run ${prev.id}` : ''}
                    </Typography>
                  )}
                </Box>
                {!current && (
                  <Button size="small" variant="outlined" startIcon={<Undo />} disabled={busy} onClick={() => onRestore(e)} sx={{ alignSelf: 'flex-start' }}>
                    Go back to run {e.id}
                  </Button>
                )}
              </Box>
            )
          })}
      </Box>
    </Tile>
  )
}
