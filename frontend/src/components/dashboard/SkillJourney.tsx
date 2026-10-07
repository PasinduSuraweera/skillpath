import Add from '@mui/icons-material/Add'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import Check from '@mui/icons-material/Check'
import Flag from '@mui/icons-material/FlagOutlined'
import School from '@mui/icons-material/SchoolOutlined'
import Speed from '@mui/icons-material/Speed'
import Star from '@mui/icons-material/Star'
import TrackChanges from '@mui/icons-material/TrackChanges'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { m, useMotionValue, useReducedMotion, useScroll, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, ReactNode, RefObject } from 'react'
import type { RoleRecommendation, SkillSuggestion } from '../../api/types'
import { documentTop, useMood } from '../../depth'
import { DotScale, Eyebrow, GlassSheen, IconTile, Meter, Pill, RingGauge } from '../../design/primitives'
import { panel } from '../../design/surfaces'
import { AURORA, FONT, FORCED_COLORS, RADIUS, TONES, gradientText, ink, white } from '../../design/tokens'
import type { Tone } from '../../design/tokens'
import { money, pct } from '../../format'
import { onView, revealChild, useScrollFx } from '../../motion'
import { TECH_AREAS } from '../../questions'
import { scrollToTop } from '../../scroll'

interface Props {
  role: RoleRecommendation
  busy: boolean
  pendingTech: string | null
  onTrySkill: (s: SkillSuggestion) => void
}

/** The next skills the path suggests: the role's most distinctive technologies you do not use yet. */
const NEXT = 3
/** Scroll (px) the pinned path holds still at each end: time to read the first stage and the last. */
const HOLD = 140
/** Vertical scroll per px of sideways travel: a little more than 1, so the stages glide rather than race. */
const PACE = 1.2

type Stage = { key: string; label: string; tone: Tone; icon: ReactNode; title: ReactNode; body: ReactNode }

/**
 * Skills to grow, told as a path from where the visitor is to the role they chose: the role's
 * key technologies they already use, the gap, what to learn next (each one a what-if away),
 * how ready that would make them, and the role itself. It follows the role chosen above.
 *
 * On wide screens with room to spare the section pins below the nav and the five stages pass
 * sideways as the page scrolls on, a progress line filling as they go; the stage at the reading
 * position is in full, the others a step back. Keyboard focus brings its stage into view. On
 * phones, with reduced motion and in short windows it is a vertical timeline that reveals as
 * it arrives. Every figure comes from the result; the readiness projection only counts.
 */
