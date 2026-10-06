import Check from '@mui/icons-material/Check'
import Box from '@mui/material/Box'
import Step from '@mui/material/Step'
import StepButton from '@mui/material/StepButton'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { StepIconProps } from '@mui/material/StepIcon'
import type { Ref } from 'react'
import { DURATION } from '../motion'

const STEPS = ['About you', 'Technologies', 'AI usage', 'Results']
// on the narrowest phones (under 360 px) the full labels would run into each other
const SHORT = ['About', 'Tech', 'AI', 'Results']
const narrow = '@media (max-width: 359.95px)'
const RESULTS = 3

interface Props {
  step: number
  /** answered / total per question step (stepProgress in form.ts) */
  progress: { answered: number; total: number }[]
  resultsReady: boolean
  disabled: boolean
  onGo: (step: number) => void
  ref?: Ref<HTMLDivElement>
}

/** Step marker: solid when current, a check once the step has answers, a quiet ring otherwise. */
function StepDot({ active, completed, icon }: StepIconProps) {
  return (
    <Box
      aria-hidden="true"
      sx={(t) => ({
        width: 30,
        height: 30,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontSize: '0.8125rem',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        border: '1.5px solid',
        transition: [
          `background-color ${DURATION.hover}ms ease`,
          `border-color ${DURATION.hover}ms ease`,
          `color ${DURATION.hover}ms ease`,
          `box-shadow ${DURATION.medium}ms ease`,
        ].join(', '),
        ...(active
          ? {
              color: t.palette.primary.contrastText,
              bgcolor: t.palette.primary.main,
              borderColor: t.palette.primary.main,
              boxShadow: `0 0 0 4px ${alpha(t.palette.primary.main, 0.16)}`,
            }
          : completed
            ? { color: t.palette.primary.main, bgcolor: alpha(t.palette.primary.main, 0.12), borderColor: 'transparent' }
            : { color: t.palette.text.secondary, bgcolor: t.palette.background.paper, borderColor: t.palette.divider }),
      })}
    >
      {completed && !active ? <Check className="sp-pop" sx={{ fontSize: 17 }} /> : icon}
    </Box>
  )
}

/**
 * The wizard's steps, also the progress display: where you are, how many questions
 * each step has answered, and the results once there are some.
 */
export default function WizardSteps({ step, progress, resultsReady, disabled, onGo, ref }: Props) {
  return (
    <Stepper
      ref={ref}
      nonLinear
      activeStep={step}
      alternativeLabel
      className="no-print"
      sx={{
        scrollMarginTop: 76,
        '& .MuiStepConnector-root': { top: 15, left: 'calc(-50% + 22px)', right: 'calc(50% + 22px)' },
        '& .MuiStepLabel-label': { fontSize: { xs: '0.8125rem', sm: '0.875rem' }, mt: '8px !important' },
      }}
    >
      {STEPS.map((label, i) => {
        const p = progress[i]
        return (
          <Step key={label} completed={i < RESULTS ? p.answered > 0 : false}>
            <StepButton
              onClick={() => onGo(i)}
              disabled={disabled || (i === RESULTS && !resultsReady)}
              sx={{ py: 1 }}
              // the answered count sits under the label (StepButton hands it to its StepLabel); the Results step has none
              optional={
                p && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', textAlign: 'center', fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}
                  >
                    {p.answered} of {p.total}
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      {' '}
                      answered
                    </Box>
                  </Typography>
                )
              }
            >
              <StepLabel slots={{ stepIcon: StepDot }}>
                <Box component="span" sx={{ [narrow]: { display: 'none' } }}>
                  {label}
                </Box>
                <Box component="span" sx={{ display: 'none', [narrow]: { display: 'inline' } }}>
                  {SHORT[i]}
                </Box>
              </StepLabel>
            </StepButton>
          </Step>
        )
      })}
    </Stepper>
  )
}
