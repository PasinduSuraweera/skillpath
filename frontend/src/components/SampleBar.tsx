import CheckCircle from '@mui/icons-material/CheckCircle'
import ChevronRight from '@mui/icons-material/ChevronRight'
import PhoneAndroid from '@mui/icons-material/PhoneAndroid'
import QueryStats from '@mui/icons-material/QueryStats'
import School from '@mui/icons-material/School'
import SwapHoriz from '@mui/icons-material/SwapHoriz'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { LayoutGroup, m, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import { DURATION, EASE, TRANSITION } from '../motion'
import { SAMPLES } from '../samples'
import type { Sample } from '../samples'
import { ELEVATION, RADIUS, surfaceFill } from '../theme'

/** A real <button> (ButtonBase) that Motion can animate. */
const MotionButtonBase = m.create(ButtonBase)

interface Props {
  onPick: (s: Sample) => void
  disabled: boolean
  /** the example the answers still match, if any */
  activeId: string | null
}

const ICONS: Record<string, typeof School> = { undergrad: School, data: QueryStats, mobile: PhoneAndroid, switcher: SwapHoriz }

/** Example profiles as cards: the summary is visible (it used to hide in a hover tooltip), one press fills every step. */
export default function SampleBar({ onPick, disabled, activeId }: Props) {
  // a fresh group each time the start page opens, so the highlight does not fly in from a past visit
  const group = useId()
  const reduce = useReducedMotion()
  return (
    <Box component="section" aria-labelledby="examples-title" className="no-print">
      <Typography id="examples-title" variant="overline" color="text.secondary" component="h2" sx={{ display: 'block' }}>
        Start from an example
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5 }}>
        Fills in every step; you can change any answer before getting results.
      </Typography>
      <LayoutGroup id={group}>
        <Box component={m.div} layoutRoot sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr' } }}>
          {SAMPLES.map((s) => {
            const active = s.id === activeId
            const Icon = ICONS[s.id] ?? School
            return (
              <MotionButtonBase
                key={s.id}
                onClick={() => onPick(s)}
                disabled={disabled}
                aria-pressed={active}
                // a clickable card: lifts under a mouse pointer (Motion ignores touch for hover), presses in
                // under a finger or the keyboard. With reduced motion, no lift; the press stays as feedback.
                whileHover={reduce || disabled ? undefined : { y: -2, transition: TRANSITION.small }}
                whileTap={disabled ? undefined : { scale: 0.98, transition: TRANSITION.press }}
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
                  ...surfaceFill(t, 'control'),
                  transition: [
                    `border-color ${DURATION.hover}ms ease`,
                    `background-color ${DURATION.hover}ms ease`,
                    `box-shadow ${DURATION.hover}ms ease`,
                  ].join(', '),
                  '&.Mui-disabled': { opacity: 0.6 },
                  '@media (hover: hover) and (pointer: fine)': {
                    '&:hover': {
                      borderColor: alpha(t.palette.text.primary, 0.22),
                      boxShadow: ELEVATION.raised,
                      ...t.applyStyles('dark', { boxShadow: `0 10px 24px -12px rgba(0, 0, 0, 0.7)` }),
                    },
                    '&:hover .sp-chevron': { transform: 'translateX(2px)', color: t.palette.text.primary },
                  },
                })}
              >
                {active && (
                  <Box
                    component={m.span}
                    layoutId="example-selected"
                    transition={{ layout: TRANSITION.move }}
                    aria-hidden="true"
                    sx={(t) => ({
                      position: 'absolute',
                      inset: '-1px',
                      zIndex: -1,
                      borderRadius: `${RADIUS.inset}px`,
                      border: `2px solid ${t.palette.primary.main}`,
                      bgcolor: alpha(t.palette.primary.main, 0.07),
                      pointerEvents: 'none',
                    })}
                  />
                )}
                <Box
                  aria-hidden="true"
                  sx={(t) => ({
                    flexShrink: 0,
                    width: 38,
                    height: 38,
                    borderRadius: '10px',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'primary.main',
                    bgcolor: alpha(t.palette.primary.main, active ? 0.16 : 0.09),
                    transition: `background-color ${DURATION.hover}ms ease`,
                  })}
                >
                  <Icon sx={{ fontSize: 20 }} />
                </Box>
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
