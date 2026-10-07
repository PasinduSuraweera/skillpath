import AutoAwesome from '@mui/icons-material/AutoAwesome'
import Payments from '@mui/icons-material/PaymentsOutlined'
import SmartToy from '@mui/icons-material/SmartToyOutlined'
import Star from '@mui/icons-material/Star'
import WarningAmber from '@mui/icons-material/WarningAmber'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { m } from 'motion/react'
import type { ReactNode } from 'react'
import type { RoleRecommendation, SkillSuggestion } from '../../api/types'
import { DotScale, Eyebrow, GlassSheen, Pill, RingGauge } from '../../design/primitives'
import { spotlight } from '../../design/surfaces'
import type { SurfaceMotion } from '../../design/primitives'
import { AURORA, FORCED_COLORS, RADIUS, gradientText, gradientRing, toneColor, white } from '../../design/tokens'
import type { Tone } from '../../design/tokens'
import { money, pct } from '../../format'
import { TECH_AREAS } from '../../questions'
import CountUp from '../CountUp'

interface Props {
  role: RoleRecommendation
  busy: boolean
  pendingTech: string | null
  onTrySkill: (s: SkillSuggestion) => void
  /** its entrance, on the glass itself (see SurfaceMotion) */
  motion?: SurfaceMotion
}

export const LOW_CONFIDENCE =
  'The model correctly identifies fewer than 1 in 10 people who actually hold this role, because the survey has few of them. Treat it as a weaker suggestion.'

function Fact({ icon, tone, value, label }: { icon: ReactNode; tone: Tone; value: ReactNode; label: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1.25, minWidth: 0 }}>
      <Box aria-hidden="true" sx={(t) => ({ display: 'grid', placeItems: 'center', mt: '2px', color: toneColor(t, tone), '& svg': { fontSize: 20 } })}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 650, fontSize: '1.0625rem', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" component="p">
          {label}
        </Typography>
      </Box>
    </Stack>
  )
}

/**
 * The hero of the results: the best match, how strongly the model holds it, how ready the
 * visitor already is for it, and the one most useful thing to do next, as a single action.
 */
