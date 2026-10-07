import Close from '@mui/icons-material/Close'
import CloudOff from '@mui/icons-material/CloudOffOutlined'
import Refresh from '@mui/icons-material/Refresh'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useColorScheme, useTheme } from '@mui/material/styles'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ValidationError, getOptions, predict } from './api/client'
import type { Options, SkillSuggestion } from './api/types'
import Hero from './components/Hero'
import NavBar from './components/NavBar'
import type { View } from './components/NavBar'
import PopTransition from './components/PopTransition'
import ProfileWorkspace from './components/ProfileWorkspace'
import RefineHeader from './components/RefineHeader'
import type { Direction } from './components/StepPane'
import Dashboard from './components/dashboard/Dashboard'
import { IconTile } from './design/primitives'
import { panel } from './design/surfaces'
import { RADIUS, glass, glassEdge, mergeStyles, shadow } from './design/tokens'
import { MAX_EXPLORATIONS } from './explorations'
import type { Exploration } from './explorations'
import { describeChanges, emptyForm, fromProfile, serverErrors, stepOf, stepProgress, toProfile, validate, withTechnology } from './form'
import type { Errors, FormState } from './form'
import { pct } from './format'
import { DURATION, OPENING, OPENING_REDUCED, isLeaving, makeRoom, useDelayedFlag } from './motion'
import { navClearance, scrollToElement, scrollToTop, startSmoothScroll } from './scroll'
import { SAMPLES } from './samples'
import type { Sample } from './samples'
import { whatIfHighlights } from './whatif'

const RESULTS = 3

/** Where keyboard focus goes after a move: a heading of what is now shown, or the first invalid answer. */
type FocusTarget = 'hero-title' | 'step-title' | 'results-title' | 'whatif-title' | 'invalid'

