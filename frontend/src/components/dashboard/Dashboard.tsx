import EditNote from '@mui/icons-material/EditNote'
import Print from '@mui/icons-material/PrintOutlined'
import RestartAlt from '@mui/icons-material/RestartAlt'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { AnimatePresence, LayoutGroup, m, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useState } from 'react'
import type { Recommendation, SkillSuggestion } from '../../api/types'
import { Eyebrow, SectionHeader } from '../../design/primitives'
import type { Exploration } from '../../explorations'
import type { FormState } from '../../form'
import { pct } from '../../format'
import { OPENING, OPENING_REDUCED, RevealContext, TRANSITION, makeRoom, onView, revealChild, revealMotion } from '../../motion'
import { Glow } from '../AmbientBackground'
import Behind from './Behind'
import Explorations from './Explorations'
import Landscape from './Landscape'
import RoleInsights from './RoleInsights'
import RoleSwitcher from './RoleSwitcher'
import SectionRail from './SectionRail'
import Spotlight from './Spotlight'
import WhatIfPanel from './WhatIfPanel'

type Comparison = { before: Recommendation; changes: string[] }

interface Props {
  result: Recommendation
  /** the answers that produced this result */
  answers: FormState
  comparison: Comparison | null
  busy: boolean
  /** technology whose what-if re-run is in progress */
  pendingTech: string | null
  history: Exploration[]
  currentId: number
  onEdit: () => void
  onRestart: () => void
  onPrint: () => void
  onTrySkill: (s: SkillSuggestion) => void
  onClearComparison: () => void
  onRestore: (e: Exploration) => void
}

/** Results that have been revealed once (see Dashboard). */
const revealed = new WeakSet<Recommendation>()

/**
 * The results, as a career dashboard, in the order a visitor needs them:
 *   1. the headline and the actions (change answers, print, start over)
 *   2. the what-if comparison, when answers were changed
 *   3. the spotlight: the best match, readiness, and the recommended next step
 *   4. the three matches side by side; choosing one focuses the insights below
 *   5. the focused role in detail: AI outlook, pay, and the skill map
 *   6. the career landscape (families, all 20 roles), how the result was reached, the
 *      session's explorations, and the model and data credits
 */
