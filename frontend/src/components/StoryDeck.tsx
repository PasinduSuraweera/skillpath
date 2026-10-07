import ArrowForward from '@mui/icons-material/ArrowForward'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { m, useScroll, useTransform } from 'motion/react'
import { Fragment, createRef, useRef, useState } from 'react'
import type { ReactNode, Ref, RefObject } from 'react'
import { LAYER, useMood } from '../depth'
import { Eyebrow, GlassSheen, IconTile, Meter, Pill } from '../design/primitives'
import { panel } from '../design/surfaces'
import { AURORA, FONT, FORCED_COLORS, RADIUS, gradientText, ink, insetFill, white } from '../design/tokens'
import type { Tone } from '../design/tokens'
import { onView, revealChild, useCountUp, useScrollFx, useSeen } from '../motion'
import { STEPS } from '../steps'

/** Where a stuck card's top sits (px from the top of the window): below the nav, each one a step lower. */
const STACK_TOP = 104
const STACK_STEP = 14

/** Questions per step of the questionnaire (About you, Technologies, AI usage). */
const STEP_QUESTIONS = ['4 questions', '7 technology areas', '5 questions']

/** The first example's real result, and the same profile with TypeScript added (GET /api/predict). */
const EXAMPLE = [
  { label: 'Full-stack Developer', value: 0.638 },
  { label: 'Back-end Developer', value: 0.234 },
  { label: 'Desktop / Enterprise Developer', value: 0.028 },
]

interface Chapter {
  n: string
  chapter: string
  tone: Tone
  title: string
  body: string
  visual: ReactNode
}

/**
 * "How SkillPath works": the journey from answers to a next skill, told in four chapters before
 * the questionnaire. On wide screens it is a deck of glass cards: each one sticks below the nav
 * as it arrives, and the next slides up over it while it sinks back (slightly smaller, dimmed),
 * so the story is read one chapter at a time without leaving the page. On phones and with
 * reduced motion the cards simply follow each other and reveal as they arrive.
 */
