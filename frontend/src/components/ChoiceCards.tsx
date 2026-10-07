import Check from '@mui/icons-material/Check'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormHelperText from '@mui/material/FormHelperText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { m } from 'motion/react'
import { useId, useState } from 'react'
import { BRAND_GRADIENT, BRAND_GRADIENT_DARK, FORCED_COLORS, HOVER, RADIUS, insetFill, ink, white } from '../design/tokens'
import { DURATION, EASE, TRANSITION } from '../motion'

interface Props {
  /** the question, used as the group's legend */
  question: string
  /** position in the step, shown as "1", "2" … */
  number: number
  value: string // '' = not answered
  choices: string[] // ordered scale, as in the survey
  error?: string
  onChange: (value: string) => void
  /** narrowest card; short scale labels pack into one row, long answers get wider cards */
  minWidth?: number
}

/**
 * One survey question as a set of answer cards: every choice is visible at once
 * (no dropdown to open), and choosing is a single click or tap. Built on native
 * radio buttons, so arrow keys move between choices and screen readers announce
 * a radio group. All questions are optional, so an answer can be cleared again.
 */
export default function ChoiceCards({ question, number, value, choices, error, onChange, minWidth = 170 }: Props) {
  const name = useId()
  const legendId = `${name}-legend`
  // the check settles in when the visitor chooses, not every time the step opens
  const [touched, setTouched] = useState(false)
  const choose = (v: string) => {
    setTouched(true)
    onChange(v)
  }

  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1.25, mb: 1.5 }}>
        {/* question number: fills with the brand gradient once answered */}
        <Box
          aria-hidden="true"
          sx={(t) => ({
            flexShrink: 0,
            width: 26,
            height: 26,
            mt: '-1px',
            borderRadius: '9px',
            display: 'grid',
            placeItems: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            transition: `background-color ${DURATION.hover}ms ease, color ${DURATION.hover}ms ease, box-shadow ${DURATION.medium}ms ease`,
            ...(value
              ? {
                  color: '#fff',
                  backgroundImage: BRAND_GRADIENT,
                  boxShadow: `0 4px 12px -4px ${alpha('#6d28d9', 0.6)}`,
                  ...t.applyStyles('dark', { color: '#0b1020', backgroundImage: BRAND_GRADIENT_DARK }),
                }
              : { color: 'text.secondary', bgcolor: ink(0.06), ...t.applyStyles('dark', { bgcolor: white(0.08) }) }),
            [FORCED_COLORS]: { border: '1px solid CanvasText' },
          })}
        >
          {number}
        </Box>
        <Typography component="h3" id={legendId} variant="subtitle1" sx={{ flexGrow: 1, minWidth: 0 }}>
          {question}
        </Typography>
        {/* fixed-width slot, so the question text does not reflow when it appears */}
        <Box sx={{ flexShrink: 0, minWidth: 56, textAlign: 'right' }}>
          {value && (
            <Button size="small" color="inherit" onClick={() => choose('')} className="sp-fade" aria-label={`Clear the answer to “${question}”`} sx={{ color: 'text.secondary', minHeight: 28 }}>
              Clear
            </Button>
          )}
        </Box>
      </Stack>

      {/* layoutRoot: the highlight moves relative to this grid, so it never trails behind when
          content above the question changes height */}
      <Box
        component={m.div}
        layoutRoot
        role="radiogroup"
        aria-labelledby={legendId}
        aria-describedby={error ? `${name}-error` : undefined}
        aria-invalid={error ? true : undefined}
        sx={{
          display: 'grid',
          gap: 1,
          // on phones: short scale words two to a row when two fit, sentences one per row. Sizes are in rem,
          // so with larger text (browser setting) the cards also drop to fewer columns instead of overflowing.
          gridTemplateColumns: {
            xs: minWidth <= 160 ? 'repeat(auto-fit, minmax(min(100%, 8.5rem), 1fr))' : '1fr',
            sm: `repeat(auto-fit, minmax(min(100%, ${minWidth / 16}rem), 1fr))`,
          },
        }}
      >
        {choices.map((c) => {
          const checked = c === value
          return (
            <Box
              key={c}
              component="label"
              data-checked={checked || undefined}
              sx={(t) => ({
                position: 'relative',
                isolation: 'isolate', // the highlight sits between the card's fill and its content
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                minHeight: 52,
                px: 1.75,
                py: 1.25,
                cursor: 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'manipulation',
                borderRadius: `${RADIUS.inset}px`,
                border: '1px solid',
                borderColor: 'divider',
                ...insetFill(t, 'raised'),
                transition: [`border-color ${DURATION.hover}ms ease`, `background-color ${DURATION.hover}ms ease`, `transform ${DURATION.press}ms ${EASE.out}`].join(', '),
                '&:active': { transform: 'scale(0.985)' },
                [HOVER]: { '&:hover': { borderColor: ink(0.2), bgcolor: white(0.9), ...t.applyStyles('dark', { borderColor: white(0.2), bgcolor: white(0.08) }) } },
                // keyboard focus lands on the hidden radio: ring the card around it
                '&:has(input:focus-visible)': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
                [FORCED_COLORS]: checked ? { border: '2px solid Highlight' } : {},
              })}
            >
              <input type="radio" name={name} value={c} checked={checked} onChange={() => choose(c)} className="sp-sr-only" />
              {/* the selection: a ring, a tint and a soft glow that slide from the previous answer to the new one */}
              {checked && (
                <Box
                  component={m.span}
                  layoutId={`${name}-selected`}
                  transition={{ layout: TRANSITION.spring }}
                  aria-hidden="true"
                  sx={(t) => ({
                    position: 'absolute',
                    inset: '-1px',
                    zIndex: -1,
                    borderRadius: `${RADIUS.inset}px`,
                    border: `1.5px solid ${t.palette.primary.main}`,
                    backgroundImage: `linear-gradient(150deg, ${alpha(t.palette.primary.main, 0.12)}, ${alpha('#7c3aed', 0.05)})`,
                    bgcolor: white(0.75),
                    boxShadow: `0 0 0 4px ${alpha(t.palette.primary.main, 0.1)}, 0 10px 24px -12px ${alpha('#4f46e5', 0.5)}`,
                    pointerEvents: 'none',
                    ...t.applyStyles('dark', { bgcolor: white(0.04), boxShadow: `0 0 0 4px ${alpha(t.palette.primary.main, 0.12)}` }),
                  })}
                />
              )}
              {/* indicator: an empty ring, filled with the brand gradient and a check that settles in when chosen */}
              <Box
                aria-hidden="true"
                sx={(t) => ({
                  flexShrink: 0,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  // over 3:1 against the card, so the empty choice still reads as a control
                  border: checked ? 'none' : `1.5px solid ${alpha(t.palette.text.primary, 0.4)}`,
                  color: '#fff',
                  ...(checked && { backgroundImage: BRAND_GRADIENT, ...t.applyStyles('dark', { backgroundImage: BRAND_GRADIENT_DARK, color: '#0b1020' }) }),
                  [FORCED_COLORS]: { border: '1.5px solid CanvasText' },
                })}
              >
                {checked && (
                  <span className={touched ? 'sp-pop' : undefined} style={{ display: 'inline-flex' }}>
                    <Check sx={{ fontSize: 14 }} />
                  </span>
                )}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: checked ? 650 : 450, lineHeight: 1.35 }}>
                {c}
              </Typography>
            </Box>
          )
        })}
      </Box>
      {error && (
        <FormHelperText error id={`${name}-error`} className="sp-fade">
          {error}
        </FormHelperText>
      )}
    </Box>
  )
}