export default function Dashboard(props: Props) {
  const { result, comparison } = props
  const top = result.roles[0]
  const model = result.model

  // the three pay bands share one scale, so their pay can be compared by eye
  const payScale = Math.max(1, ...result.roles.map((r) => (r.salary.available ? (r.salary.p75 ?? 0) : 0)))

  // while a comparison is shown, each card also says how its role moved
  const previous = (job: string) => {
    if (!comparison) return null
    const i = comparison.before.ranking.findIndex((x) => x.job_role === job)
    return i < 0 ? null : { rank: i + 1, probability: comparison.before.ranking[i].probability }
  }

  // The reveal is for a new result. Results returned to (Undo, the nav) fade in as they were
  // left: every part starts in place and the figures do not count up again. Anything that
  // changes after that (a what-if) animates as usual.
  const [first] = useState(result)
  const [fresh] = useState(() => !revealed.has(result))
  // every result shown counts, including one a what-if put on screen
  useLayoutEffect(() => {
    revealed.add(result)
  }, [result])
  const revealing = fresh || result !== first
  // position in the reveal (STAGGER_REVEAL apart)
  const step = (i: number) => revealMotion(i, fresh)
  // the what-if comparison opens above the spotlight (OPENING): the content below slides to
  // its new place (transform only) instead of jumping
  const move = makeRoom(!!comparison)
  const reduce = useReducedMotion()
  // returned to: the page settles into place. Movement only: fading a wrapper would stop the
  // glass inside it blurring the page (SurfaceMotion), so fades are on the surfaces themselves
  const returning = fresh ? {} : { initial: { y: 8 }, animate: { y: 0 }, transition: TRANSITION.medium }

  // the role the detailed insights are about: the best match until another is chosen, and
  // back to the best match if a what-if takes the chosen one out of the top 3
  const [focus, setFocus] = useState(top.job_role)
  const selected = result.roles.find((r) => r.job_role === focus) ?? top
  const others = result.roles.filter((r) => r.job_role !== selected.job_role)

  return (
    <RevealContext.Provider value={revealing}>
      {/* one group, so the content below the comparison slides when it opens and closes */}
      {/* where you are on the page, on wide screens */}
      <SectionRail />
      <LayoutGroup>
        <Stack component={m.div} spacing={{ xs: 3.5, md: 5 }} useFlexGap sx={{ position: 'relative', isolation: 'isolate' }} {...returning}>
          <Glow color="#6366f1" size={620} depth={1} sx={{ top: -160, left: -240 }} />
          <Glow color="#d946ef" size={520} depth={0.8} strength={[0.2, 0.28]} sx={{ top: 220, right: -200, display: { xs: 'none', md: 'block' } }} />
          {/* lower down, colour for the landscape and transparency tiles to refract */}
          <Glow color="#22d3ee" size={560} depth={0.9} strength={[0.18, 0.2]} sx={{ top: '52%', left: -260, display: { xs: 'none', md: 'block' } }} />
          <Glow color="#8b5cf6" size={480} depth={0.7} strength={[0.16, 0.22]} sx={{ top: '74%', right: -220, display: { xs: 'none', md: 'block' } }} />

          {/* headline and actions */}
          <Stack component={m.div} direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-end' }, gap: 2.5, pt: { xs: 1, md: 3 } }} {...step(0)}>
            <Box sx={{ minWidth: 0, maxWidth: 720 }}>
              <Eyebrow tone="violet">
                Career report · {model.classes} roles analysed
              </Eyebrow>
              {/* receives focus when the results arrive, so keyboard and screen reader users start here */}
              <Typography variant="h2" component="h1" id="results-title" tabIndex={-1} sx={{ mt: 0.75, scrollMarginTop: 110 }}>
                Your top job role matches
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1.25, textWrap: 'pretty' }}>
                Your best match is <Box component="strong" sx={{ color: 'text.primary' }}>{top.label}</Box>. Each percentage is how
                likely the model thinks it is that a developer with your answers works in that role, out of {model.classes} roles.
              </Typography>
            </Box>
            <Stack direction="row" className="no-print" sx={{ flexShrink: 0, flexWrap: 'wrap', gap: 1 }}>
              <Button variant="outlined" startIcon={<EditNote />} onClick={props.onEdit}>
                Change answers (what if…?)
              </Button>
              <Button color="inherit" startIcon={<Print />} onClick={props.onPrint}>
                Print / PDF
              </Button>
              <Button color="inherit" startIcon={<RestartAlt />} onClick={props.onRestart}>
                Start over
              </Button>
            </Stack>
          </Stack>

          {/* a comparison returned to (Undo, the nav) is simply there */}
          <AnimatePresence mode="popLayout" initial={false}>
            {comparison && (
              <div key="comparison">
                <WhatIfPanel before={comparison.before} after={result} changes={comparison.changes} onClear={props.onClearComparison} motion={reduce ? OPENING_REDUCED : OPENING} />
              </div>
            )}
          </AnimatePresence>

          <Stack component={m.div} spacing={{ xs: 3.5, md: 5 }} useFlexGap layout="position" transition={{ layout: move }}>
            <Box id="overview" sx={{ scrollMarginTop: 96 }}>
              <Spotlight role={top} busy={props.busy} pendingTech={props.pendingTech} onTrySkill={props.onTrySkill} motion={step(1)} />
            </Box>

            {/* the three matches; choosing one focuses the insights below */}
            <Box component="section" id="compare" aria-labelledby="compare-title">
              <m.div {...step(2)}>
                <SectionHeader
                  eyebrow="Compare"
                  tone="indigo"
                  id="compare-title"
                  title="Your three closest roles"
                  description="Choose a role to see its AI outlook, pay and skills to grow in detail."
                />
              </m.div>
              <Box sx={{ mt: 2.5 }}>
                <RoleSwitcher roles={result.roles} selected={selected.job_role} onSelect={setFocus} previous={previous} revealFrom={2.6} />
              </Box>
            </Box>

            {/* Below the fold from here on: each section reveals as it scrolls into view, its heading
                first and then its tiles, a beat apart (onView / revealChild in motion.ts) */}
            <Box component={m.section} id="role-insights" aria-labelledby="insights-title" {...onView(revealing)}>
              <Typography variant="h4" component={m.h3} id="insights-title" sx={{ mb: 2 }} {...revealChild('fadeUp')}>
                <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  #{selected.rank} ·{' '}
                </Box>
                {selected.label}{' '}
                <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  in detail · {pct(selected.probability)} match
                </Box>
              </Typography>
              {/* the tiles stay; their content changes over with the chosen role */}
              <RoleInsights
                role={selected}
                busy={props.busy}
                pendingTech={props.pendingTech}
                payScale={payScale}
                onTrySkill={props.onTrySkill}
                motion={() => revealChild('glassLift')}
              />
            </Box>

            {/* printed: the other two roles in detail as well (on screen they are one press away) */}
            <Box className="print-only">
              {others.map((r) => (
                <Box key={r.job_role} sx={{ mt: 3 }}>
                  <Typography variant="h4" component="h3" sx={{ mb: 1.5 }}>
                    #{r.rank} · {r.label} in detail · {pct(r.probability)} match
                  </Typography>
                  <RoleInsights role={r} busy={false} pendingTech={null} payScale={payScale} onTrySkill={() => {}} printCopy />
                </Box>
              ))}
            </Box>

            <Box component={m.section} id="landscape" aria-labelledby="landscape-title" {...onView(revealing)}>
              <m.div {...revealChild('fadeUp')}>
                <SectionHeader eyebrow="Career landscape" tone="cyan" id="landscape-title" title="Where your profile points" />
              </m.div>
              <Box sx={{ mt: 2.5 }}>
                <Landscape result={result} motion={() => revealChild('glassLift')} />
              </Box>
            </Box>

            <Box component={m.section} id="behind" aria-labelledby="behind-title" {...onView(revealing)}>
              <m.div {...revealChild('fadeUp')}>
                <SectionHeader eyebrow="Transparency" tone="violet" id="behind-title" title="Behind the result" />
              </m.div>
              <Box sx={{ mt: 2.5 }}>
                <Behind result={result} answers={props.answers} motion={() => revealChild('glassLift')} />
              </Box>
            </Box>

            <Box id="explorations">
              <Explorations history={props.history} currentId={props.currentId} busy={props.busy} onRestore={props.onRestore} motion={onView(revealing, 'glassLift')} />
            </Box>

            {/* the attribution carries a long URL: let it break rather than run off a narrow screen */}
            <Typography variant="caption" color="text.secondary" component="p" sx={{ maxWidth: 900, overflowWrap: 'anywhere', pb: 2 }}>
              Model: {model.name}, tested on {model.test_rows.toLocaleString()} survey respondents it never saw during training. The true
              role was in its top 3 for {pct(model.test_top3_accuracy)} of them
              {` (top 3 career families: ${pct(model.test_family_top3_accuracy)}). `}
              {result.attribution}
            </Typography>
          </Stack>
        </Stack>
      </LayoutGroup>
    </RevealContext.Provider>
  )
}