export default function StoryDeck({ roles, families, ref }: { roles: number; families: number; ref?: Ref<HTMLElement> }) {
  const fx = useScrollFx()
  const section = useRef<HTMLDivElement>(null)
  useMood(section, 'focus')
  const [marks] = useState(() => Array.from({ length: 4 }, () => createRef<HTMLDivElement>()))

  const chapters: Chapter[] = [
    {
      n: '01',
      chapter: 'Discover yourself',
      tone: 'indigo',
      title: 'Tell SkillPath how you work',
      body: 'Three short steps: your background, the technologies you use and want to learn, and how you work with AI. Every question is optional.',
      visual: <StepsVisual />,
    },
    {
      n: '02',
      chapter: 'Understand your skills',
      tone: 'cyan',
      title: 'Measured against real developers',
      body: 'Your answers are compared with about 18,000 respondents of the 2025 Stack Overflow survey, by a model that learned which skills go with which job.',
      visual: <CrowdVisual />,
    },
    {
      n: '03',
      chapter: 'Explore career paths',
      tone: 'violet',
      title: 'Your three closest roles',
      body: `Out of ${roles} job roles in ${families} career families, the three that fit you best, each with its AI outlook, typical pay and the skills that set it apart.`,
      visual: <RolesVisual />,
    },
    {
      n: '04',
      chapter: 'Reach your goal',
      tone: 'emerald',
      title: 'Grow with what-ifs',
      body: 'Add a skill you could learn and see what moves: your match, your readiness, even which roles make your top three. Every run is kept, so you can compare.',
      visual: <WhatIfVisual />,
    },
  ]

  return (
    <Box ref={ref} component="section" aria-labelledby="story-title" className="no-print" sx={{ position: 'relative', scrollMarginTop: 88 }}>
      <Box ref={section}>
        <Box component={m.div} {...onView(true)} sx={{ maxWidth: 720, mb: { xs: 3, md: 5 } }}>
          <m.div {...revealChild('fadeUp')}>
            <Eyebrow tone="cyan">How SkillPath works</Eyebrow>
          </m.div>
          <Typography variant="h2" id="story-title" component={m.h2} {...revealChild('fadeUp')} sx={{ mt: 0.75, textWrap: 'balance' }}>
            From your answers to <Box component="span" sx={(t) => gradientText(t)}>your next skill</Box>
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: fx ? 0 : 2.5 }}>
          {chapters.map((c, i) => (
            <Fragment key={c.n}>
              {/* where the card sits in the page before it sticks: scroll effects are measured from
                  these, since a stuck element reports its stuck position instead */}
              <Box ref={marks[i]} aria-hidden="true" sx={{ height: 0 }} />
              <Card chapter={c} i={i} mark={marks[i]} next={marks[i + 1]} stacked={fx} />
            </Fragment>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

function Card({ chapter, i, mark, next, stacked }: { chapter: Chapter; i: number; mark: RefObject<HTMLDivElement | null>; next?: RefObject<HTMLDivElement | null>; stacked: boolean }) {
  const top = STACK_TOP + i * STACK_STEP
  const nextTop = top + STACK_STEP
  // sinking back while the next card slides over it: from the next card's appearance at the foot
  // of the window until it has stuck just below this one
  const { scrollYProgress: under } = useScroll({ target: next, offset: ['start end', `start ${nextTop}px`] })
  const recede = stacked && !!next
  const scale = useTransform(under, [0, 1], [1, recede ? 0.94 : 1])
  const dim = useTransform(under, [0.3, 1], [0, recede ? 0.62 : 0])
  // the first card arrives with the hero handing over: it rises into place as it comes up the window
  const { scrollYProgress: arrival } = useScroll({ target: mark, offset: ['start end', 'start 55%'] })
  const y = useTransform(arrival, [0, 1], [stacked && i === 0 ? 70 : 0, 0])

  return (
    <Box
      sx={{
        ...(stacked && {
          position: 'sticky',
          top,
          // each card holds the stage for a while before the next arrives
          mb: next ? '18vh' : 0,
        }),
      }}
    >
      {/* glass: moves and scales itself (a transform), and its entrance fade is on itself too */}
      <Box
        component={m.article}
        aria-labelledby={`story-${chapter.n}`}
        style={stacked ? { scale, y, transformOrigin: '50% 0%' } : undefined}
        {...(stacked ? {} : onView(true, 'glassLift'))}
        sx={(t) => ({
          ...panel(t, { elevation: 'high', radius: RADIUS.panel }),
          ...(stacked && LAYER),
          position: 'relative',
          isolation: 'isolate',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1.05fr)' },
          gap: { xs: 3, md: 5 },
          alignItems: 'center',
          p: { xs: 2.5, sm: 3.5, md: 5 },
          minHeight: { md: 'min(440px, calc(100svh - 200px))' },
        })}
      >
        <GlassSheen />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="p"
            aria-hidden="true"
            sx={(t) => ({ ...gradientText(t), fontWeight: 750, fontSize: { xs: '2.75rem', md: '4.25rem' }, letterSpacing: '-0.06em', lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' })}
          >
            {chapter.n}
          </Typography>
          <Eyebrow tone={chapter.tone} sx={{ mt: { xs: 1.5, md: 2.5 } }}>
            {chapter.chapter}
          </Eyebrow>
          <Typography variant="h3" id={`story-${chapter.n}`} sx={{ mt: 0.75 }}>
            {chapter.title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1.25, maxWidth: 460, textWrap: 'pretty', fontSize: { md: '1.0625rem' } }}>
            {chapter.body}
          </Typography>
        </Box>
        <Box sx={(t) => ({ ...insetFill(t), borderRadius: `${RADIUS.card}px`, border: `1px solid ${t.palette.divider}`, p: { xs: 2, md: 3 }, minWidth: 0 })}>{chapter.visual}</Box>
        {/* dims the card as the next one slides over it */}
        {recede && (
          <Box
            component={m.div}
            aria-hidden="true"
            style={{ opacity: dim }}
            sx={(t) => ({
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              pointerEvents: 'none',
              bgcolor: 'rgba(236, 238, 248, 0.7)',
              ...t.applyStyles('dark', { bgcolor: 'rgba(6, 8, 20, 0.62)' }),
            })}
          />
        )}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// The chapters' pictures: each drawn from the product itself, never invented figures
// ---------------------------------------------------------------------------

function StepsVisual() {
  return (
    <Stack component="ol" sx={{ listStyle: 'none', m: 0, p: 0, gap: 1.25 }} aria-label="The three steps">
      {STEPS.map((s, i) => (
        <Stack
          key={s.title}
          component="li"
          direction="row"
          sx={(t) => ({ alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: `${RADIUS.inset}px`, bgcolor: white(0.6), border: `1px solid ${t.palette.divider}`, ...t.applyStyles('dark', { bgcolor: white(0.04) }) })}
        >
          <IconTile tone={s.tone} size={38}>
            <s.icon />
          </IconTile>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle2" component="p">
              {s.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              {STEP_QUESTIONS[i]}
            </Typography>
          </Box>
          <Typography aria-hidden="true" sx={{ fontFamily: FONT.mono, fontSize: '0.75rem', color: 'text.secondary' }}>
            {i + 1}/3
          </Typography>
        </Stack>
      ))}
    </Stack>
  )
}

/** About 18,000 people, one dot per ~180; the brightest are the ones most like you. */
function CrowdVisual() {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useSeen(ref)
  const near = new Set([31, 32, 44, 45, 46, 57, 58, 59, 71, 72])
  return (
    <Box ref={ref}>
      <CrowdCount seen={seen} />
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
        developers with a job role in the 2025 survey
      </Typography>
      <Box aria-hidden="true" sx={{ mt: 2.25, display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: { xs: '6px', md: '8px' }, maxWidth: 360 }}>
        {Array.from({ length: 98 }, (_, i) => (
          <Box
            key={i}
            sx={(t) => ({
              aspectRatio: '1',
              borderRadius: '50%',
              ...(near.has(i)
                ? { backgroundImage: `linear-gradient(135deg, ${AURORA[3]}, ${AURORA[0]})`, boxShadow: `0 0 0 3px ${alpha(AURORA[3], 0.18)}` }
                : { bgcolor: ink(0.12), ...t.applyStyles('dark', { bgcolor: white(0.12) }) }),
              [FORCED_COLORS]: { border: '1px solid CanvasText' },
            })}
          />
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
        <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', mr: 0.75, backgroundImage: `linear-gradient(135deg, ${AURORA[3]}, ${AURORA[0]})` }} />
        people whose skills look most like yours
      </Typography>
    </Box>
  )
}

/**
 * The crowd's size, counting up once it is in view. Its own component: the count changes every
 * frame for a second, usually mid-scroll, and only this line should re-render, not the dots.
 */
function CrowdCount({ seen }: { seen: boolean }) {
  const { value } = useCountUp(18000, undefined, seen)
  return (
    <Typography component="p" sx={{ fontWeight: 750, fontSize: { xs: '2.25rem', md: '2.75rem' }, letterSpacing: '-0.05em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
      {Math.round(value).toLocaleString('en-US')}
    </Typography>
  )
}

function RolesVisual() {
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" component="p">
          Your top matches
        </Typography>
        <Pill tone="neutral">Example · CS undergrad</Pill>
      </Stack>
      <Stack spacing={1.75}>
        {EXAMPLE.map((r, i) => (
          <Box key={r.label}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2, mb: 0.75 }}>
              <Typography variant="body2" sx={{ fontWeight: i === 0 ? 650 : 450, minWidth: 0 }} noWrap>
                <Box component="span" sx={{ fontFamily: FONT.mono, fontSize: '0.75rem', color: 'text.secondary', mr: 1 }}>
                  #{i + 1}
                </Box>
                {r.label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: i === 0 ? 650 : 450, fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(r.value * 100)}%
              </Typography>
            </Stack>
            <Meter value={r.value} tone={i === 0 ? 'brand' : 'violet'} muted={i > 0} height={7} delay={0.08 * i} />
          </Box>
        ))}
      </Stack>
    </Box>
  )
}

function WhatIfVisual() {
  const rows: { label: string; before: string; after: string }[] = [
    { label: 'Full-stack Developer match', before: '64%', after: '66%' },
    { label: 'Key technologies you use', before: '7 of 15', after: '8 of 15' },
    { label: 'Third closest role', before: 'Desktop', after: 'Front-end' },
  ]
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Pill tone="brand" icon={<AutoAwesome />}>
          What if I add TypeScript?
        </Pill>
        <Pill tone="neutral">Example · CS undergrad</Pill>
      </Stack>
      <Stack spacing={1}>
        {rows.map((r) => (
          <Stack
            key={r.label}
            direction="row"
            sx={(t) => ({ alignItems: 'center', gap: 1.5, px: 1.5, py: 1.125, borderRadius: `${RADIUS.inset}px`, bgcolor: white(0.6), border: `1px solid ${t.palette.divider}`, ...t.applyStyles('dark', { bgcolor: white(0.04) }) })}
          >
            <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }}>
              {r.label}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {r.before}
            </Typography>
            <ArrowForward titleAccess="becomes" sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'success.main' }}>
              {r.after}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}