export default function SkillJourney({ role, busy, pendingTech, onTrySkill }: Props) {
  const fx = useScrollFx()
  const tall = useMediaQuery('(min-height: 680px)')
  const pinned = fx && tall
  const section = useRef<HTMLElement>(null)
  useMood(section, 'focus')

  const gap = role.skill_gap
  const have = gap.matched.length
  const typical = gap.typical_count
  const toGo = Math.max(0, typical - have)
  const next = gap.missing.slice(0, NEXT)
  const projected = Math.min(typical, have + next.length)
  const s = role.salary
  const first = gap.missing[0]

  const stages: Stage[] = [
    {
      key: 'have',
      label: 'Where you are',
      tone: 'emerald',
      icon: <Check />,
      title: (
        <>
          {have} <Muted>of {typical}</Muted>
        </>
      ),
      body: (
        <>
          <Typography variant="body2" color="text.secondary">
            key technologies of a {role.label} you already use.
          </Typography>
          {have > 0 ? (
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 2 }}>
              {gap.matched.slice(0, 8).map((tech) => (
                <Pill key={tech} tone="emerald" icon={<Check />}>
                  {tech}
                </Pill>
              ))}
              {have > 8 && <Pill tone="neutral">+{have - 8} more</Pill>}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ mt: 2 }}>
              None yet: every step on this path is a first.
            </Typography>
          )}
        </>
      ),
    },
    {
      key: 'gap',
      label: 'The gap',
      tone: 'amber',
      icon: <TrackChanges />,
      title: toGo ? (
        <>
          {toGo} <Muted>to go</Muted>
        </>
      ) : (
        'None'
      ),
      body: (
        <>
          <Typography variant="body2" color="text.secondary">
            {toGo
              ? `of the technologies that set ${role.label}s apart are not in your toolkit yet. The most distinctive come first.`
              : `You already use every technology that sets ${role.label}s apart.`}
          </Typography>
          <Box sx={{ mt: 2.25 }}>
            <DotScale filled={have} total={typical} tone="emerald" size={11} />
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {have} used · {toGo} to go
          </Typography>
        </>
      ),
    },
    {
      key: 'learn',
      label: 'Learn next',
      tone: 'indigo',
      icon: <School />,
      title: next.length ? `${next.length} to start with` : 'Nothing to add',
      body: next.length ? (
        <Stack component="ul" spacing={1.25} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {next.map((sk) => (
            <Box component="li" key={sk.technology} sx={{ minWidth: 0 }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="subtitle2" component="p" noWrap title={sk.technology} sx={{ minWidth: 0 }}>
                      {sk.technology}
                    </Typography>
                    {sk.wanted && <Star color="secondary" sx={{ fontSize: '0.9375rem', flexShrink: 0 }} titleAccess="on your want-to-learn list" />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" component="p" noWrap>
                    {Math.round(sk.share_pct)}% in role · {sk.lift.toFixed(1)}× avg · {TECH_AREAS[sk.area].title.toLowerCase()}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={busy}
                  onClick={() => onTrySkill(sk)}
                  aria-label={`What if I add ${sk.technology}`}
                  startIcon={busy && pendingTech === sk.technology ? <CircularProgress size={14} /> : <Add />}
                  sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  What if?
                </Button>
              </Stack>
              <Box sx={{ mt: 0.75 }}>
                <Meter value={sk.share_pct / 100} tone="indigo" height={4} />
              </Box>
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          You already use all of the most distinctive ones.
        </Typography>
      ),
    },
    {
      key: 'ready',
      label: 'Readiness',
      tone: 'violet',
      icon: <Speed />,
      title: (
        <>
          {have} → {projected} <Muted>of {typical}</Muted>
        </>
      ),
      body: (
        <>
          <Stack direction="row" sx={{ gap: 2.5, alignItems: 'center' }}>
            <Readiness value={typical ? have / typical : 0} label="now" figure={have} />
            <Box aria-hidden="true" sx={{ color: 'text.secondary', fontSize: '1.25rem' }}>
              →
            </Box>
            <Readiness value={typical ? projected / typical : 0} label={next.length ? `with ${next.length === 1 ? 'it' : `these ${next.length}`}` : 'now'} figure={projected} accent />
          </Stack>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
            Key technologies only. A what-if shows what your match itself would do.
          </Typography>
        </>
      ),
    },
    {
      key: 'role',
      label: 'Your goal',
      tone: 'violet',
      icon: <Flag />,
      title: <Box component="span" sx={(t) => gradientText(t)}>{role.label}</Box>,
      body: (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5 }}>
            <Figure value={pct(role.probability)} label="match now" />
            <Figure value={s.available && s.median != null ? money(s.median) : '–'} label="median pay" />
            <Figure value={`${Math.round(role.ai_outlook.exposure_now)}/100`} label="AI tasks" />
          </Box>
          {first && (
            <Button
              variant="contained"
              fullWidth
              disabled={busy}
              onClick={() => onTrySkill(first)}
              startIcon={busy && pendingTech === first.technology ? <CircularProgress size={18} color="inherit" /> : <AutoAwesome />}
              sx={{ mt: 2.5 }}
            >
              Take the first step: {first.technology}
            </Button>
          )}
        </>
      ),
    },
  ]

  return (
    <Box ref={section} component="section" id="path" aria-labelledby="path-title" className="no-print" sx={{ scrollMarginTop: 96 }}>
      {pinned ? <Pinned role={role} stages={stages} section={section} /> : <Timeline role={role} stages={stages} />}
    </Box>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.6em', letterSpacing: '-0.01em' }}>
      {children}
    </Box>
  )
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }} noWrap>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" noWrap>
        {label}
      </Typography>
    </Box>
  )
}

