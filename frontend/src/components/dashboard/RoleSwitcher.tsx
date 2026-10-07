import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import WarningAmber from '@mui/icons-material/WarningAmber'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import { m, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import type { RoleRecommendation } from '../../api/types'
import { Meter, Pill } from '../../design/primitives'
import { panel } from '../../design/surfaces'
import { AURORA, FONT, FORCED_COLORS, HOVER, RADIUS, gradientRing, ink, shadow, white } from '../../design/tokens'
import { money, pct, points } from '../../format'
import { TRANSITION, revealMotion, useHighlight, useReveal } from '../../motion'
import CountUp from '../CountUp'

interface Props {
  roles: RoleRecommendation[]
  selected: string
  onSelect: (job: string) => void
  /** each role's place in the previous result, while a what-if comparison is shown */
  previous: (job: string) => { rank: number; probability: number } | null
  /** position of the first card in the results reveal */
  revealFrom: number
}

/**
 * The three matches side by side, with the figures that tell them apart at a glance (match,
 * pay, AI exposure). Choosing one focuses the detailed insights below on it; the selection
 * slides between the cards. Each card is an article with its own heading; a button stretched
 * over it does the choosing (a heading cannot live inside a button).
 */
export default function RoleSwitcher({ roles, selected, onSelect, previous, revealFrom }: Props) {
  const group = useId()
  return (
    <Box
      component="ol"
      aria-label="Your top three job roles"
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: { xs: 1.5, md: 2 }, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}
    >
      {roles.map((r, i) => (
        <RoleCard key={r.job_role} role={r} group={group} active={r.job_role === selected} onSelect={() => onSelect(r.job_role)} previous={previous(r.job_role)} i={revealFrom + i * 0.6} />
      ))}
    </Box>
  )
}

