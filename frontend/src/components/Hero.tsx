import ArrowForward from '@mui/icons-material/ArrowForward'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import South from '@mui/icons-material/South'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'
import { animate, m, useMotionValue, useScroll, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Options } from '../api/types'
import { LAYER, SPEED, useDepth, useMood, usePointerDepth } from '../depth'
import { GradientText, Pill, RingGauge } from '../design/primitives'
import { panel } from '../design/surfaces'
import { HOVER, RADIUS, ink, mergeStyles, white } from '../design/tokens'
import { TRANSITION, useScrollFx } from '../motion'
import type { Sample } from '../samples'
import { Glow } from './AmbientBackground'
import Constellation from './Constellation'
import SampleBar from './SampleBar'

interface Props {
  options: Options
  /** play the entrance (first visit only, not when coming back from the results) */
  intro: boolean
  onPick: (s: Sample) => void
  /** get recommendations for the example just picked, without scrolling down to the questionnaire */
  onRun: () => void
  onStart: () => void
  /** "How it works": the story below the hero */
  onTour: () => void
  disabled: boolean
  activeId: string | null
}

/**
 * One part of the entrance: rises out of a soft blur, in order (`i`), on the first visit only.
 * The filter is removed at the end, not left at blur(0): any filter makes the element a
 * backdrop root, and the glass inside it would stop blurring the page behind.
 */
function Enter({ i, intro, children }: { i: number; intro: boolean; children: ReactNode }) {
  return (
    <m.div
      initial={intro ? { opacity: 0, y: 18, filter: 'blur(8px)' } : { opacity: 0 }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
      transition={{ ...TRANSITION.enter, duration: intro ? 0.6 : TRANSITION.medium.duration, delay: intro ? 0.06 + i * 0.08 : 0 }}
    >
      {children}
    </m.div>
  )
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 700, fontSize: { xs: '1.375rem', sm: '1.625rem' }, letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p">
        {label}
      </Typography>
    </Box>
  )
}

/**
 * A small piece of glass floating in front of the examples panel, showing what SkillPath gives
 * back (real figures for the first example). The front layer: it runs slightly ahead of the
 * scroll (1.12×) and leans towards the mouse further than anything behind it, which is what
 * makes the composition read as depth. Decoration (the panel beside it holds the real thing),
 * so hidden from screen readers and never in the way of a click.
 */
