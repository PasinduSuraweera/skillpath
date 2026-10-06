import AddCircleOutline from '@mui/icons-material/AddCircleOutlineOutlined'
import Payments from '@mui/icons-material/Payments'
import Public from '@mui/icons-material/Public'
import SmartToy from '@mui/icons-material/SmartToy'
import Star from '@mui/icons-material/Star'
import TrendingUp from '@mui/icons-material/TrendingUp'
import WarningAmber from '@mui/icons-material/WarningAmber'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { RoleRecommendation, SkillSuggestion } from '../api/types'
import { money, pct } from '../format'
import { useCountUp } from '../motion'
import CountUp from './CountUp'
import { InsightSection, Metric } from './InsightSection'

interface Props {
  role: RoleRecommendation
  busy: boolean
  /** technology whose what-if re-run is in progress */
  pendingTech: string | null
  onTrySkill: (s: SkillSuggestion) => void
}

const AI_HELP =
  'AI Exposure Index (0-100): the share of 13 everyday development tasks (writing code, testing, documentation …) ' +
  'that people in this role do mostly or partly with AI. “Expected” also counts tasks they plan to use AI for. ' +
  'From 2025 survey respondents in the training data.'

const SALARY_HELP =
  'Annual pay in US dollars reported by survey respondents with the same role and experience level, as close to ' +
  'your location as the data allows (at least 30 people). Middle half = 25th to 75th percentile.'

const SKILL_HELP =
  'Technologies used by many people in this role and noticeably more often than across all roles, from the ' +
  'training data. Press + to see how your results change if you add one.'

/** The match bar fills in step with the percentage counting up (both are driven by useCountUp). */
function MatchBar({ probability, best }: { probability: number; best: boolean }) {
  const { value } = useCountUp(probability)
  return (
    <LinearProgress
      variant="determinate"
      value={value * 100}
      aria-label={`Match ${pct(probability)}`}
      aria-valuenow={Math.round(probability * 100)}
      sx={{ height: 8, mt: 1.5, '& .MuiLinearProgress-bar': { opacity: best ? 1 : 0.6, transition: 'none' } }}
    />
  )
}

export default function RoleCard({ role, busy, pendingTech, onTrySkill }: Props) {
  const ai = role.ai_outlook
  const s = role.salary
  const gap = role.skill_gap
  const best = role.rank === 1

  return (
    <Paper
      component="article"
      aria-label={`#${role.rank} ${role.label}`}
      sx={(t) => ({
        p: { xs: 2, sm: 2.5 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        // the best match carries a quiet primary tint so the ranking reads at a glance
        ...(best && {
          borderColor: alpha(t.palette.primary.main, 0.35),
          backgroundImage: `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.06)}, transparent 140px)`,
        }),
      })}
      className="avoid-break"
    >
      <Box>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color={best ? 'primary' : 'text.secondary'} sx={{ lineHeight: 1.4, display: 'block' }}>
              {best ? 'Best match' : `#${role.rank}`} · {role.family}
            </Typography>
            <Typography variant="h6" sx={{ lineHeight: 1.3, mt: 0.25 }}>
              {role.label}
            </Typography>
          </Box>
          <Typography
            variant="h4"
            component="p"
            color={best ? 'primary' : 'text.primary'}
            sx={{ whiteSpace: 'nowrap', fontSize: '1.75rem', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}
          >
            <CountUp value={role.probability} format={pct} />
          </Typography>
        </Stack>
        <MatchBar probability={role.probability} best={best} />
        {role.low_confidence && (
          <Tooltip
            arrow
            title="The model correctly identifies fewer than 1 in 10 people who actually hold this role, because the survey has few of them. Treat it as a weaker suggestion."
          >
            <Chip
              icon={<WarningAmber />}
              label="Low confidence"
              color="warning"
              size="small"
              variant="outlined"
              tabIndex={0}
              sx={{ mt: 1.5 }}
            />
          </Tooltip>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {role.description}
        </Typography>
      </Box>

      <Divider />
      <InsightSection icon={<SmartToy fontSize="small" color="primary" />} title="AI outlook for this role" help={AI_HELP}>
        <Metric label="Tasks done with AI today" value={ai.exposure_now} average={ai.all_roles.exposure_now} />
        <Metric label="Expected, with planned AI use" value={ai.exposure_expected} average={ai.all_roles.exposure_expected} />
        <Metric label="Feel AI threatens their job" value={ai.threat_yes_pct} average={ai.all_roles.threat_yes_pct} unit="%" />
        <Typography variant="caption" color="text.secondary">
          Based on {ai.n.toLocaleString()} people{ai.level === 'role family' ? ' in this role family' : ''}.
        </Typography>
      </InsightSection>

      <Divider />
      <InsightSection icon={<Payments fontSize="small" color="primary" />} title="Typical pay" help={SALARY_HELP}>
        {s.available ? (
          <>
            <Typography variant="h6" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {money(s.median)}
              <Typography component="span" variant="body2" color="text.secondary">
                {' '}
                median / year
              </Typography>
            </Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              Middle half earn {money(s.p25)} – {money(s.p75)}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
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

      <Divider />
      <InsightSection icon={<TrendingUp fontSize="small" color="primary" />} title="Skills to grow" help={SKILL_HELP}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          You use {gap.matched.length} of the {gap.typical_count} technologies that set {role.label}s apart.
        </Typography>
        {gap.missing.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            You already use all of the most distinctive ones.
          </Typography>
        ) : (
          <Stack spacing={0.25} component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {gap.missing.map((m) => (
              <Stack
                key={m.technology}
                component="li"
                direction="row"
                sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, py: 0.5 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap title={m.technology}>
                    {m.technology}
                    {m.wanted && (
                      <Tooltip title="Already on your “want to learn” list">
                        <Star
                          fontSize="inherit"
                          color="secondary"
                          sx={{ ml: 0.5, verticalAlign: 'middle' }}
                          titleAccess="on your want-to-learn list"
                        />
                      </Tooltip>
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    used by {Math.round(m.share_pct)}% in this role · {m.lift.toFixed(1)}× the average
                  </Typography>
                </Box>
                <Tooltip title={`What if I had used ${m.technology}? Re-run with it added.`}>
                  <span>
                    <IconButton
                      size="small"
                      color="primary"
                      disabled={busy}
                      onClick={() => onTrySkill(m)}
                      className="no-print"
                      aria-label={`What if I add ${m.technology}`}
                    >
                      {busy && pendingTech === m.technology ? (
                        <CircularProgress size={18} />
                      ) : (
                        <AddCircleOutline fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        )}
      </InsightSection>
    </Paper>
  )
}
