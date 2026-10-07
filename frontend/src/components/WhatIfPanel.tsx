import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowForward from '@mui/icons-material/ArrowForward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import CompareArrows from '@mui/icons-material/CompareArrows'
import Remove from '@mui/icons-material/Remove'
import TrendingDown from '@mui/icons-material/TrendingDown'
import TrendingUp from '@mui/icons-material/TrendingUp'
import Box from '@mui/material/Box'
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
import { m as motion } from 'motion/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Recommendation } from '../api/types'
import { pct, points } from '../format'
import { STAGGER, TRANSITION, useReveal } from '../motion'
import { RADIUS, surfaceFill } from '../theme'
import { compareRuns, whatIfHighlights } from '../whatif'
import type { Highlight, Movement } from '../whatif'
import CountUp from './CountUp'

interface Props {
  before: Recommendation
  after: Recommendation
  changes: string[]
  onClear: () => void
}

const NOISE = 0.0005
const tone = (d: number) => (d >= NOISE ? 'success.main' : d <= -NOISE ? 'error.main' : 'text.secondary')

/** One end of the before → after strip: the best match at that moment. */
function End({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1.5 }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

/** The arrow between the parts of the strip; points down when they stack on a phone. */
function Then() {
  return (
    <Box aria-hidden="true" sx={{ display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
      <ArrowForward sx={{ fontSize: 18, transform: { xs: 'rotate(90deg)', md: 'none' } }} />
    </Box>
  )
}

/** Rank on its own, or a move such as #5 ↑ #3, coloured by direction. */
function RankMove({ m }: { m: Movement }) {
  if (m.climb === 0) {
    return (
      <Typography component="span" variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'inline' } }}>
        #{m.after.rank}
      </Typography>
    )
  }
  const Arrow = m.climb > 0 ? ArrowUpward : ArrowDownward
  return (
    <Typography
      component="span"
      variant="caption"
      sx={{ display: { xs: 'block', sm: 'inline' }, color: m.climb > 0 ? 'success.main' : 'error.main', fontWeight: 600, whiteSpace: 'nowrap' }}
    >
      <Arrow sx={{ fontSize: 12, verticalAlign: '-1px' }} />#{m.after.rank}
      <span className="sp-sr-only"> (was #{m.before.rank})</span>
    </Typography>
  )
}

/**
 * The change as a bar growing out from a centre line, right for a gain and left
 * for a loss, scaled to the largest change in the table. Grows in when the row
 * first appears (once the panel has faded in) and moves to new values on later what-ifs.
 */
function DeltaBar({ delta, scale }: { delta: number; scale: number }) {
  const frac = Math.min(1, Math.abs(delta) / scale)
  const up = delta >= 0
  const reveal = useReveal()
  // the first growth waits for the panel to fade in; later values move at once
  const [grown, setGrown] = useState(!reveal)
  return (
    <Box
      aria-hidden="true"
      sx={(t) => ({
        position: 'relative',
        display: { xs: 'none', sm: 'inline-block' },
        verticalAlign: 'middle',
        width: 56,
        height: 6,
        mr: 1,
        borderRadius: 999,
        bgcolor: alpha(t.palette.text.primary, 0.06),
      })}
    >
      <Box
        component={motion.div}
        // the bar is the value, so it grows from its zero line (scaleX 0), not from a squashed shape
        initial={reveal ? { scaleX: 0 } : false}
        animate={{ scaleX: frac }}
        transition={grown ? TRANSITION.update : { ...TRANSITION.update, delay: 0.2 }}
        onAnimationComplete={() => setGrown(true)}
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '50%',
          ...(up ? { left: '50%', borderRadius: '0 999px 999px 0' } : { right: '50%', borderRadius: '999px 0 0 999px' }),
          transformOrigin: up ? 'left' : 'right',
          bgcolor: up ? 'success.main' : 'error.main',
          opacity: Math.abs(delta) < NOISE ? 0 : 0.85,
        }}
      />
      <Box sx={(t) => ({ position: 'absolute', left: 'calc(50% - 0.5px)', top: -2, bottom: -2, width: '1px', bgcolor: alpha(t.palette.text.primary, 0.3) })} />
    </Box>
  )
}

const HIGHLIGHT_ICON = { up: TrendingUp, down: TrendingDown, same: Remove }
const HIGHLIGHT_COLOR = { up: 'success.main', down: 'error.main', same: 'text.secondary' }

/**
 * Before → change → after, for a re-run with changed answers: the best match on
 * each side of what was changed, a few plain-words points about what moved, and
 * every role that was in either top 3 with its old and new figures. New figures
 * count from their old value and rows glide to their new order (layout), so the
 * change is seen happening rather than just swapped in.
 */
