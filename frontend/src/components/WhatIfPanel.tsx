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
import type { Recommendation } from '../api/types'
import { pct, points } from '../format'

interface Props {
  before: Recommendation
  after: Recommendation
  changes: string[]
  onClear: () => void
}

/** Side-by-side of the previous and the current result after answers changed. */
export default function WhatIfPanel({ before, after, changes, onClear }: Props) {
  const prob = (r: Recommendation, job: string) => r.ranking.find((x) => x.job_role === job)?.probability ?? 0
  const rank = (r: Recommendation, job: string) => r.ranking.findIndex((x) => x.job_role === job) + 1
  // every role that was in either top 3, current order first
  const jobs = [...new Set([...after.roles.map((r) => r.job_role), ...before.roles.map((r) => r.job_role)])]

  return (
    <Paper sx={{ p: 2.5, borderColor: 'primary.main' }} className="avoid-break">
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CompareArrows color="primary" />
          <Typography variant="h6">What if…? Before and after</Typography>
        </Stack>
        <Button size="small" onClick={onClear} className="no-print">
          Hide comparison
        </Button>
      </Stack>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {changes.map((c) => (
          <Chip key={c} label={c} size="small" variant="outlined" />
        ))}
      </Stack>
      <Table size="small" aria-label="Before and after comparison">
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
                <TableCell align="right">
                  {pct(b)} <Typography component="span" variant="caption" color="text.secondary">#{rank(before, job)}</Typography>
                </TableCell>
                <TableCell align="right">
                  {pct(a)} <Typography component="span" variant="caption" color="text.secondary">#{rank(after, job)}</Typography>
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