function RoleCard({
  role,
  group,
  active,
  onSelect,
  previous,
  i,
}: {
  role: RoleRecommendation
  group: string
  active: boolean
  onSelect: () => void
  previous: { rank: number; probability: number } | null
  i: number
}) {
  const theme = useTheme()
  const reveal = useReveal()
  const reduce = useReducedMotion()
  const titleId = useId()
  const best = role.rank === 1
  const s = role.salary
  // what the last what-if did to this role
  const delta = previous ? role.probability - previous.probability : 0
  const climb = previous ? previous.rank - role.rank : 0
  const changed = Math.abs(delta) >= 0.0005
  // a brief tint on the figure that a what-if just changed, so the eye finds it
  const scoreRef = useHighlight<HTMLDivElement>(Math.round(role.probability * 1000), alpha(theme.palette.primary.main, 0.16))

  return (
    <Box component="li" sx={{ minWidth: 0 }}>
      {/* the reveal, the reorder after a what-if and the hover lift are on the glass card itself:
          a fading wrapper would stop it blurring the page (SurfaceMotion) */}
      <Box
        component={m.article}
        layout="position"
        {...revealMotion(i, reveal)}
        transition={{ ...revealMotion(i, reveal).transition, layout: TRANSITION.move }}
        whileHover={reduce ? undefined : { y: -3, transition: TRANSITION.small }}
        aria-labelledby={titleId}
        className="avoid-break"
        sx={(t) => ({
          ...panel(t, { elevation: active ? 'mid' : 'low', radius: RADIUS.card }),
          position: 'relative',
          isolation: 'isolate',
          height: '100%',
          p: { xs: 2, sm: 2.25 },
          transition: 'box-shadow 220ms ease',
          [HOVER]: { '&:hover': shadow(t, 'mid') },
          // the stretched button is the focus target: ring the whole card around it
          '&:has(button:focus-visible)': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 3 },
          [FORCED_COLORS]: active ? { border: '2px solid Highlight' } : {},
        })}
      >
        {/* the chosen card: a gradient rim and a wash that slide here from the previous choice */}
        {active && (
          <Box
            component={m.span}
            layoutId={`${group}-role`}
            transition={{ layout: TRANSITION.spring }}
            aria-hidden="true"
            sx={(t) => ({
              position: 'absolute',
              inset: -1,
              zIndex: -1,
              borderRadius: `${RADIUS.card}px`,
              backgroundImage: `linear-gradient(160deg, ${alpha(AURORA[0], 0.12)}, ${alpha(AURORA[2], 0.05)} 70%)`,
              '&::before': gradientRing(`linear-gradient(140deg, ${AURORA[0]}, ${AURORA[1]} 50%, ${AURORA[2]})`),
              ...t.applyStyles('dark', { backgroundImage: `linear-gradient(160deg, ${alpha(AURORA[0], 0.2)}, ${alpha(AURORA[2], 0.08)} 70%)` }),
              '@media print': { display: 'none' },
            })}
          />
        )}
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, minHeight: 24 }}>
          <Box
            component="span"
            sx={(t) => ({
              fontFamily: FONT.mono,
              fontSize: '0.75rem',
              fontWeight: 700,
              px: 0.75,
              py: 0.125,
              borderRadius: '7px',
              flexShrink: 0,
              ...(best
                ? { color: '#fff', backgroundImage: `linear-gradient(135deg, ${AURORA[0]}, ${AURORA[1]})`, ...t.applyStyles('dark', { color: '#0b1020', backgroundImage: 'linear-gradient(135deg, #a5b4fc, #c4b5fd)' }) }
                : { color: 'text.secondary', bgcolor: ink(0.06), ...t.applyStyles('dark', { bgcolor: white(0.08) }) }),
              '@media print': { color: t.palette.text.primary, backgroundImage: 'none', border: `1px solid ${t.palette.divider}` },
            })}
          >
            #{role.rank}
          </Box>
          <Typography variant="overline" color="text.secondary" noWrap title={role.family} sx={{ lineHeight: 1.4, minWidth: 0 }}>
            {role.family}
          </Typography>
          {climb !== 0 && previous && (
            <Typography
              variant="caption"
              className="sp-fade"
              sx={{ ml: 'auto', flexShrink: 0, fontWeight: 650, whiteSpace: 'nowrap', color: climb > 0 ? 'success.main' : 'error.main', display: 'inline-flex', alignItems: 'center' }}
            >
              {climb > 0 ? <ArrowUpward sx={{ fontSize: 13 }} /> : <ArrowDownward sx={{ fontSize: 13 }} />}
              from #{previous.rank > 20 ? '20+' : previous.rank}
            </Typography>
          )}
        </Stack>

        <Typography variant="h4" component="h3" id={titleId} sx={{ mt: 1, fontSize: '1.1875rem', overflowWrap: 'anywhere', minHeight: { sm: '2.4em' } }}>
          {role.label}
        </Typography>

        <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1, mt: 1.25 }}>
          <Box ref={scoreRef} sx={{ borderRadius: '8px', px: 0.5, mx: -0.5 }}>
            <Typography component="p" sx={{ fontWeight: 720, fontSize: '2rem', letterSpacing: '-0.045em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              <CountUp value={role.probability} format={pct} />
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            match
          </Typography>
          {previous && changed && (
            <Typography variant="caption" className="sp-fade" sx={{ ml: 'auto', color: delta > 0 ? 'success.main' : 'error.main', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
              {points(delta)}
            </Typography>
          )}
        </Stack>
        <Box role="meter" aria-label={`Match ${pct(role.probability)}`} aria-valuenow={Math.round(role.probability * 100)} aria-valuemin={0} aria-valuemax={100} sx={{ mt: 1.25 }}>
          <Meter value={role.probability} tone={best ? 'brand' : 'indigo'} muted={!best} height={7} />
        </Box>

        {role.low_confidence && (
          <Pill tone="amber" icon={<WarningAmber />} sx={{ mt: 1.5 }}>
            Low confidence
          </Pill>
        )}

        {/* the figures that tell the roles apart */}
        <Box
          sx={{
            mt: 2,
            pt: 1.75,
            borderTop: 1,
            borderColor: 'divider',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" component="p">
              Median pay
            </Typography>
            <Typography variant="subtitle2" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {s.available && s.median != null ? money(s.median) : '–'}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" component="p">
              AI tasks today
            </Typography>
            <Typography variant="subtitle2" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(role.ai_outlook.exposure_now)} / 100
            </Typography>
          </Box>
        </Box>

        <ButtonBase
          onClick={onSelect}
          aria-pressed={active}
          aria-controls="role-insights"
          aria-label={`Show the insights for ${role.label}`}
          className="no-print"
          sx={{ position: 'absolute', inset: 0, borderRadius: `${RADIUS.card}px`, zIndex: 1, '&.Mui-focusVisible': { outline: 'none' } }}
        />
      </Box>
    </Box>
  )
}
