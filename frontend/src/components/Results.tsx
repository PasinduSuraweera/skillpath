import EditNote from '@mui/icons-material/EditNote'
import ExpandMore from '@mui/icons-material/ExpandMore'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import Print from '@mui/icons-material/Print'
import RestartAlt from '@mui/icons-material/RestartAlt'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { Recommendation, SkillSuggestion } from '../api/types'
import type { FormState } from '../form'
import { pct } from '../format'
import { DURATION, useFlip } from '../motion'
import { BRAND_GRADIENT, BRAND_GRADIENT_DARK } from '../theme'
import AnalysisSummary from './AnalysisSummary'
import RoleCard from './RoleCard'
import WhatIfPanel from './WhatIfPanel'

type Comparison = { before: Recommendation; changes: string[] }

interface Props {
  result: Recommendation
  /** the answers that produced this result */
  answers: FormState
  comparison: Comparison | null
  busy: boolean
  /** technology whose what-if re-run is in progress */
  pendingTech: string | null
  onEdit: () => void
  onRestart: () => void
  onPrint: () => void
  onTrySkill: (s: SkillSuggestion) => void
  onClearComparison: () => void
}

/**
 * Position in the results reveal (STAGGER_REVEAL apart): the heading, the analysis
 * summary, then each role card, then the supporting sections together. Mount-only:
 * a what-if re-run updates the figures in place instead of replaying it.
 */
const enter = (i: number) => ({ className: 'sp-reveal', style: { '--i': i } as CSSProperties })

function Bar({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: strong ? 600 : 400, minWidth: 0 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: strong ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>
          {pct(value)}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={value * 100}
        aria-hidden="true"
        sx={(t) => ({
          height: 6,
          mt: 0.75,
          '& .MuiLinearProgress-bar': strong
            ? { backgroundImage: BRAND_GRADIENT, ...t.applyStyles('dark', { backgroundImage: BRAND_GRADIENT_DARK }) }
            : { opacity: 0.45 },
        })}
      />
    </Box>
  )
}

export default function Results(props: Props) {
  const { result, comparison } = props
  const top = result.roles[0]
  const m = result.model

  // the three salary bars share one scale, so their pay can be compared by eye
  const payScale = Math.max(1, ...result.roles.map((r) => (r.salary.available ? (r.salary.p75 ?? 0) : 0)))

  // after a what-if, cards that change rank glide to their new place instead of jumping
  const cards = useFlip<HTMLDivElement>(result.roles.map((r) => r.job_role).join('|'))

  // keep the last comparison on screen while its panel collapses away
  const [shown, setShown] = useState<Comparison | null>(comparison)
  if (comparison && comparison !== shown) setShown(comparison)

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-end' }, gap: 2 }}
        {...enter(0)}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.6rem', md: '2rem' } }}>
            Your top job role matches
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 680, mt: 0.75 }}>
            Your best match is <Box component="strong" sx={{ color: 'text.primary' }}>{top.label}</Box>. Each percentage is
            how likely the model thinks it is that a developer with your answers works in that role, out of {m.classes}{' '}
            roles.
          </Typography>
        </Box>
        <Stack direction="row" className="no-print" sx={{ flexShrink: 0, flexWrap: 'wrap', gap: 1 }}>
          <Button variant="contained" startIcon={<EditNote />} onClick={props.onEdit}>
            Change answers (what if…?)
          </Button>
          <Button variant="outlined" startIcon={<Print />} onClick={props.onPrint}>
            Print / PDF
          </Button>
          <Button color="inherit" startIcon={<RestartAlt />} onClick={props.onRestart}>
            Start over
          </Button>
        </Stack>
      </Stack>

      <AnalysisSummary result={result} answers={props.answers} revealFrom={1} />

      {/* height animates so the cards below are pushed down smoothly instead of jumping */}
      <Collapse
        in={!!comparison}
        unmountOnExit
        timeout={{ enter: DURATION.large, exit: DURATION.medium }}
        onExited={() => setShown(null)}
        sx={{ mt: '0 !important' }}
      >
        {shown && (
          <Box sx={{ pt: 3 }}>
            <WhatIfPanel before={shown.before} after={result} changes={shown.changes} onClear={props.onClearComparison} />
          </Box>
        )}
      </Collapse>

      <Grid container spacing={2} component="section" aria-label="Top three job roles" ref={cards}>
        {result.roles.map((r, i) => (
          <Grid key={r.job_role} size={{ xs: 12, md: 4 }} data-flip={r.job_role} {...enter(3 + i)}>
            <RoleCard role={r} busy={props.busy} pendingTech={props.pendingTech} payScale={payScale} onTrySkill={props.onTrySkill} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} {...enter(6)}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, height: '100%' }} className="avoid-break">
            <Typography variant="h6" component="h3">
              Career families
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
              The 20 roles grouped into broader career paths. A family’s score adds up its roles, so it shows the
              direction even when no single role stands out.
            </Typography>
            <Stack spacing={1.75}>
              {result.families.map((f, i) => (
                <Bar key={f.family} label={f.family} value={f.probability} strong={i === 0} />
              ))}
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, height: '100%' }} className="avoid-break">
            <Typography variant="h6" component="h3" sx={{ mb: 1.5 }}>
              Please keep in mind
            </Typography>
            <Stack component="ul" spacing={1.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
              {result.notes.map((n) => (
                <Stack key={n} component="li" direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                  <InfoOutlined fontSize="small" color="primary" sx={{ mt: '1px', flexShrink: 0 }} />
                  <Typography variant="body2" color="text.secondary">
                    {n}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Accordion disableGutters className="no-print sp-reveal" style={{ '--i': 6 } as CSSProperties}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle1">See all {result.ranking.length} job roles</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2.5, pb: 2.5 }}>
          <Grid container columnSpacing={4} rowSpacing={1.75}>
            {result.ranking.map((r, i) => (
              <Grid key={r.job_role} size={{ xs: 12, sm: 6 }}>
                <Bar label={`${i + 1}. ${r.label}`} value={r.probability} strong={i < 3} />
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Typography variant="caption" color="text.secondary" component="p" sx={{ maxWidth: 900 }}>
        Model: {m.name}, tested on {m.test_rows.toLocaleString()} survey respondents it never saw during training. The
        true role was in its top 3 for {pct(m.test_top3_accuracy)} of them (top 3 career families:{' '}
        {pct(m.test_family_top3_accuracy)}). {result.attribution}
      </Typography>
    </Stack>
  )
}
