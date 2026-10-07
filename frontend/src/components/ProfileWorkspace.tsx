import ArrowBack from '@mui/icons-material/ArrowBack'
import ArrowForward from '@mui/icons-material/ArrowForward'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import RestartAlt from '@mui/icons-material/RestartAlt'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import { AnimatePresence, m, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import type { Dispatch, Ref, SetStateAction } from 'react'
import type { Options } from '../api/types'
import { Eyebrow } from '../design/primitives'
import { panel } from '../design/surfaces'
import { RADIUS, glass } from '../design/tokens'
import type { Errors, FormState } from '../form'
import { makeRoom, useScrollFx } from '../motion'
import AIStep from './AIStep'
import AboutStep from './AboutStep'
import Analyzing from './Analyzing'
import ProfileRail from './ProfileRail'
import StepPane from './StepPane'
import type { Direction } from './StepPane'
import TechStep from './TechStep'
import { STEPS } from '../steps'

interface Props {
  step: number
  direction: Direction
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
  options: Options
  errors: Errors
  progress: { answered: number; total: number }[]
  /** a request is actually slow: the analysis state covers the questions */
  busy: boolean
  /** true while any request is in flight (for aria-busy) */
  pending: boolean
  slow: boolean
  /** an alert just opened or closed above: the workspace slides to make room */
  alertOpen: boolean
  onGo: (step: number) => void
  onSubmit: () => void
  onClear: () => void
  ref?: Ref<HTMLDivElement>
}

/**
 * The questionnaire: the profile rail (progress and steps) beside the current step, with the
 * step's actions in a glass bar that sticks to the bottom of the screen while the step is
 * taller than the window. One panel of glass, so the whole task reads as one place.
 */
export default function ProfileWorkspace({ ref, ...props }: Props) {
  const { step, direction, progress, busy, onGo } = props
  const stepProps = { form: props.form, setForm: props.setForm, options: props.options, errors: props.errors }
  const answered = progress.reduce((n, p) => n + p.answered, 0)
  const questions = progress.reduce((n, p) => n + p.total, 0)
  const technologies = Object.values(props.form.tech).reduce((n, t) => n + t.have.length + t.want.length, 0)
  const last = STEPS.length - 1

  // Coming up from below the hero, the glass settles into place: it rises the last few px as
  // its top travels from the bottom of the window to just past the middle. Movement only (a
  // scale would leave its edges out of line with the hero above). Wide screens only; a
  // transform on a wrapper, so the glass keeps its blur.
  const arrival = useRef<HTMLDivElement>(null)
  const fx = useScrollFx()
  const { scrollYProgress } = useScroll({ target: arrival, offset: ['start end', 'start 45%'] })
  const y = useTransform(scrollYProgress, [0, 1], [fx ? 28 : 0, 0])

  return (
    <m.div ref={arrival} style={{ y }}>
    <Box
      ref={ref}
      component={m.div}
      layout="position"
      transition={{ layout: makeRoom(props.alertOpen) }}
      className="no-print"
      aria-busy={props.pending}
      sx={(t) => ({
        ...panel(t, { elevation: 'high', radius: RADIUS.panel }),
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '272px minmax(0, 1fr)' },
        scrollMarginTop: { xs: 72, sm: 88 },
      })}
    >
      {/* a slow prediction: the analysis state covers the workspace (which stays put underneath) */}
      {busy && (
        <Box className="sp-fade" sx={(t) => ({ ...glass(t, 'overlay'), position: 'absolute', inset: 0, zIndex: 3, borderRadius: `${RADIUS.panel}px`, px: 2, pt: { xs: 5, md: 8 } })}>
          {/* sticky, so it stays in view however far down a long step the visitor is */}
          <Box sx={{ position: 'sticky', top: 140, maxWidth: 460, mx: 'auto', mb: 4 }}>
            <Analyzing answered={answered} questions={questions} technologies={technologies} roles={props.options.job_roles.length} slow={props.slow} />
          </Box>
        </Box>
      )}

      <ProfileRail step={step} progress={progress} disabled={busy} onGo={onGo} />

      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, pt: { xs: 2, md: 3.5 }, flexGrow: 1 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: { xs: 1.5, md: 2 }, minHeight: 32 }}>
            <Eyebrow tone={STEPS[step]?.tone}>
              Step {step + 1} of {STEPS.length}
              <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', display: { xs: 'none', sm: 'inline' } }}>
                {' '}
                · {answered} of {questions} questions answered
              </Box>
            </Eyebrow>
            <Button size="small" color="inherit" startIcon={<RestartAlt />} disabled={busy} onClick={props.onClear} sx={{ color: 'text.secondary' }}>
              Clear answers
            </Button>
          </Stack>

          {/* the new step arrives while the previous one leaves. No animation when the page opens;
              coming back from the results, the step slides in from the side it is on */}
          <AnimatePresence mode="popLayout" initial={direction !== null} custom={direction}>
            <StepPane key={step} direction={direction} inert={busy}>
              {step === 0 && <AboutStep {...stepProps} />}
              {step === 1 && <TechStep {...stepProps} />}
              {step === 2 && <AIStep {...stepProps} />}
            </StepPane>
          </AnimatePresence>
        </Box>

        {/* chrome glass: sticks to the bottom of the screen while the step is taller than the window */}
        <Box
          sx={(t) => ({
            ...glass(t, 'chrome'),
            position: 'sticky',
            bottom: 0,
            zIndex: 2,
            mt: 4,
            px: { xs: 1.5, sm: 3, md: 4 },
            pt: 1.5,
            pb: 'max(12px, env(safe-area-inset-bottom))',
            // a phone held sideways: a slimmer bar leaves more of the step visible
            '@media (max-height: 500px)': { pt: 0.75, pb: 'max(6px, env(safe-area-inset-bottom))' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
            borderTop: 1,
            borderColor: 'divider',
            borderBottomRightRadius: RADIUS.panel - 1,
            borderBottomLeftRadius: { xs: RADIUS.panel - 1, md: 0 },
          })}
        >
          <Box>
            <Button startIcon={<ArrowBack />} color="inherit" disabled={step === 0 || busy} onClick={() => onGo(step - 1)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              Back
            </Button>
            <IconButton aria-label="Back" disabled={step === 0 || busy} onClick={() => onGo(step - 1)} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
              <ArrowBack />
            </IconButton>
          </Box>
          {/* wraps (right-aligned) when the buttons do not fit side by side, e.g. with large text */}
          <Stack direction="row" useFlexGap sx={{ ml: 'auto', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {step < last && (
              <Button
                variant="outlined"
                endIcon={<ArrowForward />}
                disabled={busy}
                onClick={() => onGo(step + 1)}
                sx={{ '& .MuiButton-endIcon': { display: { xs: 'none', sm: 'inherit' } } }}
              >
                Next
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <AutoAwesome />}
              disabled={busy}
              onClick={props.onSubmit}
              sx={{ '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }}
            >
              Get recommendations
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
    </m.div>
  )
}
