import AddCircleOutline from '@mui/icons-material/AddCircleOutlineOutlined'
import Payments from '@mui/icons-material/Payments'
import Public from '@mui/icons-material/Public'
import SmartToy from '@mui/icons-material/SmartToy'
import Star from '@mui/icons-material/Star'
import TrendingUp from '@mui/icons-material/TrendingUp'
import WarningAmber from '@mui/icons-material/WarningAmber'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { RoleRecommendation, SkillSuggestion } from '../api/types'
import { money, pct } from '../format'
import { InsightSection, Metric } from './InsightSection'

interface Props {
  role: RoleRecommendation
  busy: boolean
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

export default function RoleCard({ role, busy, onTrySkill }: Props) {
  const ai = role.ai_outlook
  const s = role.salary
  const gap = role.skill_gap

  return (
    <Paper sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }} className="avoid-break">
      <Box>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
              #{role.rank} · {role.family}
            </Typography>
            <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
              {role.label}
            </Typography>
          </Box>
          <Typography variant="h5" color="primary" sx={{ whiteSpace: 'nowrap' }}>
            {pct(role.probability)}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={role.probability * 100}
          sx={{ height: 8, borderRadius: 4, mt: 1 }}
          aria-label={`Match ${pct(role.probability)}`}
        />
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
            <Typography variant="h6" component="p">
              {money(s.median)}
              <Typography component="span" variant="body2" color="text.secondary">
                {' '}
                median / year
              </Typography>
            </Typography>
            <Typography variant="body2">
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
                sx={{ mt: 1, maxWidth: '100%' }}
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
          <Stack spacing={0.5}>
            {gap.missing.map((m) => (
              <Stack key={m.technology} direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap title={m.technology}>
                    {m.technology}
                    {m.wanted && (
                      <Tooltip title="Already on your “want to learn” list">
                        <Star fontSize="inherit" color="secondary" sx={{ ml: 0.5, verticalAlign: 'middle' }} />
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
                      <AddCircleOutline fontSize="small" />
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
