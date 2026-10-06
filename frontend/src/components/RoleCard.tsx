import AddCircleOutline from '@mui/icons-material/AddCircleOutlineOutlined'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import ExpandMore from '@mui/icons-material/ExpandMore'
import Payments from '@mui/icons-material/Payments'
import Public from '@mui/icons-material/Public'
import SmartToy from '@mui/icons-material/SmartToy'
import Star from '@mui/icons-material/Star'
import TrendingUp from '@mui/icons-material/TrendingUp'
import WarningAmber from '@mui/icons-material/WarningAmber'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { alpha, useTheme } from '@mui/material/styles'
import type { RoleRecommendation, SkillSuggestion } from '../api/types'
import { money, pct, points } from '../format'
import { useId, useState } from 'react'
import { DURATION, EASE, useCountUp, useHighlight } from '../motion'
import { BRAND_GRADIENT, BRAND_GRADIENT_DARK, ELEVATION, tintInk } from '../theme'
import CountUp from './CountUp'
import { AverageTick, InsightSection, Metric } from './InsightSection'

interface Props {
  role: RoleRecommendation
  busy: boolean
  /** technology whose what-if re-run is in progress */
  pendingTech: string | null
  /** highest pay figure (75th percentile) across the three cards, so their salary bars share one scale */
  payScale: number
  /** this role's place in the previous result, while a what-if comparison is shown */
  previous: { rank: number; probability: number } | null
  onTrySkill: (s: SkillSuggestion) => void
}

const AI_HELP =
  'AI Exposure Index (0-100): the share of 13 everyday development tasks (writing code, testing, documentation …) ' +
  'that people in this role do mostly or partly with AI. “Expected” also counts tasks they plan to use AI for. ' +
  'The marker on each bar is the figure across all roles. From 2025 survey respondents in the training data.'

const SALARY_HELP =
  'Annual pay in US dollars reported by survey respondents with the same role and experience level, as close to ' +
  'your location as the data allows (at least 30 people). The bar shows the middle half (25th to 75th percentile) ' +
  'with the median marked, on the same scale for all three roles.'

const SKILL_HELP =
  'Technologies used by many people in this role and noticeably more often than across all roles, from the ' +
  'training data. “In role” is the share of people in the role who use it; “vs avg” is how many times more often ' +
  'than across all roles. Press + to see how your results change if you add one.'

const gradientText = (dark: boolean) => ({
  backgroundImage: dark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT,
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  color: 'transparent',
})

/** The match bar fills in step with the percentage counting up (both are driven by useCountUp). */
function MatchBar({ probability, best }: { probability: number; best: boolean }) {
  const { value } = useCountUp(probability)
  return (
    <LinearProgress
      variant="determinate"
      value={value * 100}
      aria-label={`Match ${pct(probability)}`}
      aria-valuenow={Math.round(probability * 100)}
      sx={(t) => ({
        height: best ? 8 : 6,
        mt: 1.5,
        '& .MuiLinearProgress-bar': {
          transition: 'none',
          ...(best
            ? { backgroundImage: BRAND_GRADIENT, ...t.applyStyles('dark', { backgroundImage: BRAND_GRADIENT_DARK }) }
            : { opacity: 0.55 }),
        },
      })}
    />
  )
}

