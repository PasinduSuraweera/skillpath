import ArrowForward from '@mui/icons-material/ArrowForward'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { m, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import type { Options } from '../api/types'
import { GradientText, Pill } from '../design/primitives'
import { panel } from '../design/surfaces'
import { RADIUS, ink, white } from '../design/tokens'
import { TRANSITION, useScrollFx } from '../motion'
import type { Sample } from '../samples'
import { Glow } from './AmbientBackground'
import SampleBar from './SampleBar'

interface Props {
  options: Options
  /** play the entrance (first visit only, not when coming back from the results) */
  intro: boolean
  onPick: (s: Sample) => void
  onStart: () => void
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

/** The start page: what SkillPath does, what it is built on, and two ways in (your own answers, or an example). */
export default function Hero({ options, intro, onPick, onStart, disabled, activeId }: Props) {
  const families = new Set(options.job_roles.map((r) => r.family)).size

  // Scrolling away, the hero hands over to the questionnaire: the headline column rises a
  // little faster than the page, settles slightly smaller and fades back; the glass panel
  // drifts more slowly than the text, and the glows behind both more slowly still (Glow
  // depth), so the layers separate. Over the hero's own height, wide screens only, and
  // never below 35% opacity: someone who stops scrolling halfway can still read it.
  const ref = useRef<HTMLElement>(null)
  const fx = useScrollFx()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const textY = useTransform(scrollYProgress, [0, 1], [0, fx ? -70 : 0])
  const textScale = useTransform(scrollYProgress, [0, 1], [1, fx ? 0.965 : 1])
  const textOpacity = useTransform(scrollYProgress, [0.1, 0.85], [1, fx ? 0.35 : 1])
  const panelY = useTransform(scrollYProgress, [0, 1], [0, fx ? -30 : 0])

  return (
    <Box ref={ref} component="section" aria-labelledby="hero-title" className="no-print" sx={{ position: 'relative', isolation: 'isolate', pt: { xs: 2, md: 5 } }}>
      {/* colour for the glass to catch: behind the headline and behind the examples panel */}
      <Glow color="#6366f1" size={560} depth={1} sx={{ top: -180, left: -220 }} />
      <Glow color="#d946ef" size={480} depth={0.7} strength={[0.22, 0.3]} sx={{ top: 40, right: -140, display: { xs: 'none', md: 'block' } }} />
      <Glow color="#22d3ee" size={360} depth={0.5} strength={[0.2, 0.22]} sx={{ bottom: -80, right: '22%', display: { xs: 'none', md: 'block' } }} />

      <Grid container spacing={{ xs: 4, md: 6 }} sx={{ alignItems: 'center' }}>
        <Grid size={{ xs: 12, md: 7 }}>
          {/* text only in here: this wrapper fades, which a glass surface inside would not survive */}
          <Box component={m.div} style={{ y: textY, scale: textScale, opacity: textOpacity }} sx={{ transformOrigin: '0% 30%' }}>
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
          {/* moves only (a transform), so the glass inside keeps blurring */}
          <m.div style={{ y: panelY }}>
          {/* glass: its entrance is on the panel itself, without the blur-in (a filter or a fading
              wrapper would stop the panel blurring the page behind it) */}
          <Box
            component={m.div}
            initial={{ opacity: 0, y: intro ? 24 : 0, scale: intro ? 0.98 : 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...TRANSITION.enter, duration: intro ? 0.7 : TRANSITION.medium.duration, delay: intro ? 0.3 : 0 }}
            sx={(t) => ({ ...panel(t, { elevation: 'high', radius: RADIUS.panel }), p: { xs: 1.75, sm: 2.25 } })}
          >
            <SampleBar onPick={onPick} disabled={disabled} activeId={activeId} />
          </Box>
          </m.div>
        </Grid>
      </Grid>
    </Box>
  )
}
