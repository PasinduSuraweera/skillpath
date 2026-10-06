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
import { DURATION, EASE } from '../motion'
import { SAMPLES } from '../samples'
import type { Sample } from '../samples'
import { RADIUS } from '../theme'

interface Props {
  onPick: (s: Sample) => void
  disabled: boolean
  /** the example the answers still match, if any */
  activeId: string | null
}

const ICONS: Record<string, typeof School> = { undergrad: School, data: QueryStats, mobile: PhoneAndroid, switcher: SwapHoriz }

/** Example profiles as cards: the summary is visible (it used to hide in a hover tooltip), one press fills every step. */
export default function SampleBar({ onPick, disabled, activeId }: Props) {
  return (
    <Box component="section" aria-labelledby="examples-title" className="no-print">
      <Typography id="examples-title" variant="overline" color="text.secondary" component="h2" sx={{ display: 'block' }}>
        Start from an example
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5 }}>
        Fills in every step; you can change any answer before getting results.
      </Typography>
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr' } }}>
        {SAMPLES.map((s) => {
          const active = s.id === activeId
          const Icon = ICONS[s.id] ?? School
          return (
            <ButtonBase
              key={s.id}
              onClick={() => onPick(s)}
              disabled={disabled}
              aria-pressed={active}
              sx={(t) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.25,
                pr: 1,
                textAlign: 'left',
                justifyContent: 'flex-start',
                borderRadius: `${RADIUS.inset}px`,
                border: '1px solid',
                borderColor: active ? 'primary.main' : 'divider',
                bgcolor: active ? alpha(t.palette.primary.main, 0.07) : 'background.paper',
                boxShadow: active ? `0 0 0 1px ${t.palette.primary.main}` : 'none',
                transition: [
                  `border-color ${DURATION.hover}ms ease`,
                  `background-color ${DURATION.hover}ms ease`,
                  `box-shadow ${DURATION.hover}ms ease`,
                  `transform ${DURATION.press}ms ${EASE.out}`,
                ].join(', '),
                '&:active': { transform: 'scale(0.98)' },
                '&.Mui-disabled': { opacity: 0.6 },
                '@media (hover: hover) and (pointer: fine)': {
                  '&:hover': { borderColor: active ? 'primary.main' : alpha(t.palette.text.primary, 0.22) },
                  '&:hover .sp-chevron': { transform: 'translateX(2px)', color: t.palette.text.primary },
                },
              })}
            >
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
            </ButtonBase>
          )
        })}
      </Box>
    </Box>
  )
}