function Fragment({ fx, intro, delay, reach, progress, children, sx }: { fx: boolean; intro: boolean; delay: number; reach: number; progress: MotionValue<number>; children: ReactNode; sx: SxProps<Theme> }) {
  const ref = useRef<HTMLDivElement>(null)
  const depth = useDepth(ref, SPEED.foreground, fx)
  const pull = usePointerDepth(reach, fx)
  const y = useTransform(() => depth.get() + pull.y.get())
  // it fades in once, and dissolves early in the hand-off: running ahead of the panel, it would
  // otherwise pass over the examples' text. Both on the glass itself (see SurfaceMotion).
  const shown = useMotionValue(intro ? 0 : 1)
  useEffect(() => {
    const run = animate(shown, 1, { ...TRANSITION.enter, duration: intro ? 0.8 : 0.3, delay: intro ? delay : 0 })
    return () => run.stop()
  }, [shown, intro, delay])
  const leaving = useTransform(progress, [0.03, 0.2], [1, 0])
  const opacity = useTransform(() => shown.get() * leaving.get())
  return (
    <Box ref={ref} aria-hidden="true" sx={[{ position: 'absolute', zIndex: 2, pointerEvents: 'none', display: { xs: 'none', md: 'block' } }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box component={m.div} style={{ x: pull.x, y }} sx={fx ? LAYER : undefined}>
        {/* glass: its entrance (a fade and a settle) is on the glass itself (see SurfaceMotion) */}
        <Box
          component={m.div}
          initial={{ scale: intro ? 0.9 : 1 }}
          animate={{ scale: 1 }}
          transition={{ ...TRANSITION.enter, duration: intro ? 0.8 : 0.3, delay: intro ? delay : 0 }}
          style={{ opacity }}
          sx={(t) =>
            mergeStyles(panel(t, { elevation: 'high', radius: 18 }), {
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              px: 1.5,
              py: 1.25,
              whiteSpace: 'nowrap',
            })
          }
        >
          {children}
        </Box>
      </Box>
    </Box>
  )
}

/**
 * The start page: what SkillPath does, what it is built on, and two ways in (your own answers,
 * or an example). On wide screens it fills the window as one layered scene, back to front:
 * the aurora, the glows, a constellation of technologies, the glass examples panel, the text,
 * and two floating fragments of a result. Each layer moves at its own speed as the page
 * scrolls (depth.ts), so the scene comes apart in depth as it hands over to the story below.
 */
export default function Hero({ options, intro, onPick, onRun, onStart, onTour, disabled, activeId }: Props) {
  const families = new Set(options.job_roles.map((r) => r.family)).size

  // Scrolling away: the headline column rises ahead of the page, settles slightly smaller and
  // fades back (never below 30%: someone who stops halfway can still read it); the glass panel
  // lags behind the page (the glass layer), the constellation further still, the glows behind
  // all of them furthest; the fragments in front run ahead. Wide screens only.
  const ref = useRef<HTMLElement>(null)
  const fx = useScrollFx()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const textY = useTransform(scrollYProgress, [0, 1], [0, fx ? -90 : 0])
  const textScale = useTransform(scrollYProgress, [0, 1], [1, fx ? 0.96 : 1])
  const textOpacity = useTransform(scrollYProgress, [0.12, 0.85], [1, fx ? 0.3 : 1])
  const stage = useRef<HTMLDivElement>(null)
  const panelY = useDepth(stage, SPEED.glass, fx)
  // the cue to scroll has said its piece once the page moves
  const cueOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0])
  useMood(ref, 'dawn')

  return (
    <Box
      ref={ref}
      component="section"
      aria-labelledby="hero-title"
      className="no-print"
      sx={{
        position: 'relative',
        isolation: 'isolate',
        pt: { xs: 2, md: 5 },
        // wide screens: the scene fills the window under the nav (but never squeezes a short one)
        '@media (min-width: 900px) and (min-height: 700px)': { minHeight: 'calc(100svh - 100px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', pt: 2, pb: 9 },
      }}
    >
      {/* the light layer: colour for the glass to catch, each glow at its own depth */}
      <Glow color="#6366f1" size={620} speed={0.5} sx={{ top: -200, left: -240 }} />
      <Glow color="#d946ef" size={520} speed={0.62} strength={[0.22, 0.3]} sx={{ top: 20, right: -160, display: { xs: 'none', md: 'block' } }} />
      <Glow color="#22d3ee" size={400} speed={0.7} strength={[0.2, 0.22]} sx={{ bottom: -120, right: '24%', display: { xs: 'none', md: 'block' } }} />

      <Grid container spacing={{ xs: 4, md: 6 }} sx={{ alignItems: 'center' }}>
        <Grid size={{ xs: 12, md: 7 }}>
          {/* text only in here: this wrapper fades, which a glass surface inside would not survive */}
          <Box component={m.div} style={{ y: textY, scale: textScale, opacity: textOpacity }} sx={{ transformOrigin: '0% 30%', ...(fx && LAYER) }}>
            <Enter i={0} intro={intro}>
              <Pill tone="indigo" icon={<AutoAwesome />} sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem', mb: 2.5, border: '1px solid', borderColor: 'rgba(79, 70, 229, 0.18)' }}>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Career intelligence from the 2025 Stack Overflow survey
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  Built on the 2025 Stack Overflow survey
                </Box>
              </Pill>
            </Enter>
            <Enter i={1} intro={intro}>
              <Typography variant="h1" id="hero-title" tabIndex={-1} sx={{ maxWidth: 680, textWrap: 'balance' }}>
                Which developer role <GradientText>fits you?</GradientText>
              </Typography>
            </Enter>
            <Enter i={2} intro={intro}>
              <Typography color="text.secondary" sx={{ mt: 2.5, maxWidth: 590, fontSize: { xs: '1.0625rem', md: '1.1875rem' }, lineHeight: 1.55, textWrap: 'pretty' }}>
                Answer three short steps about your skills and how you use AI. SkillPath compares your profile with about
                18,000 developers and shows your three closest job roles, with each role’s AI outlook, typical pay and the
                skills to grow next.
              </Typography>
            </Enter>
            <Enter i={3} intro={intro}>
              <Stack direction="row" sx={{ mt: 3.5, alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Button variant="contained" size="large" endIcon={<ArrowForward />} onClick={onStart} disabled={disabled}>
                  Build my profile
                </Button>
                <Typography variant="body2" color="text.secondary">
                  Three steps · every question is optional
                </Typography>
              </Stack>
            </Enter>
            <Enter i={4} intro={intro}>
              <Box
                sx={(t) => ({
                  mt: { xs: 4, md: 5 },
                  display: 'inline-grid',
                  gridTemplateColumns: 'repeat(3, auto)',
                  columnGap: { xs: 2.5, sm: 4 },
                  px: { xs: 2, sm: 2.75 },
                  py: 1.75,
                  borderRadius: `${RADIUS.card}px`,
                  bgcolor: white(0.42),
                  border: `1px solid ${white(0.7)}`,
                  boxShadow: `inset 0 1px 0 ${white(0.8)}, 0 1px 2px ${ink(0.04)}`,
                  ...t.applyStyles('dark', { bgcolor: white(0.04), border: `1px solid ${white(0.08)}`, boxShadow: `inset 0 1px 0 ${white(0.05)}` }),
                  '& > * + *': { pl: { xs: 2.5, sm: 4 }, borderLeft: 1, borderColor: 'divider' },
                })}
              >
                <Stat value="18k" label="developers compared" />
                <Stat value={options.job_roles.length} label="job roles" />
                <Stat value={families} label="career families" />
              </Box>
            </Enter>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          {/* the stage: the constellation behind the panel, the fragments in front of it */}
          <Box ref={stage} sx={{ position: 'relative', isolation: 'isolate' }}>
            <Constellation fx={fx} intro={intro} progress={scrollYProgress} />
            {/* moves only (a transform), so the glass inside keeps blurring */}
            <Box component={m.div} style={{ y: panelY }} sx={fx ? LAYER : undefined}>
              {/* glass: its entrance is on the panel itself, without the blur-in (a filter or a fading
                  wrapper would stop the panel blurring the page behind it) */}
              <Box
                component={m.div}
                initial={{ opacity: 0, y: intro ? 24 : 0, scale: intro ? 0.98 : 1 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...TRANSITION.enter, duration: intro ? 0.7 : TRANSITION.medium.duration, delay: intro ? 0.3 : 0 }}
                sx={(t) => ({ ...panel(t, { elevation: 'high', radius: RADIUS.panel }), p: { xs: 1.75, sm: 2.25 } })}
              >
                <SampleBar onPick={onPick} onRun={onRun} disabled={disabled} activeId={activeId} />
              </Box>
            </Box>

            {/* what comes back, for the first example: its best match ... */}
            <Fragment fx={fx} intro={intro} delay={0.75} reach={22} progress={scrollYProgress} sx={{ top: -44, right: -30 }}>
              <RingGauge value={0.638} size={44} thickness={5} glow={false}>
                <Typography component="span" sx={{ fontSize: '0.6875rem', fontWeight: 750, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                  64%
                </Typography>
              </RingGauge>
              <Box>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 650, lineHeight: 1.25 }}>Full-stack Developer</Typography>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ lineHeight: 1.3 }}>
                  Best match · example
                </Typography>
              </Box>
            </Fragment>
            {/* ... and what one more skill does to it */}
            <Fragment fx={fx} intro={intro} delay={0.9} reach={28} progress={scrollYProgress} sx={{ bottom: -40, left: -56 }}>
              <Pill tone="violet" sx={{ fontSize: '0.75rem' }}>
                + TypeScript
              </Pill>
              <Box>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 650, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>
                  64% → 66%
                </Typography>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ lineHeight: 1.3 }}>
                  Full-stack · what if…?
                </Typography>
              </Box>
            </Fragment>
          </Box>
        </Grid>
      </Grid>

      {/* where the story continues: a quiet cue at the foot of the scene, gone once the page moves */}
      <Box
        component={m.div}
        style={{ opacity: cueOpacity }}
        sx={{ position: 'absolute', left: 0, right: 0, bottom: 16, display: 'none', justifyContent: 'center', '@media (min-width: 900px) and (min-height: 700px)': { display: 'flex' } }}
      >
        <m.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TRANSITION.enter, delay: intro ? 1.2 : 0 }}>
          <ButtonBase
            onClick={onTour}
            sx={(t) => ({
              gap: 1,
              px: 1.75,
              py: 0.75,
              borderRadius: 999,
              color: 'text.secondary',
              fontSize: '0.8125rem',
              fontWeight: 550,
              transition: 'color 150ms ease, background-color 150ms ease',
              '& svg': { fontSize: 16, transition: 'transform 220ms cubic-bezier(0.23, 1, 0.32, 1)' },
              [HOVER]: { '&:hover': { color: 'text.primary', bgcolor: ink(0.05), ...t.applyStyles('dark', { bgcolor: white(0.06) }) }, '&:hover svg': { transform: 'translateY(2px)' } },
            })}
          >
            How SkillPath works
            <South />
          </ButtonBase>
        </m.div>
      </Box>
    </Box>
  )
}