export default function WhatIfPanel({ before, after, changes, onClear }: Props) {
  const rows = compareRuns(before, after)
  const highlights: Highlight[] = whatIfHighlights(before, after)
  const scale = Math.max(0.02, ...rows.map((r) => Math.abs(r.delta)))
  const topBefore = before.roles[0]
  const topAfter = after.roles[0]
  const reveal = useReveal()

  return (
    <Paper
      variant="raised"
      sx={(t) => ({
        p: { xs: 2, sm: 2.5 },
        // a raised panel with an accent edge and a faint accent wash at the top: the model's answer to "what if"
        borderColor: alpha(t.palette.primary.main, 0.4),
        backgroundImage: `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.06)}, transparent 200px)`,
      })}
      className="avoid-break"
      component="section"
      aria-label="What if comparison"
    >
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
          <CompareArrows color="primary" />
          <Typography variant="h6" component="h2" id="whatif-title" tabIndex={-1} sx={{ scrollMarginTop: 96 }}>
            What if…? Before and after
          </Typography>
        </Stack>
        <Button size="small" onClick={onClear} className="no-print" sx={{ flexShrink: 0 }}>
          Hide comparison
        </Button>
      </Stack>

      {/* before → what you changed → after */}
      <Box
        sx={(t) => ({
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto minmax(0, 1.4fr) auto minmax(0, 1fr)' },
          gap: { xs: 1, md: 2 },
          alignItems: 'center',
          p: { xs: 1.5, sm: 2 },
          mb: 2,
          borderRadius: `${RADIUS.inset}px`,
          ...surfaceFill(t, 'control'),
          border: `1px solid ${t.palette.divider}`,
        })}
      >
        <End label="Before">
          <Typography variant="subtitle2" component="p" noWrap title={topBefore.label}>
            {topBefore.label}
          </Typography>
          <Typography variant="h6" component="p" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
            {pct(topBefore.probability)}
          </Typography>
        </End>
        <Then />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1.5 }}>
            You changed
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.25 }}>
            {changes.map((c) => (
              <Chip
                key={c}
                label={c}
                size="small"
                variant="outlined"
                // long answers ("Cloud and dev platforms used: − npm, Pip") wrap instead of running off a phone screen
                sx={{ maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.375 } }}
              />
            ))}
          </Stack>
        </Box>
        <Then />
        <End label="After">
          <Typography variant="subtitle2" component="p" noWrap title={topAfter.label}>
            {topAfter.label}
          </Typography>
          <Typography variant="h6" component="p" color="primary" sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
            {/* counts from this role's own previous figure, also when it has just taken over the top spot */}
            <CountUp
              key={topAfter.job_role}
              value={topAfter.probability}
              format={pct}
              from={rows.find((r) => r.job_role === topAfter.job_role)?.before.probability}
            />
          </Typography>
        </End>
      </Box>

      {/* what that did, in words (App announces the same sentences to screen readers) */}
      <Stack component="ul" spacing={0.75} sx={{ listStyle: 'none', m: 0, p: 0, mb: 2 }}>
        {highlights.map((h, i) => {
          const Icon = HIGHLIGHT_ICON[h.tone]
          return (
            <Stack
              key={h.text}
              component={motion.li}
              // one after another, once the panel has faded in
              initial={reveal ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...TRANSITION.large, delay: 0.12 + ((i + 1) * STAGGER) / 1000 }}
              direction="row"
              spacing={1}
              sx={{ alignItems: 'flex-start' }}
            >
              <Icon aria-hidden="true" sx={{ fontSize: 18, mt: '2px', color: HIGHLIGHT_COLOR[h.tone] }} />
              <Typography variant="body2">{h.text}</Typography>
            </Stack>
          )
        })}
      </Stack>

      {/* scrolls sideways inside the card rather than widening the page, should a label ever be too long */}
      <Box sx={{ overflowX: 'auto', mx: { xs: -0.5, sm: 0 } }}>
        <Table size="small" aria-label="Before and after comparison" sx={{ '& td, & th': { px: { xs: 0.75, sm: 1.5 } } }}>
          <TableHead>
            <TableRow>
              <TableCell>Job role</TableCell>
              <TableCell align="right">Before</TableCell>
              <TableCell align="right">After</TableCell>
              <TableCell align="right">
                Change
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  {' '}
                  (pts)
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((m) => (
              <TableRow
                key={m.job_role}
                component={motion.tr}
                layout="position"
                transition={{ layout: TRANSITION.move }}
                sx={(t) => ({
                  ...(m.left && { '& td': { color: 'text.secondary' } }),
                  ...(m.entered && { bgcolor: alpha(t.palette.success.main, 0.06) }),
                })}
              >
                <TableCell>
                  <Box component="span" sx={{ fontWeight: m.after.rank === 1 ? 600 : 400 }}>
                    {m.label}
                  </Box>
                  {(m.entered || m.left) && (
                    <Box
                      component="span"
                      sx={(t) => ({
                        // under the name on phones, beside it on wider screens
                        display: { xs: 'table', sm: 'inline-block' },
                        ml: { xs: 0, sm: 1 },
                        mt: { xs: 0.5, sm: 0 },
                        px: 0.75,
                        borderRadius: 999,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        lineHeight: '18px',
                        whiteSpace: 'nowrap',
                        verticalAlign: '1px',
                        // on the green tint the light theme needs the deeper green to stay over 4.5:1
                        ...(m.entered
                          ? { color: t.palette.success.dark, ...t.applyStyles('dark', { color: t.palette.success.main }) }
                          : { color: t.palette.text.secondary }),
                        bgcolor: m.entered ? alpha(t.palette.success.main, 0.12) : alpha(t.palette.text.primary, 0.06),
                      })}
                    >
                      {m.entered ? 'New in top 3' : 'Left top 3'}
                    </Box>
                  )}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                  {pct(m.before.probability)}{' '}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'inline' } }}>
                    #{m.before.rank}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                  <CountUp value={m.after.probability} format={pct} from={m.before.probability} /> <RankMove m={m} />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: tone(m.delta), fontVariantNumeric: 'tabular-nums' }}>
                  <DeltaBar delta={m.delta} scale={scale} />
                  {points(m.delta).replace(' pts', '')}
                  {/* "pts" fits beside the bar on wider screens; the column heading says it on phones */}
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    {points(m.delta).endsWith(' pts') ? ' pts' : ''}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  )
}
