import CheckCircle from '@mui/icons-material/CheckCircle'
import ChevronRight from '@mui/icons-material/ChevronRight'
import PhoneAndroid from '@mui/icons-material/PhoneAndroid'
import QueryStats from '@mui/icons-material/QueryStats'
import School from '@mui/icons-material/School'
import SwapHoriz from '@mui/icons-material/SwapHoriz'
import Bolt from '@mui/icons-material/Bolt'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { LayoutGroup, m, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import { IconTile } from '../design/primitives'
import { FORCED_COLORS, HOVER, RADIUS, insetFill, ink, white } from '../design/tokens'
import type { Tone } from '../design/tokens'
import { DURATION, EASE, TRANSITION } from '../motion'
import { SAMPLES } from '../samples'
import type { Sample } from '../samples'

/** A real <button> (ButtonBase) that Motion can animate. */
const MotionButtonBase = m.create(ButtonBase)

interface Props {
  onPick: (s: Sample) => void
  disabled: boolean
  /** the example the answers still match, if any */
  activeId: string | null
}

const LOOK: Record<string, { icon: typeof School; tone: Tone }> = {
  undergrad: { icon: School, tone: 'indigo' },
  data: { icon: QueryStats, tone: 'violet' },
  mobile: { icon: PhoneAndroid, tone: 'cyan' },
  switcher: { icon: SwapHoriz, tone: 'amber' },
}

/** Example profiles: the summary is visible, and one press fills every step. */
export default function SampleBar({ onPick, disabled, activeId }: Props) {
  // a fresh group each time the start page opens, so the highlight does not fly in from a past visit
  const group = useId()
  const reduce = useReducedMotion()
  return (
    <Box component="section" aria-labelledby="examples-title" className="no-print">
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, mb: 1.75, px: 0.5 }}>
        <IconTile tone="violet" size={32}>
          <Bolt />
        </IconTile>
        <Box sx={{ minWidth: 0 }}>
          <Typography id="examples-title" variant="h5" component="h2">
            Start from an example
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p">
            Fills in every step; you can change any answer before getting results.
          </Typography>
        </Box>
      </Stack>
      <LayoutGroup id={group}>
        <Box component={m.div} layoutRoot sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr' } }}>
          {SAMPLES.map((s) => {
            const active = s.id === activeId
            const { icon: Icon, tone } = LOOK[s.id] ?? { icon: School, tone: 'indigo' as const }
            return (
              <MotionButtonBase
                key={s.id}
                onClick={() => onPick(s)}
                disabled={disabled}
                aria-pressed={active}
                // lifts under a mouse pointer (Motion ignores touch for hover), presses in under a finger
                // or the keyboard. With reduced motion, no lift; the press stays as feedback.
                whileHover={reduce || disabled ? undefined : { y: -2, transition: TRANSITION.small }}
                whileTap={disabled ? undefined : { scale: 0.985, transition: TRANSITION.press }}
                sx={(t) => ({
                  position: 'relative',
                  isolation: 'isolate', // the highlight sits between the card's fill and its content
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.25,
                  pr: 1,
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  borderRadius: `${RADIUS.inset}px`,
                  border: '1px solid',
                  borderColor: 'divider',
                  ...insetFill(t, 'raised'),
                  transition: [`border-color ${DURATION.hover}ms ease`, `background-color ${DURATION.hover}ms ease`, `box-shadow ${DURATION.hover}ms ease`].join(', '),
                  '&.Mui-disabled': { opacity: 0.6 },
                  [HOVER]: {
                    '&:hover': {
                      borderColor: ink(0.16),
                      bgcolor: white(0.92),
                      boxShadow: `0 12px 28px -14px ${alpha('#312e81', 0.35)}`,
                      ...t.applyStyles('dark', { borderColor: white(0.18), bgcolor: white(0.09), boxShadow: '0 12px 28px -14px rgba(0, 0, 0, 0.8)' }),
                    },
                    '&:hover .sp-chevron': { transform: 'translateX(3px)', color: t.palette.text.primary },
                  },
                  [FORCED_COLORS]: active ? { border: '2px solid Highlight' } : {},
                })}
              >
                {active && (
                  <Box
                    component={m.span}
                    layoutId="example-selected"
                    transition={{ layout: TRANSITION.spring }}
                    aria-hidden="true"
                    sx={(t) => ({
                      position: 'absolute',
                      inset: '-1px',
                      zIndex: -1,
                      borderRadius: `${RADIUS.inset}px`,
                      border: `1.5px solid ${t.palette.primary.main}`,
                      bgcolor: alpha(t.palette.primary.main, 0.07),
                      boxShadow: `0 0 0 4px ${alpha(t.palette.primary.main, 0.1)}`,
                      pointerEvents: 'none',
                    })}
                  />
                )}
                <IconTile tone={tone} size={40} glow={active}>
                  <Icon />
                </IconTile>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="subtitle2" component="span" sx={{ display: 'block', lineHeight: 1.35 }}>
                    {s.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="span"
                    sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                  >
                    {s.summary}
                  </Typography>
                </Box>
                <Box aria-hidden="true" sx={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 24, color: 'text.secondary' }}>
                  {active ? (
                    <CheckCircle className="sp-pop" color="primary" sx={{ fontSize: 22 }} />
                  ) : (
                    <ChevronRight className="sp-chevron" sx={{ fontSize: 20, transition: `transform ${DURATION.hover}ms ${EASE.out}, color ${DURATION.hover}ms ease` }} />
                  )}
                </Box>
              </MotionButtonBase>
            )
          })}
        </Box>
      </LayoutGroup>
    </Box>
  )
}
