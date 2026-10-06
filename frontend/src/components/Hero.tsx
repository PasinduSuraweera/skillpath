import AutoAwesome from '@mui/icons-material/AutoAwesome'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { CSSProperties, ReactNode } from 'react'
import type { Options } from '../api/types'
import type { Sample } from '../samples'
import { BRAND_GRADIENT, BRAND_GRADIENT_DARK, tintInk } from '../theme'
import SampleBar from './SampleBar'

interface Props {
  options: Options
  /** play the entrance (first visit only, not when coming back from the results) */
  intro: boolean
  onPick: (s: Sample) => void
  disabled: boolean
  activeId: string | null
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  )
}

/** The start page: what SkillPath does, what it is built on, and a one-press way in (the examples). */
export default function Hero({ options, intro, onPick, disabled, activeId }: Props) {
  const families = new Set(options.job_roles.map((r) => r.family)).size
  // entrance order: eyebrow, title, copy, stats, examples
  const enter = (i: number) => (intro ? { className: 'sp-rise', style: { '--i': i } as CSSProperties } : {})

  return (
    <Grid container spacing={{ xs: 3, md: 6 }} className="no-print" sx={{ alignItems: 'center' }}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Box {...enter(0)}>
          <Box
            sx={(t) => ({
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.5,
              mb: 2,
              borderRadius: 999,
              fontSize: '0.75rem',
              fontWeight: 600,
              ...tintInk(t),
              bgcolor: alpha(t.palette.primary.main, 0.08),
              border: `1px solid ${alpha(t.palette.primary.main, 0.18)}`,
            })}
          >
            <AutoAwesome sx={{ fontSize: 14 }} />
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Career intelligence from the 2025 Stack Overflow survey
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              Built on the 2025 Stack Overflow survey
            </Box>
          </Box>
        </Box>
        <Typography
          variant="h3"
          component="h1"
          id="hero-title"
          tabIndex={-1}
          {...enter(1)}
          sx={{ fontSize: { xs: '2.125rem', sm: '2.75rem', md: '3.25rem' }, maxWidth: 640, textWrap: 'balance' }}
        >
          Which developer role{' '}
          <Box
            component="span"
            sx={(t) => ({
              backgroundImage: BRAND_GRADIENT,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              ...t.applyStyles('dark', { backgroundImage: BRAND_GRADIENT_DARK }),
            })}
          >
            fits you?
          </Box>
        </Typography>
        <Typography
          color="text.secondary"
          {...enter(2)}
          sx={{ mt: 2, maxWidth: 600, fontSize: { xs: '1rem', md: '1.0625rem' }, textWrap: 'pretty' }}
        >
          Answer three short steps about your skills and how you use AI. SkillPath compares your profile with about
          18,000 developers and shows your three closest job roles, with each role’s AI outlook, typical pay and the
          skills to grow next.
        </Typography>
        <Stack
          direction="row"
          {...enter(3)}
          sx={{ mt: 3, gap: { xs: 2.5, sm: 4 }, flexWrap: 'wrap', '& > * + *': { pl: { xs: 2.5, sm: 4 }, borderLeft: 1, borderColor: 'divider' } }}
        >
          <Stat value="18k" label="developers compared" />
          <Stat value={options.job_roles.length} label="job roles" />
          <Stat value={families} label="career families" />
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }} {...enter(4)}>
        <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
          <SampleBar onPick={onPick} disabled={disabled} activeId={activeId} />
        </Paper>
      </Grid>
    </Grid>
  )
}
