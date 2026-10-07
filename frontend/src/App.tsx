import ArrowBack from '@mui/icons-material/ArrowBack'
import ArrowForward from '@mui/icons-material/ArrowForward'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import Close from '@mui/icons-material/Close'
import CloudOff from '@mui/icons-material/CloudOff'
import Refresh from '@mui/icons-material/Refresh'
import RestartAlt from '@mui/icons-material/RestartAlt'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { alpha, useColorScheme, useTheme } from '@mui/material/styles'
import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ValidationError, getOptions, predict } from './api/client'
import type { Options, Recommendation, SkillSuggestion } from './api/types'
import AIStep from './components/AIStep'
import Analyzing from './components/Analyzing'
import AboutStep from './components/AboutStep'
import Header from './components/Header'
import Hero from './components/Hero'
import PopTransition from './components/PopTransition'
import StepPane from './components/StepPane'
import type { Direction } from './components/StepPane'
import Results from './components/Results'
import TechStep from './components/TechStep'
import WizardSteps from './components/WizardSteps'
import {
  describeChanges,
  emptyForm,
  fromProfile,
  serverErrors,
  stepOf,
  stepProgress,
  toProfile,
  validate,
  withTechnology,
} from './form'
import type { Errors, FormState } from './form'
import { pct } from './format'
import { DURATION, EASE, isLeaving, prefersReducedMotion, useDelayedFlag } from './motion'
import { BRAND_GRADIENT, BRAND_GRADIENT_DARK, ELEVATION, RADIUS, glass } from './theme'
import { SAMPLES } from './samples'
import type { Sample } from './samples'
import { whatIfHighlights } from './whatif'

const RESULTS = 3

/** Where keyboard focus goes after a move: a heading of what is now shown, or the first invalid answer. */
type FocusTarget = 'hero-title' | 'step-title' | 'results-title' | 'whatif-title' | 'invalid'

interface Run {
  form: FormState // the answers that produced this result
  result: Recommendation
}

