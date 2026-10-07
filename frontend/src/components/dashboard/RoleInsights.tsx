import Add from '@mui/icons-material/Add'
import Check from '@mui/icons-material/Check'
import Payments from '@mui/icons-material/PaymentsOutlined'
import Public from '@mui/icons-material/Public'
import SmartToy from '@mui/icons-material/SmartToyOutlined'
import Star from '@mui/icons-material/Star'
import TrendingUp from '@mui/icons-material/TrendingUp'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import { AnimatePresence, m } from 'motion/react'
import type { ReactNode } from 'react'
import type { RoleRecommendation, SkillSuggestion } from '../../api/types'
import { AverageTick, Eyebrow, Meter, Pill, RingGauge, Tile } from '../../design/primitives'
import type { SurfaceMotion } from '../../design/primitives'
import { FORCED_COLORS, RADIUS, TONES, ink, insetFill, toneColor, white } from '../../design/tokens'
import { money } from '../../format'
import { TRANSITION, useHighlight } from '../../motion'
import { TECH_AREAS } from '../../questions'

interface Props {
  role: RoleRecommendation
  busy: boolean
  /** technology whose what-if re-run is in progress */
  pendingTech: string | null
  /** highest pay figure (75th percentile) across the three roles, so their pay bands share one scale */
  payScale: number
  onTrySkill: (s: SkillSuggestion) => void
  /** print copies of the insights for the roles not on screen: no actions */
  printCopy?: boolean
  /** each tile's entrance, by position (see SurfaceMotion) */
  motion?: (i: number) => SurfaceMotion
}

export const AI_HELP =
  'AI Exposure Index (0-100): the share of 13 everyday development tasks (writing code, testing, documentation …) ' +
  'that people in this role do mostly or partly with AI. “Expected” also counts tasks they plan to use AI for. ' +
  'The marker on each bar is the figure across all roles. From 2025 survey respondents in the training data.'

export const SALARY_HELP =
  'Annual pay in US dollars reported by survey respondents with the same role and experience level, as close to ' +
  'your location as the data allows (at least 30 people). The bar shows the middle half (25th to 75th percentile) ' +
  'with the median marked, on the same scale for all three roles.'

export const SKILL_HELP =
  'Technologies used by many people in this role and noticeably more often than across all roles, from the ' +
  'training data. “In role” is the share of people in the role who use it; “vs avg” is how many times more often ' +
  'than across all roles. “What if?” shows how your results change if you add one.'

/**
 * A 0-100 figure with a bar that carries a marker at the all-roles value: the comparison
 * reads from the bar instead of a sentence under every figure. Screen readers get it in words.
 */
function Metric({ label, value, average, unit = '', delay }: { label: string; value: number; average: number; unit?: string; delay: number }) {
  const diff = value - average
  const compare = Math.abs(diff) < 2 ? 'about average' : diff > 0 ? 'above average' : 'below average'
  return (
    <Box sx={{ '& + &': { mt: 1.75 } }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1, mb: 0.875 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {Math.round(value)}
          {unit}
          <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 400, ml: 0.75 }}>
            avg {Math.round(average)}
            {unit}
          </Typography>
          <span className="sp-sr-only">, {compare}</span>
        </Typography>
      </Stack>
      <Meter value={value / 100} average={average / 100} tone="violet" delay={delay} />
    </Box>
  )
}