/** Middle half of the pay (25th-75th percentile) as a band with the median marked, on a scale shared by the cards. */
function PayRange({ p25, median, p75, scale }: { p25: number; median: number; p75: number; scale: number }) {
  const at = (v: number) => Math.min(100, (v / scale) * 100)
  return (
    <Box aria-hidden="true" sx={(t) => ({ position: 'relative', height: 6, mt: 1.5, borderRadius: 999, bgcolor: alpha(t.palette.text.primary, 0.07) })}>
      <Box
        sx={(t) => ({
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${at(p25)}%`,
          width: `max(6px, ${at(p75) - at(p25)}%)`,
          borderRadius: 999,
          bgcolor: alpha(t.palette.primary.main, 0.35),
        })}
      />
      <Box
        sx={{ position: 'absolute', top: -3, left: `calc(${at(median)}% - 1.5px)`, width: 3, height: 12, borderRadius: 2, bgcolor: 'primary.main' }}
      />
    </Box>
  )
}

/** One dot per distinctive technology of the role, filled for the ones the visitor uses. */
function KeySkillDots({ matched, total }: { matched: number; total: number }) {
  return (
    <Stack direction="row" aria-hidden="true" sx={{ gap: '3px', flexWrap: 'wrap', mt: 0.75 }}>
      {Array.from({ length: total }, (_, i) => (
        <Box
          key={i}
          sx={(t) => ({
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: i < matched ? 'primary.main' : alpha(t.palette.text.primary, 0.1),
            // a dot filled by a what-if (the skill just added) fills in rather than switching
            transition: `background-color ${DURATION.update}ms ease`,
          })}
        />
      ))}
    </Stack>
  )
}

/** Small caps column heading for the skills table. */
function ColumnHead({ children, width }: { children?: string; width?: number }) {
  return (
    <Typography
      variant="overline"
      sx={{
        lineHeight: 1.6,
        fontSize: '0.625rem',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
        ...(width ? { width, flexShrink: 0, textAlign: 'right' } : { flexGrow: 1 }),
      }}
    >
      {children}
    </Typography>
  )
}

export default function RoleCard({ role, busy, pendingTech, payScale, previous, onTrySkill }: Props) {
  const theme = useTheme()
  const ai = role.ai_outlook
  const s = role.salary
  const gap = role.skill_gap
  const best = role.rank === 1
  // what the last what-if did to this role
  const delta = previous ? role.probability - previous.probability : 0
  const climb = previous ? previous.rank - role.rank : 0
  const changed = Math.abs(delta) >= 0.0005
  // a brief tint on the figures that a what-if just changed, so the eye finds them
  const scoreRef = useHighlight<HTMLDivElement>(Math.round(role.probability * 1000), alpha(theme.palette.primary.main, 0.16))
  const skillsRef = useHighlight<HTMLParagraphElement>(gap.matched.length, alpha(theme.palette.primary.main, 0.16))
  // phones: the runners-up start folded, so three long cards do not stack into a very long page
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const collapsible = phone && !best
  const [open, setOpen] = useState(false)
  const detailsId = `details-${useId()}`

  return (
    <Paper
      component="article"
      aria-label={`#${role.rank} ${role.label}`}
      className="avoid-break"
      sx={(t) => ({
        position: 'relative',
        overflow: 'hidden',
        p: { xs: 2, sm: 2.5 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // the sections below lay out by the card's own width, not the window's
        containerType: 'inline-size',
        // the best match: an accent edge, a quiet tint and a little more lift, so the ranking reads at a glance
        ...(best && {
          borderColor: alpha(t.palette.primary.main, 0.35),
          backgroundImage: `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.06)}, transparent 160px)`,
          boxShadow: ELEVATION.raised,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '0 0 auto 0',
            height: 3,
            backgroundImage: BRAND_GRADIENT,
          },
          ...t.applyStyles('dark', {
            boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 12px 32px -14px ${alpha(t.palette.primary.main, 0.4)}`,
            '&::before': { backgroundImage: BRAND_GRADIENT_DARK },
          }),
        }),
      })}
    >
      <Box>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, minHeight: 24 }}>
          {best ? (
            <Box
              sx={(t) => ({
                display: 'inline-flex',
                alignItems: 'center',
                flexShrink: 0,
                gap: 0.5,
                px: 1,
                py: 0.25,
                borderRadius: 999,
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                ...tintInk(t),
                bgcolor: alpha(t.palette.primary.main, 0.12),
              })}
            >
              <AutoAwesome sx={{ fontSize: 13 }} />
              Best match
            </Box>
          ) : (
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              #{role.rank}
            </Typography>
          )}
          <Typography variant="overline" color="text.secondary" noWrap title={role.family} sx={{ lineHeight: 1.4, minWidth: 0 }}>
            {best ? role.family : `· ${role.family}`}
          </Typography>
          {climb !== 0 && previous && (
            <Typography
              variant="caption"
              className="sp-fade"
              sx={{ ml: 'auto', flexShrink: 0, fontWeight: 600, whiteSpace: 'nowrap', color: climb > 0 ? 'success.main' : 'error.main' }}
            >
              {climb > 0 ? '↑' : '↓'} from #{previous.rank > 20 ? '20+' : previous.rank}
            </Typography>
          )}
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, mt: 0.75 }}>
          <Typography
            variant="h6"
            component="h3"
            sx={{ lineHeight: 1.25, fontSize: best ? '1.25rem' : '1.125rem', minWidth: 0, overflowWrap: 'anywhere' }}
          >
            {role.label}
          </Typography>
          <Box ref={scoreRef} sx={{ textAlign: 'right', flexShrink: 0, borderRadius: '8px', px: 0.5, mx: -0.5 }}>
            <Typography
              variant="h4"
              component="p"
              sx={(t) => ({
                whiteSpace: 'nowrap',
                fontSize: best ? '2.25rem' : '1.5rem',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                letterSpacing: '-0.03em',
                color: 'text.primary',
                ...(best && { ...gradientText(false), ...t.applyStyles('dark', gradientText(true)) }),
              })}
            >
              <CountUp value={role.probability} format={pct} />
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1, whiteSpace: 'nowrap' }}>
              {previous && changed ? (
                <Box component="span" className="sp-fade" sx={{ color: delta > 0 ? 'success.main' : 'error.main', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {points(delta)}
                </Box>
              ) : (
                'match'
              )}
            </Typography>
          </Box>
        </Stack>
        <MatchBar probability={role.probability} best={best} />
        {role.low_confidence && (
          <Tooltip
            arrow
            title="The model correctly identifies fewer than 1 in 10 people who actually hold this role, because the survey has few of them. Treat it as a weaker suggestion."
          >
            <Chip icon={<WarningAmber />} label="Low confidence" color="warning" size="small" variant="outlined" tabIndex={0} sx={{ mt: 1.5 }} />
          </Tooltip>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {role.description}
        </Typography>
      </Box>

      {collapsible && (
        <Button
          size="small"
          color="inherit"
          fullWidth
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={detailsId}
          endIcon={<ExpandMore sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: `transform ${DURATION.medium}ms ${EASE.inOut}` }} />}
          className="no-print"
          sx={{ mt: 1.75, justifyContent: 'space-between', color: 'text.secondary', bgcolor: (t) => alpha(t.palette.text.primary, 0.04) }}
        >
          {open ? 'Hide details' : 'AI outlook, pay and skills to grow'}
        </Button>
      )}
      {/* on a phone the runners-up fold their details away (always printed); otherwise they are always shown */}
      <Collapse in={!collapsible || open} id={detailsId} className="sp-details" timeout={collapsible ? undefined : 0}>
        <Box
          sx={{
            display: 'grid',
            rowGap: 2.25,
            mt: 2.25,
            // each section opens with a hairline instead of a separate divider element
            '& > *': { pt: 2.25, borderTop: 1, borderColor: 'divider', minWidth: 0 },
            // a wide card (the best match on a tablet) puts AI outlook and pay side by side
            '@container (min-width: 600px)': {
              gridTemplateColumns: '1fr 1fr',
              columnGap: 4,
              '& > :last-child': { gridColumn: '1 / -1' },
            },
          }}
        >
          <InsightSection icon={<SmartToy fontSize="small" color="primary" />} title="AI outlook for this role" help={AI_HELP}>
            <Metric label="Tasks done with AI today" value={ai.exposure_now} average={ai.all_roles.exposure_now} />
            <Metric label="Expected, with planned AI use" value={ai.exposure_expected} average={ai.all_roles.exposure_expected} />
            <Metric label="Feel AI threatens their job" value={ai.threat_yes_pct} average={ai.all_roles.threat_yes_pct} unit="%" />
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.25 }}>
              <AverageTick inline /> all roles · based on {ai.n.toLocaleString()} people
              {ai.level === 'role family' ? ' in this role family' : ''}
            </Typography>
          </InsightSection>

          <InsightSection icon={<Payments fontSize="small" color="primary" />} title="Typical pay" help={SALARY_HELP}>
            {s.available && s.median != null && s.p25 != null && s.p75 != null ? (
              <>
                <Typography variant="h6" component="p" sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                  {money(s.median)}
                  <Typography component="span" variant="body2" color="text.secondary">
                    {' '}
                    median / year
                  </Typography>
                </Typography>
                <PayRange p25={s.p25} median={s.median} p75={s.p75} scale={payScale} />
                <Typography variant="caption" component="p" sx={{ mt: 1, fontVariantNumeric: 'tabular-nums' }}>
                  Middle half earn {money(s.p25)} – {money(s.p75)}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
                  {s.n} {s.peer_group}.
                </Typography>
                {!s.local && (
                  <Chip
                    icon={<Public />}
                    size="small"
                    variant="outlined"
                    label="Worldwide figure; local pay may differ"
                    sx={{ mt: 1, maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }}
                  />
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {s.reason}
              </Typography>
            )}
          </InsightSection>

          <InsightSection icon={<TrendingUp fontSize="small" color="primary" />} title="Skills to grow" help={SKILL_HELP}>
            <Typography variant="body2" ref={skillsRef} sx={{ borderRadius: '6px', mx: -0.5, px: 0.5 }}>
              You use{' '}
              <Box component="strong" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {gap.matched.length} of {gap.typical_count}
              </Box>{' '}
              technologies that set {role.label}s apart.
            </Typography>
            <KeySkillDots matched={gap.matched.length} total={gap.typical_count} />
            {gap.missing.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                You already use all of the most distinctive ones.
              </Typography>
            ) : (
              <Box sx={{ mt: 1.75 }}>
                {/* column heads for the compact rows below; each row also reads out in full */}
                <Stack direction="row" aria-hidden="true" sx={{ alignItems: 'center', gap: 1, pb: 0.25, color: 'text.secondary' }}>
                  <ColumnHead>Next to learn</ColumnHead>
                  <ColumnHead width={46}>In role</ColumnHead>
                  <ColumnHead width={42}>vs avg</ColumnHead>
                  <Box sx={{ width: 30, flexShrink: 0 }} className="no-print" />
                </Stack>
                <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', borderTop: 1, borderColor: 'divider' }}>
                  {gap.missing.map((m) => (
                    <Stack
                      key={m.technology}
                      component="li"
                      direction="row"
                      sx={{ alignItems: 'center', gap: 1, minHeight: 40, '& + &': { borderTop: 1, borderColor: 'divider' } }}
                    >
                      {/* the star sits outside the name, so a long name that is cut short does not cut it off too */}
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap title={m.technology}>
                          {m.technology}
                          <span className="sp-sr-only">
                            , used by {Math.round(m.share_pct)}% of people in this role, {m.lift.toFixed(1)} times the average
                          </span>
                        </Typography>
                        {m.wanted && (
                          <Tooltip title="Already on your “want to learn” list">
                            <Star color="secondary" sx={{ fontSize: '0.875rem', flexShrink: 0 }} titleAccess="on your want-to-learn list" />
                          </Tooltip>
                        )}
                      </Stack>
                      <Typography variant="body2" aria-hidden="true" sx={{ width: 46, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(m.share_pct)}%
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        aria-hidden="true"
                        sx={{ width: 42, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {m.lift.toFixed(1)}×
                      </Typography>
                      <Tooltip title={`What if I had used ${m.technology}? Re-run with it added.`}>
                        <Box component="span" className="no-print" sx={{ flexShrink: 0 }}>
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={busy}
                            onClick={() => onTrySkill(m)}
                            aria-label={`What if I add ${m.technology}`}
                            sx={{ width: 30, height: 30 }}
                          >
                            {busy && pendingTech === m.technology ? <CircularProgress size={16} /> : <AddCircleOutline fontSize="small" />}
                          </IconButton>
                        </Box>
                      </Tooltip>
                    </Stack>
                  ))}
                </Box>
              </Box>
            )}
          </InsightSection>
        </Box>
      </Collapse>
    </Paper>
  )
}
