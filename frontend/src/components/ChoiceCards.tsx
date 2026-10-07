import CheckCircle from '@mui/icons-material/CheckCircle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormHelperText from '@mui/material/FormHelperText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { useId, useState } from 'react'
import { DURATION, EASE } from '../motion'
import { RADIUS, surfaceFill } from '../theme'

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
      <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1.25, mb: 1.25 }}>
        <Box
          aria-hidden="true"
          sx={(t) => ({
            flexShrink: 0,
            width: 24,
            height: 24,
            mt: '1px',
            borderRadius: '8px',
            display: 'grid',
            placeItems: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: value ? 'primary.contrastText' : 'text.secondary',
            bgcolor: value ? 'primary.main' : alpha(t.palette.text.primary, 0.06),
            transition: `background-color ${DURATION.hover}ms ease, color ${DURATION.hover}ms ease`,
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
            <Button
              size="small"
              color="inherit"
              onClick={() => choose('')}
              className="sp-fade"
              aria-label={`Clear the answer to “${question}”`}
              sx={{ color: 'text.secondary', minHeight: 28 }}
            >
              Clear
            </Button>
          )}
        </Box>
      </Stack>

      <Box
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
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                minHeight: 48,
                px: 1.75,
                py: 1.25,
                cursor: 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'manipulation',
                borderRadius: `${RADIUS.inset}px`,
                border: '1px solid',
                borderColor: checked ? 'primary.main' : 'divider',
                ...(checked ? { backgroundColor: alpha(t.palette.primary.main, 0.07) } : surfaceFill(t, 'control')),
                boxShadow: checked ? `0 0 0 1px ${t.palette.primary.main}` : 'none',
                transition: [
                  `border-color ${DURATION.hover}ms ease`,
                  `background-color ${DURATION.hover}ms ease`,
                  `box-shadow ${DURATION.hover}ms ease`,
                  `transform ${DURATION.press}ms ${EASE.out}`,
                ].join(', '),
                '&:active': { transform: 'scale(0.985)' },
                '@media (hover: hover) and (pointer: fine)': {
                  '&:hover': { borderColor: checked ? 'primary.main' : alpha(t.palette.text.primary, 0.24) },
                },
                // keyboard focus lands on the hidden radio: ring the card around it
                '&:has(input:focus-visible)': {
                  outline: `2px solid ${t.palette.primary.main}`,
                  outlineOffset: 2,
                },
              })}
            >
              <input
                type="radio"
                name={name}
                value={c}
                checked={checked}
                onChange={() => choose(c)}
                className="sp-sr-only"
              />
              {/* indicator: an empty ring, filled by a check that settles in when chosen */}
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
                  border: checked ? 'none' : `1.5px solid ${alpha(t.palette.text.primary, 0.45)}`,
                  color: 'primary.main',
                })}
              >
                {checked && (
                  <span className={touched ? 'sp-pop' : undefined} style={{ display: 'inline-flex' }}>
                    <CheckCircle sx={{ fontSize: 22 }} />
                  </span>
                )}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: checked ? 600 : 450, lineHeight: 1.35 }}>
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
