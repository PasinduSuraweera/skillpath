import ArrowBack from '@mui/icons-material/ArrowBack'
import ArrowForward from '@mui/icons-material/ArrowForward'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import RestartAlt from '@mui/icons-material/RestartAlt'
import Alert from '@mui/material/Alert'
import Backdrop from '@mui/material/Backdrop'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Step from '@mui/material/Step'
import StepButton from '@mui/material/StepButton'
import Stepper from '@mui/material/Stepper'
import Typography from '@mui/material/Typography'
import { useColorScheme } from '@mui/material/styles'
import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ValidationError, getOptions, predict } from './api/client'
import type { Options, Recommendation, SkillSuggestion } from './api/types'
import AIStep from './components/AIStep'
import AboutStep from './components/AboutStep'
import Header from './components/Header'
import Results from './components/Results'
import SampleBar from './components/SampleBar'
import TechStep from './components/TechStep'
import {
  describeChanges,
  emptyForm,
  fromProfile,
  serverErrors,
  stepOf,
  toProfile,
  validate,
  withTechnology,
} from './form'
import type { Errors, FormState } from './form'
import type { Sample } from './samples'

const STEPS = ['About you', 'Technologies', 'AI usage', 'Results']
const RESULTS = 3

interface Run {
  form: FormState // the answers that produced this result
  result: Recommendation
}

export default function App() {
  const [options, setOptions] = useState<Options | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<Run | null>(null)
  const [comparison, setComparison] = useState<{ before: Recommendation; changes: string[] } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const { mode, setMode } = useColorScheme()

  // the form is built from GET /api/options, so nothing can be shown before it arrives
  const fetchOptions = useCallback(
    () =>
      getOptions()
        .then(setOptions)
        .catch((e: Error) => setLoadError(e.message)),
    [],
  )
  useEffect(() => {
    void fetchOptions()
  }, [fetchOptions])
  const retryOptions = () => {
    setLoadError(null)
    void fetchOptions()
  }

  const goTo = (s: number) => {
    setStep(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Validate, call the API, and keep the previous result for the what-if comparison. */
  async function run(answers: FormState) {
    if (!options) return
    const clientErrors = validate(answers, options)
    setErrors(clientErrors)
    setApiError(null)
    if (Object.keys(clientErrors).length) {
      goTo(Math.min(...Object.keys(clientErrors).map(stepOf)))
      return
    }
    setBusy(true)
    try {
      const result = await predict(toProfile(answers))
      if (current) {
        const changes = describeChanges(current.form, answers)
        // re-running unchanged answers keeps the comparison that is already shown
        if (changes.length) setComparison({ before: current.result, changes })
      }
      setCurrent({ form: answers, result })
      setForm(answers)
      goTo(RESULTS)
    } catch (e) {
      if (e instanceof ValidationError) {
        const mapped = serverErrors(e.fields)
        setErrors(mapped)
        setApiError(e.message)
        goTo(Math.min(...Object.keys(mapped).map(stepOf)))
      } else {
        setApiError((e as Error).message)
      }
    } finally {
      setBusy(false)
    }
  }

  function pickSample(s: Sample) {
    setForm(fromProfile(s.profile))
    setErrors({})
    setApiError(null)
    setCurrent(null)
    setComparison(null)
    goTo(0)
    setToast(`Loaded “${s.name}”. Review the answers or press Get recommendations.`)
  }

  function restart() {
    setForm(emptyForm())
    setErrors({})
    setApiError(null)
    setCurrent(null)
    setComparison(null)
    goTo(0)
  }

  function trySkill(s: SkillSuggestion) {
    if (!current) return
    void run(withTechnology(current.form, s.area, s.technology))
  }

  // Always print in light colours: browsers drop dark backgrounds, which would
  // leave white text on white paper. beforeprint also covers Ctrl/Cmd+P.
  const modeBeforePrint = useRef<typeof mode | null>(null)
  useEffect(() => {
    const before = () => {
      if (mode === 'light') return
      modeBeforePrint.current = mode ?? 'system'
      flushSync(() => setMode('light')) // re-render before the page is laid out for print
    }
    const after = () => {
      if (modeBeforePrint.current) setMode(modeBeforePrint.current)
      modeBeforePrint.current = null
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [mode, setMode])

  const stepProps = options ? { form, setForm, options, errors } : null
  const errorCount = Object.keys(errors).length

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        {!options ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            {loadError ? (
              <Stack spacing={2} sx={{ alignItems: 'center' }}>
                <Alert severity="error" sx={{ textAlign: 'left' }}>
                  {loadError}
                </Alert>
                <Button variant="contained" onClick={retryOptions}>
                  Try again
                </Button>
              </Stack>
            ) : (
              <CircularProgress aria-label="Loading" />
            )}
          </Paper>
        ) : (
          <Stack spacing={3}>
            {step < RESULTS && (
              <Box className="no-print">
                <Typography variant="h4" component="h2" sx={{ fontSize: { xs: '1.6rem', md: '2.1rem' } }}>
                  Which developer role fits you?
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2, maxWidth: 820 }}>
                  Answer a few questions about your skills and how you use AI. SkillPath compares you with about 18,000
                  developers from the 2025 Stack Overflow survey and suggests your three closest job roles, with each
                  role’s AI outlook, typical pay and the skills to grow next.
                </Typography>
                <SampleBar onPick={pickSample} disabled={busy} />
              </Box>
            )}

            <Stepper nonLinear activeStep={step} alternativeLabel className="no-print">
              {STEPS.map((label, i) => (
                <Step key={label} completed={i < RESULTS && current !== null}>
                  <StepButton onClick={() => goTo(i)} disabled={busy || (i === RESULTS && !current)}>
                    {label}
                  </StepButton>
                </Step>
              ))}
            </Stepper>

            {apiError && (
              <Alert severity="error" onClose={() => setApiError(null)} className="no-print">
                {apiError}
              </Alert>
            )}
            {!apiError && errorCount > 0 && step < RESULTS && (
              <Alert severity="warning" className="no-print">
                Please fix the highlighted {errorCount === 1 ? 'answer' : `${errorCount} answers`}.
              </Alert>
            )}

            {step < RESULTS && stepProps && (
              <Paper sx={{ p: { xs: 2, md: 3 } }} className="no-print">
                {step === 0 && <AboutStep {...stepProps} />}
                {step === 1 && <TechStep {...stepProps} />}
                {step === 2 && <AIStep {...stepProps} />}

                <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 4, gap: 1, flexWrap: 'wrap' }}>
                  <Stack direction="row" spacing={1}>
                    <Button startIcon={<ArrowBack />} disabled={step === 0 || busy} onClick={() => goTo(step - 1)}>
                      Back
                    </Button>
                    <Button color="inherit" startIcon={<RestartAlt />} disabled={busy} onClick={restart}>
                      Clear answers
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    {step < 2 && (
                      <Button variant="outlined" endIcon={<ArrowForward />} disabled={busy} onClick={() => goTo(step + 1)}>
                        Next
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <AutoAwesome />}
                      disabled={busy}
                      onClick={() => void run(form)}
                    >
                      Get recommendations
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}

            {step === RESULTS && current && (
              <Results
                result={current.result}
                comparison={comparison}
                busy={busy}
                onEdit={() => goTo(0)}
                onRestart={restart}
                onPrint={() => window.print()}
                onTrySkill={trySkill}
                onClearComparison={() => setComparison(null)}
              />
            )}
          </Stack>
        )}
      </Container>

      <Backdrop open={busy && step === RESULTS} sx={{ zIndex: (t) => t.zIndex.drawer + 1, color: '#fff' }}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
