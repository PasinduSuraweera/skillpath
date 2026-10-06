import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import CompareArrows from '@mui/icons-material/CompareArrows'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { Recommendation } from '../api/types'
import { pct, points } from '../format'

interface Props {
  before: Recommendation
  after: Recommendation
  changes: string[]
  onClear: () => void
}

/** Rank beside a percentage; on phones it moves under it so the table fits. */
function Rank({ n }: { n: number }) {
  return (
    <Typography component="span" variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'inline' } }}>
      #{n}
    </Typography>
  )
}

/** Side-by-side of the previous and the current result after answers changed. */
export default function WhatIfPanel({ before, after, changes, onClear }: Props) {
  const prob = (r: Recommendation, job: string) => r.ranking.find((x) => x.job_role === job)?.probability ?? 0
  const rank = (r: Recommendation, job: string) => r.ranking.findIndex((x) => x.job_role === job) + 1
  // every role that was in either top 3, current order first
  const jobs = [...new Set([...after.roles.map((r) => r.job_role), ...before.roles.map((r) => r.job_role)])]

  return (
    <Paper
      sx={(t) => ({
        p: { xs: 2, sm: 2.5 },
        borderColor: alpha(t.palette.primary.main, 0.4),
        bgcolor: alpha(t.palette.primary.main, 0.025),
      })}
      className="avoid-break"
      component="section"
      aria-label="What if comparison"
    >
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
          <CompareArrows color="primary" />
          <Typography variant="h6" component="h3">
            What if…? Before and after
          </Typography>
        </Stack>
        <Button size="small" onClick={onClear} className="no-print" sx={{ flexShrink: 0 }}>
          Hide comparison
        </Button>
      </Stack>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {changes.map((c) => (
          <Chip
            key={c}
            label={c}
            size="small"
            variant="outlined"
            // long answers ("Cloud and dev platforms used: − npm, Pip") wrap instead of running off a phone screen
            sx={{ maxWidth: '100%', height: 'auto', bgcolor: 'background.paper', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.375 } }}
          />
        ))}
      </Stack>
      <Table size="small" aria-label="Before and after comparison" sx={{ '& td, & th': { px: { xs: 1, sm: 2 } } }}>
        <TableHead>
          <TableRow>
            <TableCell>Job role</TableCell>
            <TableCell align="right">Before</TableCell>
            <TableCell align="right">After</TableCell>
            <TableCell align="right">Change</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {jobs.map((job) => {
            const label = after.ranking.find((x) => x.job_role === job)?.label ?? job
            const b = prob(before, job)
            const a = prob(after, job)
            const up = a - b >= 0.0005
            const down = b - a >= 0.0005
            return (
              <TableRow key={job}>
                <TableCell>{label}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {pct(b)} <Rank n={rank(before, job)} />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {pct(a)} <Rank n={rank(after, job)} />
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ color: up ? 'success.main' : down ? 'error.main' : 'text.secondary', whiteSpace: 'nowrap' }}
                >
                  {up && <ArrowUpward fontSize="inherit" sx={{ verticalAlign: 'middle' }} />}
                  {down && <ArrowDownward fontSize="inherit" sx={{ verticalAlign: 'middle' }} />} {points(a - b)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Paper>
  )
}
