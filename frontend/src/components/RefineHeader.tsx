import ArrowBack from '@mui/icons-material/ArrowBack'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { m } from 'motion/react'
import type { Recommendation } from '../api/types'
import { Eyebrow, RingGauge } from '../design/primitives'
import { panel } from '../design/surfaces'
import { RADIUS } from '../design/tokens'
import { pct } from '../format'
import { RevealContext, TRANSITION } from '../motion'
import { Glow } from './AmbientBackground'

/**
 * The top of the questionnaire when there are results already: changing answers is now a
 * what-if, so it says so, and keeps the current best match in view with the way back to it.
 */
export default function RefineHeader({ result, onBack, disabled }: { result: Recommendation; onBack: () => void; disabled: boolean }) {
  const top = result.roles[0]
  return (
    <Box
      component={m.section}
      aria-labelledby="refine-title"
      className="no-print"
      // movement only on the section; the fades are on its parts (the chip is glass: see SurfaceMotion)
      initial={{ y: 8 }}
      animate={{ y: 0 }}
      transition={TRANSITION.enter}
      sx={{ position: 'relative', isolation: 'isolate', pt: { xs: 1, md: 3 } }}
    >
      <Glow color="#8b5cf6" size={520} sx={{ top: -200, left: -200 }} />
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-end' }, gap: 2.5 }}>
        <Box component={m.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={TRANSITION.enter} sx={{ minWidth: 0, maxWidth: 680 }}>
          <Eyebrow tone="violet">What if…?</Eyebrow>
          <Typography variant="h2" component="h1" id="refine-title" sx={{ mt: 0.75 }}>
            Refine your profile
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1.25, textWrap: 'pretty' }}>
            Change any answer, then get recommendations again. SkillPath compares the new result with the one you have now, so
            you can see what each answer is worth.
          </Typography>
        </Box>
        {/* the result being refined, and the way back to it */}
        <Stack
          component={m.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...TRANSITION.enter, delay: 0.08 }}
          direction="row"
          sx={(t) => ({ ...panel(t, { radius: RADIUS.card }), alignItems: 'center', flexWrap: 'wrap', gap: 1.75, p: 1.5, pr: 2, flexShrink: 0, maxWidth: '100%' })}>
          <RevealContext.Provider value={false}>
            <RingGauge value={top.probability} size={52} thickness={6} glow={false}>
              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {pct(top.probability)}
              </Typography>
            </RingGauge>
          </RevealContext.Provider>
          <Box sx={{ minWidth: 0, flex: '1 1 140px' }}>
            <Typography variant="caption" color="text.secondary" component="p">
              Current best match
            </Typography>
            <Typography variant="subtitle2" component="p" sx={{ overflowWrap: 'anywhere' }}>
              {top.label}
            </Typography>
          </Box>
          <Button variant="outlined" size="small" startIcon={<ArrowBack />} onClick={onBack} disabled={disabled} sx={{ ml: 'auto', flexShrink: 0 }}>
            Back to results
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