export default function App() {
  const [options, setOptions] = useState<Options | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [step, setStep] = useState(0)
  // direction of the last step change; null until the visitor first moves, so nothing slides on page load
  const [direction, setDirection] = useState<Direction>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingTech, setPendingTech] = useState<string | null>(null)
  const [current, setCurrent] = useState<Run | null>(null)
  const [comparison, setComparison] = useState<{ before: Recommendation; changes: string[] } | null>(null)
  // one message at a time; a new one replaces it (key restarts the timer). `undo` adds an Undo button.
  const [toast, setToast] = useState<{ message: string; undo?: () => void; key: number } | null>(null)
  const say = (message: string, undo?: () => void) => setToast({ message, undo, key: Date.now() })
  // read out by screen readers when a prediction arrives (n makes a repeated message count as a change)
  const [announcement, setAnnouncement] = useState({ text: '', n: 0 })
  const announce = (text: string) => setAnnouncement((a) => ({ text, n: a.n + 1 }))
  const { mode, setMode } = useColorScheme()
  const busyRef = useRef(false) // guards double submits without visibly disabling anything for a ~15 ms request
  const stepperRef = useRef<HTMLDivElement>(null)
  // toast: top-right on wide screens; on phones at the bottom, just above the sticky action bar
  const wide = useMediaQuery(useTheme().breakpoints.up('sm'))

  // The API usually answers in ~15 ms: spinners, dimming and disabled buttons only
  // appear when it is actually slow, so a normal request never flickers.
  const showBusy = useDelayedFlag(busy)
  const showSkeleton = useDelayedFlag(!options && !loadError, 150)
  const showRetrying = useDelayedFlag(retrying)
  const showSlow = useDelayedFlag(busy, 6000)

  // the start page's entrance plays once per visit, not again when coming back from the results
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    if (!options) return
    const t = window.setTimeout(() => setIntro(false), 1200)
    return () => window.clearTimeout(t)
  }, [options])

  // the form is built from GET /api/options, so nothing can be shown before it arrives
  const fetchOptions = useCallback(
    () =>
      getOptions()
        .then((o) => {
          setOptions(o)
          setLoadError(null)
        })
        .catch((e: Error) => setLoadError(e.message))
        .finally(() => setRetrying(false)),
    [],
  )
  useEffect(() => {
    void fetchOptions()
  }, [fetchOptions])
  const retryOptions = () => {
    setRetrying(true) // the error card stays up, with a spinner on its button
    void fetchOptions()
  }

  /**
   * Bring the stepper to the top of the window when it has scrolled away, or (for step
   * changes) when the step starts so low that the new content would open below the fold,
   * as on a phone. Instant, except for a what-if on the results page, which glides up so
   * it is clear where the comparison went.
   */
  const revealWizard = (smooth: boolean, onlyIfHidden: boolean) => {
    requestAnimationFrame(() => {
      const el = stepperRef.current
      if (!el) return window.scrollTo({ top: 0 })
      const { top, bottom } = el.getBoundingClientRect()
      const hidden = top < 56 // under the sticky header or above it
      const low = bottom > window.innerHeight * 0.6
      if (!hidden && (onlyIfHidden || !low)) return
      el.scrollIntoView({ block: 'start', behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' })
    })
  }

  /**
   * Moving between steps removes or disables the button that was pressed (Next on the
   * last step, Get recommendations, Back on the first), which would drop keyboard focus
   * to the top of the page. Focus moves to the heading of what is now shown instead, so
   * Tab continues from there and screen readers announce where the visitor is.
   */
  const focusNext = useRef<FocusTarget | null>(null)
  useEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    // after revealWizard's scroll (also queued for the next frame). The step on its way out
    // is still on the page, with the same ids: only the one that is staying counts.
    const find = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].find((el) => !isLeaving(el))
    requestAnimationFrame(() => {
      if (target === 'invalid') {
        const field = find('[aria-invalid="true"]')
        const input = field?.matches('input, textarea, button') ? field : field?.querySelector<HTMLElement>('input, button')
        if (input) {
          input.focus({ preventScroll: true })
          input.scrollIntoView({ block: 'center' })
          return
        }
      }
      find(`#${target === 'invalid' ? 'step-title' : target}`)?.focus({ preventScroll: true })
    })
  })

  const goTo = (
    s: number,
    { smooth = false, onlyIfHidden = false, focus = true }: { smooth?: boolean; onlyIfHidden?: boolean; focus?: boolean | FocusTarget } = {},
  ) => {
    if (s !== step) setDirection(s > step ? 'forward' : 'back')
    setStep(s)
    revealWizard(smooth, onlyIfHidden)
    if (focus) focusNext.current = focus === true ? (s === RESULTS ? 'results-title' : 'step-title') : focus
  }

  /** Validate, call the API, and keep the previous result for the what-if comparison. */
  async function run(answers: FormState, tech?: string) {
    if (!options || busyRef.current) return
    const clientErrors = validate(answers, options)
    setErrors(clientErrors)
    setApiError(null)
    if (Object.keys(clientErrors).length) {
      goTo(Math.min(...Object.keys(clientErrors).map(stepOf)))
      focusNext.current = 'invalid'
      return
    }
    busyRef.current = true
    setToast(null) // the "example loaded" hint has done its job
    setBusy(true)
    setPendingTech(tech ?? null)
    try {
      const result = await predict(toProfile(answers))
      const changes = current ? describeChanges(current.form, answers) : []
      // re-running unchanged answers keeps the comparison that is already shown
      if (current && changes.length) setComparison({ before: current.result, changes })
      setCurrent({ form: answers, result })
      setForm(answers)
      // a what-if from the results page glides up to the comparison, so it is clear where it went
      goTo(RESULTS, { smooth: step === RESULTS })
      const top = result.roles[0]
      if (current && changes.length) {
        focusNext.current = 'whatif-title'
        announce(`Results updated. ${whatIfHighlights(current.result, result).map((h) => h.text).join(' ')}`)
      } else {
        announce(`Results ready. Your best match is ${top.label} at ${pct(top.probability)}.`)
      }
    } catch (e) {
      if (e instanceof ValidationError) {
        const mapped = serverErrors(e.fields)
        setErrors(mapped)
        setApiError(e.message)
        goTo(Math.min(...Object.keys(mapped).map(stepOf)))
        focusNext.current = 'invalid'
      } else {
        setApiError((e as Error).message)
      }
    } finally {
      busyRef.current = false
      setBusy(false)
      setPendingTech(null)
    }
  }

  function pickSample(s: Sample) {
    setForm(fromProfile(s.profile))
    setErrors({})
    setApiError(null)
    setCurrent(null)
    setComparison(null)
    goTo(0, { onlyIfHidden: true, focus: false }) // the example just pressed keeps focus
    say(`Loaded “${s.name}”. Review the answers or press Get recommendations.`)
  }

  /** Empty the form (and the results). Nothing is lost for good: the toast offers to undo it. */
  function restart() {
    const snapshot = { form, current, comparison, step }
    const hadAnything = current !== null || JSON.stringify(form) !== JSON.stringify(emptyForm())
    setForm(emptyForm())
    setErrors({})
    setApiError(null)
    setCurrent(null)
    setComparison(null)
    // Clear answers stays on screen and keeps focus; Start over (on the results) goes back to the top of the page
    goTo(0, { onlyIfHidden: true, focus: step === RESULTS && 'hero-title' })
    if (!hadAnything) return
    say(snapshot.current ? 'Started over. Your answers and results were cleared.' : 'Answers cleared.', () => {
      setForm(snapshot.form)
      setCurrent(snapshot.current)
      setComparison(snapshot.comparison)
      setToast(null)
      goTo(snapshot.step, { onlyIfHidden: true })
    })
  }

  function trySkill(s: SkillSuggestion) {
    if (!current) return
    void run(withTechnology(current.form, s.area, s.technology), s.technology)
  }

  // the example whose answers are still loaded unchanged, shown as selected in the example bar
  const activeSample = useMemo(() => {
    const answers = JSON.stringify(form)
    return SAMPLES.find((s) => JSON.stringify(fromProfile(s.profile)) === answers)?.id ?? null
  }, [form])

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

  const progress = useMemo(() => stepProgress(form), [form])
  const answered = progress.reduce((n, p) => n + p.answered, 0)
  const questions = progress.reduce((n, p) => n + p.total, 0)
  const technologies = Object.values(form.tech).reduce((n, t) => n + t.have.length + t.want.length, 0)
  const stepProps = options ? { form, setForm, options, errors } : null
  const errorCount = Object.keys(errors).length

  return (
    <Box sx={{ minHeight: '100dvh' }}>
      <Header />
      {/* a slow what-if re-run: say what is happening, just under the header (the results dim meanwhile) */}
      <PopTransition
        in={showBusy && step === RESULTS}
        unmountOnExit
        timeout={{ enter: DURATION.medium, exit: DURATION.small }}
        from="top"
        travel={12}
      >
        <Box
          role="status"
          className="no-print"
          sx={(t) => ({
            ...glass(t, 'floating'),
            position: 'fixed',
            top: { xs: 68, sm: 72 },
            // centred with margins, not a transform: the arrival animation owns transform
            left: 0,
            right: 0,
            mx: 'auto',
            width: 'fit-content',
            zIndex: t.zIndex.appBar + 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            maxWidth: 'calc(100vw - 32px)',
            px: 2,
            py: 1,
            borderRadius: 999,
            fontSize: '0.875rem',
            fontWeight: 500,
            border: 1,
            borderColor: 'divider',
            boxShadow: ELEVATION.floating,
          })}
        >
          <CircularProgress size={16} thickness={5} />
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pendingTech ? `Re-running with ${pendingTech} added…` : 'Updating your matches…'}
          </Box>
        </Box>
      </PopTransition>
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 2.5, md: 5 } }}>
        {!options ? (
          loadError ? (
            <LoadError message={loadError} retrying={showRetrying} onRetry={retryOptions} />
          ) : (
            showSkeleton && <LoadingSkeleton />
          )
        ) : (
          <Stack spacing={3} className="sp-fade">
            {step < RESULTS && (
              <Box sx={{ pb: { xs: 1, md: 3 } }}>
                <Hero options={options} intro={intro} onPick={pickSample} disabled={showBusy} activeId={activeSample} />
              </Box>
            )}

            <WizardSteps
              ref={stepperRef}
              step={step}
              progress={progress}
              resultsReady={current !== null}
              disabled={showBusy}
              onGo={(i) => goTo(i)}
            />

            {apiError && (
              <Alert severity="error" onClose={() => setApiError(null)} className="no-print sp-rise">
                {apiError}
              </Alert>
            )}
            {!apiError && errorCount > 0 && step < RESULTS && (
              <Alert severity="warning" className="no-print sp-rise">
                Please fix the highlighted {errorCount === 1 ? 'answer' : `${errorCount} answers`}.
              </Alert>
            )}

            {step < RESULTS && stepProps && (
              <Paper sx={{ p: { xs: 2, md: 3 }, position: 'relative', borderRadius: `${RADIUS.panel}px` }} className="no-print" aria-busy={busy}>
                {/* a slow prediction: the analysis state covers the form (which stays put underneath) */}
                {showBusy && (
                  <Box
                    className="sp-fade"
                    sx={(t) => ({
                      ...glass(t, 'overlay'),
                      position: 'absolute',
                      inset: 0,
                      zIndex: 3,
                      borderRadius: `${RADIUS.panel}px`,
                      px: 2,
                      pt: { xs: 4, md: 7 },
                    })}
                  >
                    {/* sticky, so it stays in view however far down a long step the visitor is */}
                    <Box sx={{ position: 'sticky', top: 140, maxWidth: 440, mx: 'auto', mb: 4 }}>
                      <Analyzing
                        answered={answered}
                        questions={questions}
                        technologies={technologies}
                        roles={options.job_roles.length}
                        slow={showSlow}
                      />
                    </Box>
                  </Box>
                )}
                {/* how much of the whole profile is answered: a hairline in the brand gradient along the card's top edge */}
                <Box
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    overflow: 'hidden',
                    borderTopLeftRadius: RADIUS.panel,
                    borderTopRightRadius: RADIUS.panel,
                  }}
                >
                  <Box
                    className="sp-meter"
                    sx={(t) => ({
                      height: '100%',
                      backgroundImage: BRAND_GRADIENT,
                      ...t.applyStyles('dark', { backgroundImage: BRAND_GRADIENT_DARK }),
                      transformOrigin: 'left',
                      transform: `scaleX(${answered / questions})`,
                      transition: `transform ${DURATION.large}ms ${EASE.inOut}`,
                    })}
                  />
                </Box>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2, minHeight: 32 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                    Step {step + 1} of {RESULTS}
                    <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', display: { xs: 'none', sm: 'inline' } }}>
                      {' '}
                      · {answered} of {questions} questions answered
                    </Box>
                  </Typography>
                  <Button size="small" color="inherit" startIcon={<RestartAlt />} disabled={showBusy} onClick={restart}>
                    Clear answers
                  </Button>
                </Stack>

                {/* the new step arrives while the previous one leaves (no animation when the page opens) */}
                <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                  <StepPane key={step} direction={direction} inert={showBusy}>
                    {step === 0 && <AboutStep {...stepProps} />}
                    {step === 1 && <TechStep {...stepProps} />}
                    {step === 2 && <AIStep {...stepProps} />}
                  </StepPane>
                </AnimatePresence>

                {/* chrome glass: sticks to the bottom of the screen while the step is taller than the window */}
                <Box
                  sx={(t) => ({
                    ...glass(t, 'chrome'),
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 2,
                    mt: 4,
                    mx: { xs: -2, md: -3 },
                    mb: { xs: -2, md: -3 },
                    px: { xs: 1.5, md: 3 },
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
                    // inside the card's 1px border
                    borderBottomLeftRadius: RADIUS.panel - 1,
                    borderBottomRightRadius: RADIUS.panel - 1,
                  })}
                >
                  <Box>
                    <Button
                      startIcon={<ArrowBack />}
                      disabled={step === 0 || showBusy}
                      onClick={() => goTo(step - 1)}
                      sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                    >
                      Back
                    </Button>
                    <IconButton
                      aria-label="Back"
                      disabled={step === 0 || showBusy}
                      onClick={() => goTo(step - 1)}
                      sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                    >
                      <ArrowBack />
                    </IconButton>
                  </Box>
                  {/* wraps (right-aligned) when the buttons do not fit side by side, e.g. with large text */}
                  <Stack direction="row" useFlexGap sx={{ ml: 'auto', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {step < 2 && (
                      <Button
                        variant="outlined"
                        endIcon={<ArrowForward />}
                        disabled={showBusy}
                        onClick={() => goTo(step + 1)}
                        sx={{ '& .MuiButton-endIcon': { display: { xs: 'none', sm: 'inherit' } } }}
                      >
                        Next
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      startIcon={showBusy ? <CircularProgress size={18} color="inherit" /> : <AutoAwesome />}
                      disabled={showBusy}
                      onClick={() => void run(form)}
                      sx={{ '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }}
                    >
                      Get recommendations
                    </Button>
                  </Stack>
                </Box>
              </Paper>
            )}

            {step === RESULTS && current && (
              <Box
                aria-busy={busy}
                sx={{
                  opacity: showBusy ? 0.5 : 1,
                  transition: `opacity ${DURATION.medium}ms ease`,
                  pointerEvents: showBusy ? 'none' : undefined,
                }}
              >
                <Results
                  result={current.result}
                  answers={current.form}
                  comparison={comparison}
                  busy={showBusy}
                  pendingTech={pendingTech}
                  onEdit={() => goTo(0)}
                  onRestart={restart}
                  onPrint={() => window.print()}
                  onTrySkill={trySkill}
                  onClearComparison={() => {
                    setComparison(null)
                    focusNext.current = 'results-title' // the Hide comparison button goes away with the panel
                  }}
                />
              </Box>
            )}
          </Stack>
        )}
      </Container>

      <Snackbar
        key={toast?.key}
        open={!!toast}
        // an undo stays a little longer, so there is time to reach it
        autoHideDuration={toast?.undo ? 7000 : 4500}
        onClose={(_, reason) => reason !== 'clickaway' && setToast(null)}
        message={toast?.message}
        action={
          <>
            {toast?.undo && (
              <Button
                size="small"
                onClick={toast.undo}
                // the toast is ink in light mode and near-white in dark mode: a light and a deep indigo, both over 4.5:1
                sx={(t) => ({ color: '#a8b9ff', fontWeight: 700, ...t.applyStyles('dark', { color: '#3051c4' }) })}
              >
                Undo
              </Button>
            )}
            <IconButton size="small" color="inherit" aria-label="Dismiss" onClick={() => setToast(null)} sx={{ opacity: 0.7 }}>
              <Close fontSize="small" />
            </IconButton>
          </>
        }
        anchorOrigin={wide ? { vertical: 'top', horizontal: 'right' } : { vertical: 'bottom', horizontal: 'center' }}
        slots={{ transition: PopTransition }}
        transitionDuration={{ enter: DURATION.medium, exit: DURATION.small }}
        // arrives from the edge it is anchored to
        slotProps={{ transition: { from: wide ? 'top' : 'bottom', travel: 12 } }}
        sx={wide ? { top: '76px !important' } : { bottom: 'calc(76px + env(safe-area-inset-bottom)) !important' }}
      />

      {/* what a prediction found, for screen readers (the page shows it; this says it) */}
      <div role="status" className="sp-sr-only">
        {announcement.text}
        {announcement.n % 2 ? '\u00a0' : ''}
      </div>
    </Box>
  )
}

/** Placeholder in the shape of the start page while GET /api/options is on its way (only if it is slow). */
function LoadingSkeleton() {
  return (
    <Stack spacing={3} role="status" aria-busy="true" aria-label="Loading" className="sp-fade">
      <Box>
        <Skeleton variant="text" sx={{ fontSize: '2.25rem', width: { xs: '85%', md: '45%' } }} />
        <Skeleton variant="text" sx={{ maxWidth: 700 }} />
        <Skeleton variant="text" sx={{ maxWidth: 520 }} />
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          {[150, 170, 130, 120].map((w) => (
            <Skeleton key={w} variant="rounded" width={w} height={32} sx={{ borderRadius: 999 }} />
          ))}
        </Stack>
      </Box>
      <Skeleton variant="rounded" height={64} sx={{ borderRadius: `${RADIUS.card}px` }} />
      <Skeleton variant="rounded" height={340} sx={{ borderRadius: `${RADIUS.card}px` }} />
    </Stack>
  )
}

/** Empty state when the API cannot be reached; the card stays put while retrying. */
function LoadError({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <Paper sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }} className="sp-rise" role="alert">
      <Stack spacing={2} sx={{ alignItems: 'center', maxWidth: 520, mx: 'auto' }}>
        <Box
          sx={(t) => ({
            width: 52,
            height: 52,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: 'error.main',
            bgcolor: alpha(t.palette.error.main, 0.1),
          })}
        >
          <CloudOff />
        </Box>
        {/* the only heading on the page in this state */}
        <Typography variant="h6" component="h1">
          SkillPath can’t load right now
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {message}
        </Typography>
        <Button
          variant="contained"
          onClick={onRetry}
          disabled={retrying}
          startIcon={retrying ? <CircularProgress size={18} color="inherit" /> : <Refresh />}
        >
          Try again
        </Button>
      </Stack>
    </Paper>
  )
}