export default function App() {
  const [options, setOptions] = useState<Options | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [step, setStep] = useState(0)
  // the questionnaire step to return to from the results (the nav's Profile)
  const lastStep = useRef(0)
  // direction of the last step change; null until the visitor first moves, so nothing slides on page load
  const [direction, setDirection] = useState<Direction>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingTech, setPendingTech] = useState<string | null>(null)
  // every prediction of this session (memory only); `current` is the one on screen
  const [history, setHistory] = useState<Exploration[]>([])
  const [current, setCurrent] = useState<Exploration | null>(null)
  const nextRun = useRef(1)
  const [comparison, setComparison] = useState<{ before: Exploration['result']; changes: string[] } | null>(null)
  // one message at a time; a new one replaces it (key restarts the timer). `undo` adds an Undo button.
  const [toast, setToast] = useState<{ message: string; undo?: () => void; key: number } | null>(null)
  const say = (message: string, undo?: () => void) => setToast({ message, undo, key: Date.now() })
  // read out by screen readers when a prediction arrives (n makes a repeated message count as a change)
  const [announcement, setAnnouncement] = useState({ text: '', n: 0 })
  const announce = (text: string) => setAnnouncement((a) => ({ text, n: a.n + 1 }))
  const { mode, setMode } = useColorScheme()
  const busyRef = useRef(false) // guards double submits without visibly disabling anything for a ~15 ms request
  const workspaceRef = useRef<HTMLDivElement>(null)
  // toast: top-right on wide screens; on phones at the bottom, just above the sticky action bar
  const wide = useMediaQuery(useTheme().breakpoints.up('sm'))

  // The API usually answers in ~15 ms: spinners, overlays and disabled buttons only
  // appear when it is actually slow, so a normal request never flickers.
  const showBusy = useDelayedFlag(busy)
  const showSkeleton = useDelayedFlag(!options && !loadError, 150)
  const showRetrying = useDelayedFlag(retrying)
  const showSlow = useDelayedFlag(busy, 6000)

  // smooth wheel and trackpad scrolling for the whole session (scroll.ts)
  useEffect(() => startSmoothScroll(), [])

  // the start page's entrance plays once per visit, not again when coming back from the results
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    if (!options) return
    const t = window.setTimeout(() => setIntro(false), 1400)
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
   * After a move, bring the right place into view. The results open at the top of the page
   * (a what-if glides up, so it is clear where the comparison went). A questionnaire step
   * brings the workspace up when it has scrolled away under the nav or (for step changes)
   * starts so low that the new step would open below the fold, as on a phone.
   */
  const reveal = (s: number, smooth: boolean, onlyIfHidden: boolean) => {
    requestAnimationFrame(() => {
      const el = workspaceRef.current
      if (s === RESULTS || !el) return scrollToTop(0, smooth)
      const { top } = el.getBoundingClientRect()
      const hidden = top < navClearance() - 8
      const low = top > window.innerHeight * 0.45
      if (!hidden && (onlyIfHidden || !low)) return
      scrollToElement(el, smooth)
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
    // after reveal's scroll (also queued for the next frame). The step on its way out
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
    if (s < RESULTS) lastStep.current = s
    setStep(s)
    reveal(s, smooth, onlyIfHidden)
    if (focus) focusNext.current = focus === true ? (s === RESULTS ? 'results-title' : 'step-title') : focus
  }

  /** Validate, call the API, keep the previous result for the what-if comparison, and log the run. */
  async function run(answers: FormState, how: { tech?: string; from?: number } = {}) {
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
    setPendingTech(how.tech ?? null)
    try {
      const result = await predict(toProfile(answers))
      const changes = current ? describeChanges(current.form, answers) : []
      let entry: Exploration
      if (current && !changes.length) {
        // re-running unchanged answers refreshes the same run and keeps the comparison that is shown
        entry = { ...current, result }
        setHistory((h) => h.map((e) => (e.id === current.id ? entry : e)))
      } else {
        entry = { id: nextRun.current++, at: Date.now(), form: answers, result, changes, tech: how.tech ?? null, from: how.from ?? null }
        setHistory((h) => [...h, entry].slice(-MAX_EXPLORATIONS))
        if (current) setComparison({ before: current.result, changes })
      }
      setCurrent(entry)
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
    setHistory([])
    nextRun.current = 1
    goTo(0, { onlyIfHidden: true, focus: false }) // the example just pressed keeps focus
    say(`Loaded “${s.name}”. Review the answers or press Get recommendations.`)
  }

  /** Empty the form (and the results). Nothing is lost for good: the toast offers to undo it. */
  function restart() {
    const snapshot = { form, current, comparison, step, history, nextRun: nextRun.current }
    const hadAnything = current !== null || JSON.stringify(form) !== JSON.stringify(emptyForm())
    const fromResults = step === RESULTS
    setForm(emptyForm())
    setErrors({})
    setApiError(null)
    setCurrent(null)
    setComparison(null)
    setHistory([])
    nextRun.current = 1
    // Clear answers stays on screen and keeps focus; Start over (on the results) goes back to the top of the page
    goTo(0, { onlyIfHidden: true, focus: fromResults && 'hero-title' })
    if (fromResults) requestAnimationFrame(() => scrollToTop(0, false))
    if (!hadAnything) return
    say(snapshot.current ? 'Started over. Your answers and results were cleared.' : 'Answers cleared.', () => {
      setForm(snapshot.form)
      setCurrent(snapshot.current)
      setComparison(snapshot.comparison)
      setHistory(snapshot.history)
      nextRun.current = snapshot.nextRun
      setToast(null)
      goTo(snapshot.step, { onlyIfHidden: true })
    })
  }

  function trySkill(s: SkillSuggestion) {
    if (!current) return
    void run(withTechnology(current.form, s.area, s.technology), { tech: s.technology })
  }

  /** "Build my profile": the questionnaire, brought into view with its first question ready. */
  function startProfile() {
    const el = workspaceRef.current
    if (el) scrollToElement(el, true)
    requestAnimationFrame(() => document.getElementById('step-title')?.focus({ preventScroll: true }))
  }

  // the example whose answers are still loaded unchanged, shown as selected in the example list
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
  const errorCount = Object.keys(errors).length
  // an alert above the questionnaire or the results; what is below slides to make room (makeRoom)
  const alertOpen = !!apiError || (errorCount > 0 && step < RESULTS)
  const reduce = useReducedMotion()
  const view: View = step === RESULTS ? 'results' : 'profile'

  return (
    // clip, not hidden: the decorative glows may bleed past the sides without making the page scroll
    // sideways, and clip does not create a scroll container, so the nav stays sticky
    <Box sx={{ minHeight: '100dvh', overflowX: 'clip' }}>
      <NavBar view={view} resultsReady={current !== null} disabled={showBusy} onNavigate={(v) => goTo(v === 'results' ? RESULTS : lastStep.current)} />

      {/* a slow what-if re-run: say what is happening, just under the nav */}
      <PopTransition in={showBusy && step === RESULTS} unmountOnExit timeout={{ enter: DURATION.medium, exit: DURATION.small }} from="top" travel={12}>
        <Box
          role="status"
          className="no-print"
          sx={(t) =>
            mergeStyles(glass(t, 'floating'), glassEdge(t), shadow(t, 'high'), {
            position: 'fixed',
            top: { xs: 76, sm: 88 },
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
            fontWeight: 550,
          })}
        >
          <CircularProgress size={16} thickness={5} />
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pendingTech ? `Re-running with ${pendingTech} added…` : 'Updating your matches…'}
          </Box>
        </Box>
      </PopTransition>

      <Container component="main" maxWidth="lg" sx={{ pt: { xs: 2, md: 3 }, pb: { xs: 4, md: 8 } }}>
        {!options ? (
          loadError ? (
            <LoadError message={loadError} retrying={showRetrying} onRetry={retryOptions} />
          ) : (
            showSkeleton && <LoadingSkeleton />
          )
        ) : (
          // gap rather than margins, and positioned: an alert is lifted out of the flow as it leaves
          <Stack spacing={{ xs: 3, md: 4 }} useFlexGap sx={{ position: 'relative' }}>
            {step < RESULTS &&
              (current ? (
                <RefineHeader result={current.result} onBack={() => goTo(RESULTS)} disabled={showBusy} />
              ) : (
                <Hero options={options} intro={intro} onPick={pickSample} onStart={startProfile} disabled={showBusy} activeId={activeSample} />
              ))}

            {/* alerts open like the what-if comparison (OPENING): what is below slides down to make room */}
            <AnimatePresence mode="popLayout" initial={false}>
              {apiError ? (
                <m.div key="api-error" className="no-print" {...(reduce ? OPENING_REDUCED : OPENING)}>
                  <Alert severity="error" onClose={() => setApiError(null)}>
                    {apiError}
                  </Alert>
                </m.div>
              ) : (
                errorCount > 0 &&
                step < RESULTS && (
                  <m.div key="fix-answers" className="no-print" {...(reduce ? OPENING_REDUCED : OPENING)}>
                    <Alert severity="warning">Please fix the highlighted {errorCount === 1 ? 'answer' : `${errorCount} answers`}.</Alert>
                  </m.div>
                )
              )}
            </AnimatePresence>

            {step < RESULTS && (
              <ProfileWorkspace
                ref={workspaceRef}
                step={step}
                direction={direction}
                form={form}
                setForm={setForm}
                options={options}
                errors={errors}
                progress={progress}
                busy={showBusy}
                pending={busy}
                slow={showSlow}
                alertOpen={alertOpen}
                onGo={(i) => goTo(i)}
                onSubmit={() => void run(form)}
                onClear={restart}
              />
            )}

            {step === RESULTS && current && (
              <Box
                component={m.div}
                layout="position"
                transition={{ layout: makeRoom(alertOpen) }}
                aria-busy={busy}
                // while a slow what-if runs, the page stays as it is (the status above says what is happening);
                // no dimming: fading a wrapper would switch off the blur of the glass inside it
                sx={{ pointerEvents: showBusy ? 'none' : undefined }}
              >
                <Dashboard
                  result={current.result}
                  answers={current.form}
                  comparison={comparison}
                  busy={showBusy}
                  pendingTech={pendingTech}
                  history={history}
                  currentId={current.id}
                  onEdit={() => goTo(lastStep.current)}
                  onRestart={restart}
                  onPrint={() => window.print()}
                  onTrySkill={trySkill}
                  onClearComparison={() => {
                    setComparison(null)
                    focusNext.current = 'results-title' // the Hide comparison button goes away with the panel
                  }}
                  onRestore={(e) => void run(e.form, { from: e.id })}
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
                sx={(t) => ({ color: '#c7d2fe', fontWeight: 700, ...t.applyStyles('dark', { color: '#4338ca' }) })}
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
        sx={wide ? { top: '92px !important' } : { bottom: 'calc(80px + env(safe-area-inset-bottom)) !important' }}
      />

      {/* what a prediction found, for screen readers (the page shows it; this says it) */}
      <div role="status" className="sp-sr-only">
        {announcement.text}
        {announcement.n % 2 ? ' ' : ''}
      </div>
    </Box>
  )
}

/**
 * Placeholder in the shape of the start page while GET /api/options is on its way (only if it
 * is slow): the headline and copy, the examples panel and the workspace, on the glass they will
 * have. Each surface fades in itself (a fading wrapper would switch off its blur). The page
 * heading is there for screen readers.
 */
function LoadingSkeleton() {
  return (
    <Stack spacing={4} role="status" aria-busy="true" sx={{ pt: { xs: 2, md: 5 } }}>
      <Typography variant="h1" className="sp-sr-only">
        Loading SkillPath
      </Typography>
      <Grid container spacing={{ xs: 4, md: 6 }} sx={{ alignItems: 'center' }} aria-hidden="true">
        <Grid size={{ xs: 12, md: 7 }} className="sp-fade">
          <Skeleton variant="rounded" width={300} height={28} sx={{ borderRadius: 999, mb: 2.5 }} />
          <Skeleton variant="text" sx={{ fontSize: '4rem', width: '85%' }} />
          <Skeleton variant="text" sx={{ fontSize: '4rem', width: '50%' }} />
          <Skeleton variant="text" sx={{ mt: 2, maxWidth: 590 }} />
          <Skeleton variant="text" sx={{ maxWidth: 560 }} />
          <Skeleton variant="rounded" width={200} height={52} sx={{ borderRadius: 999, mt: 3.5 }} />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Box className="sp-fade" sx={(t) => ({ ...panel(t, { elevation: 'high', radius: RADIUS.panel }), p: 2.25 })}>
            <Skeleton variant="text" width={200} sx={{ fontSize: '1.25rem' }} />
            <Skeleton variant="text" width="80%" sx={{ mb: 1.5 }} />
            <Stack spacing={1}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rounded" height={66} sx={{ borderRadius: `${RADIUS.inset}px` }} />
              ))}
            </Stack>
          </Box>
        </Grid>
      </Grid>
      <Box
        aria-hidden="true"
        className="sp-fade"
        sx={(t) => ({
          ...panel(t, { elevation: 'high', radius: RADIUS.panel }),
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '272px 1fr' },
          minHeight: 420,
        })}
      >
        <Box sx={{ p: 2.5, display: { xs: 'none', md: 'block' }, borderRight: 1, borderColor: 'divider' }}>
          <Skeleton variant="circular" width={64} height={64} />
          <Stack spacing={1} sx={{ mt: 3 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={58} sx={{ borderRadius: `${RADIUS.inset}px` }} />
            ))}
          </Stack>
        </Box>
        <Box sx={{ p: { xs: 2, md: 4 } }}>
          <Skeleton variant="text" width={240} />
          <Skeleton variant="text" sx={{ fontSize: '2rem', width: 220, mt: 2 }} />
          <Skeleton variant="text" sx={{ maxWidth: 640 }} />
          <Grid container spacing={2} sx={{ mt: 2 }}>
            {[0, 1, 2, 3].map((i) => (
              <Grid key={i} size={{ xs: 12, sm: 6 }}>
                <Skeleton variant="rounded" height={56} sx={{ borderRadius: `${RADIUS.control}px` }} />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    </Stack>
  )
}

/** Empty state when the API cannot be reached; the card stays put while retrying. */
function LoadError({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <Box
      role="alert"
      className="sp-rise"
      sx={(t) => ({ ...panel(t, { elevation: 'high', radius: RADIUS.panel }), p: { xs: 3, md: 6 }, mt: { xs: 2, md: 6 }, textAlign: 'center', maxWidth: 640, mx: 'auto' })}
    >
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <IconTile tone="rose" size={56}>
          <CloudOff />
        </IconTile>
        {/* the only heading on the page in this state */}
        <Typography variant="h3" component="h1">
          SkillPath can’t load right now
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere', maxWidth: 520 }}>
          {message}
        </Typography>
        <Button variant="contained" size="large" onClick={onRetry} disabled={retrying} startIcon={retrying ? <CircularProgress size={18} color="inherit" /> : <Refresh />}>
          Try again
        </Button>
      </Stack>
    </Box>
  )
}