export default function Spotlight({ role, busy, pendingTech, onTrySkill, motion }: Props) {
  const gap = role.skill_gap
  const next = gap.missing[0]
  const s = role.salary
  const pending = busy && !!next && pendingTech === next.technology

  return (
    <Box
      component={m.section}
      {...motion}
      aria-labelledby="spotlight-title"
      className="avoid-break"
      sx={(t) => ({
        ...spotlight(t),
        p: { xs: 2.5, sm: 3.5, md: 4.5 },
        display: 'grid',
        gap: { xs: 3, md: 5 },
        gridTemplateColumns: { xs: '1fr', sm: 'auto minmax(0, 1fr)', lg: 'auto minmax(0, 1fr) minmax(300px, 360px)' },
        alignItems: 'center',
      })}
    >
      {/* light passing over the glass as it scrolls */}
      <GlassSheen />
      {/* the match figure, on a ring that fills as it counts up */}
      <Box sx={{ justifySelf: { xs: 'center', sm: 'start' } }}>
        <MatchRing probability={role.probability} />
      </Box>

      {/* who the match is */}
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
          <Pill tone="brand" icon={<AutoAwesome />}>
            Best match
          </Pill>
          <Pill tone="neutral">{role.family}</Pill>
          {role.low_confidence && (
            <Pill tone="amber" icon={<WarningAmber />}>
              Low confidence
            </Pill>
          )}
        </Stack>
        <Typography variant="h2" id="spotlight-title" sx={{ overflowWrap: 'anywhere' }}>
          {role.label}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 560, fontSize: { md: '1.0625rem' }, textWrap: 'pretty' }}>
          {role.description}
        </Typography>
        {role.low_confidence && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 560 }}>
            {LOW_CONFIDENCE}
          </Typography>
        )}

        {/* three facts in one band: readiness across the top, then pay and AI side by side */}
        <Box
          sx={{
            mt: 3,
            pt: 2.5,
            borderTop: 1,
            borderColor: 'divider',
            display: 'grid',
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            alignItems: 'start',
          }}
        >
          {/* readiness: the role's distinctive technologies the visitor already uses */}
          <Box sx={{ minWidth: 0, gridColumn: '1 / -1' }}>
            <Eyebrow>Skill readiness</Eyebrow>
            <Typography sx={{ fontWeight: 650, fontSize: '1.0625rem', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, mb: 0.75 }}>
              {gap.matched.length} of {gap.typical_count} key technologies
            </Typography>
            <DotScale filled={gap.matched.length} total={gap.typical_count} tone="indigo" />
          </Box>
          <Fact
            icon={<Payments />}
            tone="emerald"
            value={s.available && s.median != null ? money(s.median) : '–'}
            label={s.available && s.median != null ? 'median pay / year' : 'pay: too few people to say'}
          />
          <Fact icon={<SmartToy />} tone="violet" value={`${Math.round(role.ai_outlook.exposure_now)} / 100`} label="tasks done with AI today" />
        </Box>
      </Box>

      {/* the next step: the most distinctive technology of the role the visitor does not use yet */}
      <Box
        sx={(t) => ({
          gridColumn: { xs: '1', sm: '1 / -1', lg: 'auto' },
          position: 'relative',
          isolation: 'isolate',
          p: { xs: 2.25, sm: 2.75 },
          borderRadius: `${RADIUS.card}px`,
          bgcolor: white(0.62),
          boxShadow: `inset 0 1px 0 ${white(0.9)}, 0 18px 40px -22px ${alpha(AURORA[1], 0.55)}`,
          '&::before': gradientRing(`linear-gradient(140deg, ${AURORA[0]}, ${AURORA[2]} 60%, ${AURORA[3]})`),
          ...t.applyStyles('dark', { bgcolor: white(0.05), boxShadow: `inset 0 1px 0 ${white(0.06)}, 0 18px 40px -22px ${alpha(AURORA[1], 0.6)}` }),
          '@media print': { border: `1px solid ${t.palette.divider}`, boxShadow: 'none' },
          [FORCED_COLORS]: { border: '1px solid CanvasText' },
        })}
      >
        <Eyebrow tone="violet" sx={(t) => ({ color: toneColor(t, 'violet') })}>
          <AutoAwesome sx={{ fontSize: 14 }} aria-hidden="true" />
          Recommended next step
        </Eyebrow>
        {next ? (
          <>
            <Typography variant="h3" component="p" sx={{ mt: 1, fontSize: '1.625rem', overflowWrap: 'anywhere' }}>
              Learn <Box component="span" sx={(t) => gradientText(t)}>{next.technology}</Box>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {Math.round(next.share_pct)}% of people in this role use it, {next.lift.toFixed(1)}× as often as developers overall
              {' '}({TECH_AREAS[next.area].title.toLowerCase()}).
            </Typography>
            {next.wanted && (
              <Pill tone="amber" icon={<Star />} sx={{ mt: 1.25 }}>
                Already on your want-to-learn list
              </Pill>
            )}
            <Button
              variant="contained"
              fullWidth
              className="no-print"
              disabled={busy}
              onClick={() => onTrySkill(next)}
              aria-label={`What if I add ${next.technology}?`}
              startIcon={pending ? <CircularProgress size={18} color="inherit" /> : <AutoAwesome />}
              sx={{ mt: 2.25 }}
            >
              What if I add {next.technology}?
            </Button>
            <Typography variant="caption" color="text.secondary" component="p" className="no-print" sx={{ mt: 1, textAlign: 'center' }}>
              Re-runs your profile with it added and shows what moves.
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="h4" component="p" sx={{ mt: 1 }}>
              You already use all of its most distinctive technologies
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Compare your other matches below to see where else your skills lead.
            </Typography>
          </>
        )}
      </Box>
    </Box>
  )
}

/** The best match's probability as a ring with the figure counting up in its centre. */
function MatchRing({ probability }: { probability: number }) {
  return (
    <RingGauge value={probability} size={{ xs: 156, md: 196 }} thickness={15}>
      <Box>
        <Typography
          component="p"
          sx={(t) => ({
            fontWeight: 750,
            fontSize: { xs: '2.625rem', md: '3.25rem' },
            letterSpacing: '-0.05em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            ...gradientText(t),
          })}
        >
          <CountUp value={probability} format={pct} />
        </Typography>
        <Typography variant="overline" color="text.secondary" component="p" sx={{ mt: 0.5, lineHeight: 1.2 }}>
          match
        </Typography>
      </Box>
    </RingGauge>
  )
}