function Readiness({ value, label, figure, accent }: { value: number; label: string; figure: number; accent?: boolean }) {
  return (
    <Stack sx={{ alignItems: 'center', gap: 0.75 }}>
      <RingGauge value={value} size={84} thickness={8} glow={!!accent} tone={accent ? undefined : 'emerald'}>
        <Typography component="span" sx={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
          {figure}
        </Typography>
      </RingGauge>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  )
}

function Heading({ role }: { role: RoleRecommendation }) {
  return (
    <>
      <Eyebrow tone="indigo">Your path</Eyebrow>
      <Typography variant="h3" component="h2" id="path-title" sx={{ mt: 0.5, textWrap: 'balance' }}>
        Skills to grow on your way to {role.label}
      </Typography>
    </>
  )
}

/** One stage of the path, on glass. */
function StageCard({ stage, n, motion, style }: { stage: Stage; n: number; motion?: Record<string, unknown>; style?: Record<string, unknown> }) {
  return (
    <Box
      component={m.article}
      aria-labelledby={`path-${stage.key}`}
      {...motion}
      style={style}
      sx={(t) => ({
        ...panel(t, { elevation: 'mid', radius: RADIUS.panel }),
        position: 'relative',
        isolation: 'isolate',
        p: { xs: 2.25, sm: 3 },
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        height: '100%',
        minHeight: { md: 'min(340px, 42vh)' },
      })}
    >
      <GlassSheen />
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, mb: 2 }}>
        <IconTile tone={stage.tone} size={36}>
          {stage.icon}
        </IconTile>
        <Typography variant="overline" color="text.secondary" component="p" id={`path-${stage.key}`} sx={{ lineHeight: 1.4, flexGrow: 1 }}>
          {stage.label}
        </Typography>
        <Typography aria-hidden="true" sx={{ fontFamily: FONT.mono, fontSize: '0.75rem', color: 'text.secondary' }}>
          0{n + 1}
        </Typography>
      </Stack>
      <Typography component="p" sx={{ fontWeight: 720, fontSize: { xs: '1.75rem', md: '2rem' }, letterSpacing: '-0.04em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', mb: 1, overflowWrap: 'anywhere' }}>
        {stage.title}
      </Typography>
      <Box sx={{ minWidth: 0 }}>{stage.body}</Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Wide screens: pinned, the stages passing sideways
// ---------------------------------------------------------------------------

function Pinned({ role, stages, section }: { role: RoleRecommendation; stages: Stage[]; section: RefObject<HTMLElement | null> }) {
  const track = useRef<HTMLDivElement>(null)
  // how far the track travels sideways (px): its width beyond the content column
  const travel = useMotionValue(0)
  const [distance, setDistance] = useState(0)
  useLayoutEffect(() => {
    const el = track.current
    if (!el) return
    const measure = () => {
      const over = Math.max(0, el.scrollWidth - (el.parentElement?.clientWidth ?? el.clientWidth))
      travel.set(over)
      setDistance(Math.round(over * PACE + 2 * HOLD))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [travel])

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  // 0-1 along the path, after the hold at the start and before the one at the end
  const along = useTransform(() => {
    const p = scrollYProgress.get()
    const moving = travel.get() * PACE
    if (!moving) return 0
    return Math.min(1, Math.max(0, (p * (moving + 2 * HOLD) - HOLD) / moving))
  })
  const x = useTransform(() => -along.get() * travel.get())

  // a stage receiving keyboard focus is brought into view first
  const show = (i: number) => (e: FocusEvent) => {
    const el = section.current
    if (!el || !e.currentTarget.contains(e.target as Node)) return
    const target = documentTop(el) + HOLD + (i / (stages.length - 1)) * travel.get() * PACE
    if (Math.abs(window.scrollY - target) > 40) scrollToTop(target, false)
  }

  return (
    // tall enough to scroll the whole path while its stage stays pinned
    <Box sx={{ position: 'relative', height: `calc(100vh + ${distance}px)` }}>
      {/* the stage sits a little above the middle, under the nav, like a page held at reading height */}
      <Box sx={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', pt: '88px', pb: '9vh' }}>
        <m.div {...onView(true)}>
          <Stack direction="row" sx={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 3, mb: 3 }}>
            <Box component={m.div} {...revealChild('fadeUp')} sx={{ minWidth: 0 }}>
              <Heading role={role} />
            </Box>
            <Box component={m.div} {...revealChild('fadeIn')} sx={{ flexShrink: 0, width: 320, display: { xs: 'none', lg: 'block' } }}>
              <Rail stages={stages} along={along} />
            </Box>
          </Stack>
        </m.div>
        <Box sx={{ position: 'relative' }}>
          <Box component={m.div} ref={track} style={{ x }} sx={{ display: 'flex', gap: 3, width: 'max-content', alignItems: 'stretch' }}>
            {stages.map((stage, i) => (
              <Box key={stage.key} onFocus={show(i)} sx={{ width: 'min(390px, 32vw)', flexShrink: 0 }}>
                <Focused i={i} n={stages.length} along={along}>
                  {(style) => <StageCard stage={stage} n={i} style={style} />}
                </Focused>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

/** The stage at the reading position is in full; the others sit a step back (on the glass itself). */
function Focused({ i, n, along, children }: { i: number; n: number; along: MotionValue<number>; children: (style: Record<string, unknown>) => ReactNode }) {
  const distance = useTransform(along, (a) => Math.abs(a * (n - 1) - i))
  const opacity = useTransform(distance, [0.55, 1.6], [1, 0.5])
  const scale = useTransform(distance, [0.55, 1.6], [1, 0.95])
  return <>{children({ opacity, scale })}</>
}

/** Progress along the path: a line that fills, with a mark per stage that lights as it is reached. */
function Rail({ stages, along }: { stages: Stage[]; along: MotionValue<number> }) {
  return (
    <Box aria-hidden="true" sx={{ position: 'relative', height: 28 }}>
      <Box sx={(t) => ({ position: 'absolute', left: 6, right: 6, top: 6, height: 2, borderRadius: 2, bgcolor: ink(0.1), ...t.applyStyles('dark', { bgcolor: white(0.1) }) })} />
      <Box
        component={m.div}
        style={{ scaleX: along }}
        sx={{ position: 'absolute', left: 6, right: 6, top: 6, height: 2, borderRadius: 2, transformOrigin: 'left', backgroundImage: `linear-gradient(90deg, ${AURORA[3]}, ${AURORA[0]} 40%, ${AURORA[1]})`, [FORCED_COLORS]: { bgcolor: 'Highlight' } }}
      />
      {stages.map((s, i) => (
        <RailMark key={s.key} i={i} n={stages.length} along={along} tone={s.tone} label={s.label} />
      ))}
    </Box>
  )
}

function RailMark({ i, n, along, tone, label }: { i: number; n: number; along: MotionValue<number>; tone: Tone; label: string }) {
  const at = i / (n - 1)
  const lit = useTransform(along, [Math.max(0, at - 0.12), at], [0, 1])
  return (
    <Box sx={{ position: 'absolute', left: `calc(${at * 100}% - ${at * 12}px)`, top: 0, width: 14, display: 'grid', justifyItems: 'center' }} title={label}>
      <Box sx={(t) => ({ width: 14, height: 14, borderRadius: '50%', bgcolor: white(0.9), border: `2px solid ${ink(0.14)}`, ...t.applyStyles('dark', { bgcolor: '#151a33', border: `2px solid ${white(0.16)}` }) })} />
      <Box
        component={m.div}
        style={{ opacity: lit, scale: lit }}
        sx={(t) => ({ position: 'absolute', top: 0, width: 14, height: 14, borderRadius: '50%', bgcolor: TONES[tone].light, boxShadow: `0 0 0 4px ${TONES[tone].light}22`, ...t.applyStyles('dark', { bgcolor: TONES[tone].dark }) })}
      />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Phones, reduced motion, short windows: a vertical timeline
// ---------------------------------------------------------------------------

function Timeline({ role, stages }: { role: RoleRecommendation; stages: Stage[] }) {
  const list = useRef<HTMLOListElement>(null)
  const reduce = useReducedMotion()
  // the line down the timeline fills as the visitor reads down it
  const { scrollYProgress } = useScroll({ target: list, offset: ['start 75%', 'end 60%'] })
  const fill = useTransform(scrollYProgress, (p) => (reduce ? 1 : p))
  return (
    <m.div {...onView(true)}>
      <Box component={m.div} {...revealChild('fadeUp')} sx={{ mb: 2.5 }}>
        <Heading role={role} />
      </Box>
      <Box component="ol" ref={list} sx={{ position: 'relative', listStyle: 'none', m: 0, p: 0, pl: { xs: 3, sm: 4 }, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2 }}>
        <Box aria-hidden="true" sx={(t) => ({ position: 'absolute', left: { xs: 7, sm: 11 }, top: 8, bottom: 8, width: 2, borderRadius: 2, bgcolor: ink(0.1), ...t.applyStyles('dark', { bgcolor: white(0.1) }) })} />
        <Box
          component={m.div}
          aria-hidden="true"
          style={{ scaleY: fill }}
          sx={{ position: 'absolute', left: { xs: 7, sm: 11 }, top: 8, bottom: 8, width: 2, borderRadius: 2, transformOrigin: 'top', backgroundImage: `linear-gradient(${AURORA[3]}, ${AURORA[0]} 50%, ${AURORA[1]})` }}
        />
        {stages.map((stage, i) => (
          <Box component="li" key={stage.key} sx={{ position: 'relative', minWidth: 0 }}>
            <Box
              aria-hidden="true"
              sx={(t) => ({
                position: 'absolute',
                left: { xs: -24, sm: -29 },
                top: 26,
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: TONES[stage.tone].light,
                boxShadow: `0 0 0 4px ${TONES[stage.tone].light}22`,
                ...t.applyStyles('dark', { bgcolor: TONES[stage.tone].dark }),
              })}
            />
            <StageCard stage={stage} n={i} motion={revealChild('glassLift')} />
          </Box>
        ))}
      </Box>
    </m.div>
  )
}
