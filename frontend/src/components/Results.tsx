import EditNote from '@mui/icons-material/EditNote'
import ExpandMore from '@mui/icons-material/ExpandMore'
import Print from '@mui/icons-material/Print'
import RestartAlt from '@mui/icons-material/RestartAlt'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { Recommendation, SkillSuggestion } from '../api/types'
import { pct } from '../format'
import RoleCard from './RoleCard'
import WhatIfPanel from './WhatIfPanel'

interface Props {
  result: Recommendation
  comparison: { before: Recommendation; changes: string[] } | null
  busy: boolean
  onEdit: () => void
  onRestart: () => void
  onPrint: () => void
  onTrySkill: (s: SkillSuggestion) => void
  onClearComparison: () => void
}

function Bar({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ fontWeight: strong ? 600 : 400 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: strong ? 600 : 400 }}>
          {pct(value)}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={value * 100} sx={{ height: 6, borderRadius: 3, mt: 0.5 }} />
    </Box>
  )
}

export default function Results(props: Props) {
  const { result, comparison } = props
  const top = result.roles[0]
  const m = result.model

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-end' }, gap: 2 }}
      >
        <Box>
          <Typography variant="h5">Your top job role matches</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
            Your best match is <strong>{top.label}</strong>. Each percentage is how likely the model thinks it is that a
            developer with your answers works in that role, out of {m.classes} roles.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} className="no-print" sx={{ flexShrink: 0, flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<EditNote />} onClick={props.onEdit}>
            Change answers (what if…?)
          </Button>
          <Button variant="outlined" startIcon={<Print />} onClick={props.onPrint}>
            Print / PDF
          </Button>
          <Button startIcon={<RestartAlt />} onClick={props.onRestart}>
            Start over
          </Button>
        </Stack>
      </Stack>

      {comparison && (
        <WhatIfPanel
          before={comparison.before}
          after={result}
          changes={comparison.changes}
          onClear={props.onClearComparison}
        />
      )}

      <Grid container spacing={2}>
        {result.roles.map((r) => (
          <Grid key={r.job_role} size={{ xs: 12, md: 4 }}>
            <RoleCard role={r} busy={props.busy} onTrySkill={props.onTrySkill} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 2.5, height: '100%' }} className="avoid-break">
            <Typography variant="h6">Career families</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The 20 roles grouped into broader career paths. A family’s score adds up its roles, so it shows the
              direction even when no single role stands out.
            </Typography>
            <Stack spacing={1.5}>
              {result.families.map((f, i) => (
                <Bar key={f.family} label={f.family} value={f.probability} strong={i === 0} />
              ))}
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 2.5, height: '100%' }} className="avoid-break">
            <Typography variant="h6" sx={{ mb: 1 }}>
              Please keep in mind
            </Typography>
            <Stack spacing={1}>
              {result.notes.map((n) => (
                <Alert key={n} severity="info" variant="outlined">
                  {n}
                </Alert>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Accordion disableGutters className="no-print">
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            See all {result.ranking.length} job roles
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container columnSpacing={4} rowSpacing={1.5}>
            {result.ranking.map((r, i) => (
              <Grid key={r.job_role} size={{ xs: 12, sm: 6 }}>
                <Bar label={`${i + 1}. ${r.label}`} value={r.probability} strong={i < 3} />
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Typography variant="caption" color="text.secondary" component="p">
        Model: {m.name}, tested on {m.test_rows.toLocaleString()} survey respondents it never saw during training. The
        true role was in its top 3 for {pct(m.test_top3_accuracy)} of them (top 3 career families:{' '}
        {pct(m.test_family_top3_accuracy)}). {result.attribution}
      </Typography>
    </Stack>
  )
}