/** Middle half of the pay (25th-75th percentile) as a band with the median marked, on a scale shared by the roles. */
function PayRange({ p25, median, p75, scale }: { p25: number; median: number; p75: number; scale: number }) {
  const at = (v: number) => Math.min(100, (v / scale) * 100)
  return (
    <Box aria-hidden="true" className="sp-track" sx={(t) => ({ position: 'relative', height: 10, borderRadius: 999, bgcolor: ink(0.07), ...t.applyStyles('dark', { bgcolor: white(0.08) }) })}>
      <Box
        className="sp-bar"
        sx={(t) => ({
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${at(p25)}%`,
          width: `max(8px, ${at(p75) - at(p25)}%)`,
          borderRadius: 999,
          backgroundImage: `linear-gradient(90deg, ${alpha(TONES.emerald.light, 0.35)}, ${alpha(TONES.emerald.light, 0.6)})`,
          ...t.applyStyles('dark', { backgroundImage: `linear-gradient(90deg, ${alpha(TONES.emerald.dark, 0.3)}, ${alpha(TONES.emerald.dark, 0.6)})` }),
          transition: 'left 420ms cubic-bezier(0.77, 0, 0.175, 1), width 420ms cubic-bezier(0.77, 0, 0.175, 1)',
        })}
      />
      <Box
        sx={(t) => ({
          position: 'absolute',
          top: -4,
          left: `calc(${at(median)}% - 2px)`,
          width: 4,
          height: 18,
          borderRadius: 2,
          bgcolor: toneColor(t, 'emerald'),
          boxShadow: `0 0 0 2px ${white(0.9)}`,
          ...t.applyStyles('dark', { boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.5)' }),
          transition: 'left 420ms cubic-bezier(0.77, 0, 0.175, 1)',
          [FORCED_COLORS]: { bgcolor: 'CanvasText' },
        })}
      />
    </Box>
  )
}

/**
 * A tile's content changing over to another role. The glass stays where it is and only the
 * content inside crossfades, so the surfaces never lose their blur (see SurfaceMotion).
 */
function Swap({ k, children }: { k: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={k}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0, transition: TRANSITION.medium }}
        exit={{ opacity: 0, y: -4, transition: TRANSITION.small }}
        style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  )
}

/**
 * How many of the role's distinctive technologies the visitor uses. Its own component, keyed
 * by role (inside Swap): a what-if that adds a skill tints the figure, switching roles does not.
 */
function Readiness({ role }: { role: RoleRecommendation }) {
  const theme = useTheme()
  const gap = role.skill_gap
  const ref = useHighlight<HTMLParagraphElement>(gap.matched.length, alpha(theme.palette.primary.main, 0.16))
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 2 }}>
      <RingGauge value={gap.typical_count ? gap.matched.length / gap.typical_count : 0} size={92} thickness={9} glow={false} tone="indigo">
        <Typography component="span" sx={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
          {gap.matched.length}
          <Box component="span" sx={{ fontSize: '0.8125rem', color: 'text.secondary', fontWeight: 600 }}>
            /{gap.typical_count}
          </Box>
        </Typography>
      </RingGauge>
      <Typography variant="body2" ref={ref} sx={{ borderRadius: '6px', mx: -0.5, px: 0.5 }}>
        You use{' '}
        <Box component="strong" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {gap.matched.length} of {gap.typical_count}
        </Box>{' '}
        technologies that set {role.label}s apart.
      </Typography>
    </Stack>
  )
}

/**
 * Everything SkillPath knows about one of the matches: its AI outlook, what people in it are
 * paid, and the skill map (the role's distinctive technologies the visitor uses, and the ones
 * to learn next, each one tap from a what-if).
 */
export default function RoleInsights({ role, busy, pendingTech, payScale, onTrySkill, printCopy, motion }: Props) {
  const ai = role.ai_outlook
  const s = role.salary
  const gap = role.skill_gap
  const k = role.job_role
  // the tiles sit under the insights' own heading (Dashboard)
  const heading = 'h4'

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Tile icon={<SmartToy />} tone="violet" title="AI outlook for this role" help={AI_HELP} headingLevel={heading} className="avoid-break" motion={motion?.(0)}>
          <Swap k={k}>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'flex-end' }, gap: { xs: 0.75, sm: 1.5 }, mb: 2.5 }}>
            <Typography component="p" sx={{ fontWeight: 720, fontSize: '2.75rem', letterSpacing: '-0.05em', lineHeight: 0.95, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {Math.round(ai.exposure_now)}
              <Box component="span" sx={{ fontSize: '1rem', fontWeight: 600, color: 'text.secondary', letterSpacing: 0, ml: 0.5 }}>
                / 100
              </Box>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pb: 0.25 }}>
              of everyday tasks are done with AI by people in this role today.
            </Typography>
          </Stack>
          <Metric label="Tasks done with AI today" value={ai.exposure_now} average={ai.all_roles.exposure_now} delay={0.1} />
          <Metric label="Expected, with planned AI use" value={ai.exposure_expected} average={ai.all_roles.exposure_expected} delay={0.16} />
          <Metric label="Feel AI threatens their job" value={ai.threat_yes_pct} average={ai.all_roles.threat_yes_pct} unit="%" delay={0.22} />
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 'auto', pt: 2 }}>
            <AverageTick /> all roles · based on {ai.n.toLocaleString()} people
            {ai.level === 'role family' ? ' in this role family' : ''}
          </Typography>
          </Swap>
        </Tile>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Tile icon={<Payments />} tone="emerald" title="Typical pay" help={SALARY_HELP} headingLevel={heading} className="avoid-break" motion={motion?.(1)}>
          <Swap k={k}>
          {s.available && s.median != null && s.p25 != null && s.p75 != null ? (
            <>
              <Typography component="p" sx={{ fontWeight: 720, fontSize: '2.75rem', letterSpacing: '-0.05em', lineHeight: 0.95, fontVariantNumeric: 'tabular-nums' }}>
                {money(s.median)}
                <Typography component="span" variant="body2" color="text.secondary" sx={{ letterSpacing: 0, ml: 0.75 }}>
                  median / year
                </Typography>
              </Typography>
              <Box sx={{ mt: 3, mb: 1.25 }}>
                <PayRange p25={s.p25} median={s.median} p75={s.p75} scale={payScale} />
              </Box>
              <Stack direction="row" sx={{ justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
                <Typography variant="caption" color="text.secondary">
                  25th · {money(s.p25)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  75th · {money(s.p75)}
                </Typography>
              </Stack>
              <Typography variant="body2" component="p" sx={{ mt: 2, fontVariantNumeric: 'tabular-nums' }}>
                Middle half earn {money(s.p25)} – {money(s.p75)}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
                {s.n} {s.peer_group}.
              </Typography>
              {!s.local && (
                <Pill tone="neutral" icon={<Public />} sx={{ mt: 1.5, whiteSpace: 'normal', alignSelf: 'flex-start' }}>
                  Worldwide figure; local pay may differ
                </Pill>
              )}
            </>
          ) : (
            <Box sx={(t) => ({ ...insetFill(t), borderRadius: `${RADIUS.inset}px`, p: 2, border: `1px dashed ${t.palette.divider}` })}>
              <Typography variant="body2" color="text.secondary">
                {s.reason}
              </Typography>
            </Box>
          )}
          </Swap>
        </Tile>
      </Grid>

      <Grid size={12}>
        <Tile icon={<TrendingUp />} tone="indigo" title="Skills to grow" help={SKILL_HELP} headingLevel={heading} className="avoid-break" motion={motion?.(2)}>
          <Swap k={k}>
          <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 }, gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 0.8fr) minmax(0, 1.6fr)' } }}>
            {/* readiness, and the role's technologies already in the visitor's toolkit */}
            <Box sx={{ minWidth: 0 }}>
              <Readiness role={role} />
              <Eyebrow tone="emerald" sx={{ mt: 2.5, mb: 1 }}>
                Already in your toolkit
              </Eyebrow>
              {gap.matched.length ? (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                  {gap.matched.map((tech) => (
                    <Pill key={tech} tone="emerald" icon={<Check />} sx={{ whiteSpace: 'normal' }}>
                      {tech}
                    </Pill>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  None yet: every technology on the right would be a first step.
                </Typography>
              )}
            </Box>

            {/* what to learn next, most distinctive first */}
            <Box sx={{ minWidth: 0 }}>
              <Eyebrow tone="indigo" sx={{ mb: 1 }}>
                Next to learn
              </Eyebrow>
              {gap.missing.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  You already use all of the most distinctive ones.
                </Typography>
              ) : (
                <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1 }}>
                  {gap.missing.map((sk) => (
                    <Box
                      key={sk.technology}
                      component="li"
                      sx={(t) => ({
                        ...insetFill(t, 'raised'),
                        borderRadius: `${RADIUS.inset}px`,
                        border: `1px solid ${t.palette.divider}`,
                        p: 1.25,
                        pl: 1.75,
                        display: 'grid',
                        gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: 'minmax(0, 1.2fr) minmax(0, 1fr) auto' },
                        alignItems: 'center',
                        columnGap: 2,
                        rowGap: 1,
                      })}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                          {/* the star sits outside the name, so a long name that is cut short does not cut it off too */}
                          <Typography variant="subtitle2" component="p" noWrap title={sk.technology} sx={{ minWidth: 0 }}>
                            {sk.technology}
                            <span className="sp-sr-only">
                              , used by {Math.round(sk.share_pct)}% of people in this role, {sk.lift.toFixed(1)} times the average
                            </span>
                          </Typography>
                          {sk.wanted && (
                            <Tooltip title="Already on your “want to learn” list">
                              <Star color="secondary" sx={{ fontSize: '0.9375rem', flexShrink: 0 }} titleAccess="on your want-to-learn list" />
                            </Tooltip>
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" component="p" noWrap>
                          {TECH_AREAS[sk.area].title}
                        </Typography>
                      </Box>
                      {/* share of the role that uses it, and how distinctive that is */}
                      <Box aria-hidden="true" sx={{ minWidth: 0, gridColumn: { xs: '1 / -1', sm: 'auto' }, gridRow: { xs: 2, sm: 'auto' } }}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round(sk.share_pct)}% in role
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {sk.lift.toFixed(1)}× vs avg
                          </Typography>
                        </Stack>
                        <Meter value={sk.share_pct / 100} tone="indigo" height={5} />
                      </Box>
                      {!printCopy && (
                        <Tooltip describeChild title={`Re-run with ${sk.technology} added and compare`}>
                          <Box component="span" className="no-print" sx={{ flexShrink: 0 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={busy}
                              onClick={() => onTrySkill(sk)}
                              aria-label={`What if I add ${sk.technology}`}
                              startIcon={busy && pendingTech === sk.technology ? <CircularProgress size={14} /> : <Add />}
                              sx={{ whiteSpace: 'nowrap' }}
                            >
                              What if?
                            </Button>
                          </Box>
                        </Tooltip>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
          </Swap>
        </Tile>
      </Grid>
    </Grid>
  )
}

