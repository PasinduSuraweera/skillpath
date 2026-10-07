import Explore from '@mui/icons-material/Explore'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import Leaderboard from '@mui/icons-material/Leaderboard'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import Psychology from '@mui/icons-material/PsychologyOutlined'
import VerifiedOutlined from '@mui/icons-material/VerifiedOutlined'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import { m, useReducedMotion, useScroll, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import type { Recommendation } from '../../api/types'
import { IconTile, Tile } from '../../design/primitives'
import type { SurfaceMotion } from '../../design/primitives'
import { TONES, ink, white } from '../../design/tokens'
import type { Tone } from '../../design/tokens'
import { stepProgress } from '../../form'
import type { FormState } from '../../form'
import { matchShape, pct } from '../../format'
import { revealChild, useHighlight, useReveal } from '../../motion'

function Stage({ icon, tone, label, value, detail, last, drawn }: { icon: ReactNode; tone: Tone; label: string; value: string; detail: ReactNode; last?: boolean; drawn?: MotionValue<number> }) {
  const theme = useTheme()
  // a what-if that changes this figure tints it briefly
  const valueRef = useHighlight<HTMLParagraphElement>(value, alpha(theme.palette.primary.main, 0.16))
  return (
    // one after another as the tile reveals: the analysis read in the order it happened
    <Box component={m.li} {...revealChild('item')} sx={{ position: 'relative', display: 'flex', gap: 1.75, pb: last ? 0 : 2.25 }}>
      {/* the line that joins one stage to the next */}
      {!last && (
        <Box aria-hidden="true" sx={(t) => ({ position: 'absolute', left: 17, top: 40, bottom: 4, width: 2, borderRadius: 1, bgcolor: ink(0.08), ...t.applyStyles('dark', { bgcolor: white(0.08) }) })}>
          {/* drawn in as the visitor reads down to the next stage (print shows it drawn) */}
          <Box
            component={m.div}
            data-reveal=""
            style={drawn ? { scaleY: drawn } : undefined}
            sx={(t) => ({
              position: 'absolute',
              inset: 0,
              borderRadius: 1,
              transformOrigin: 'top',
              backgroundImage: `linear-gradient(${TONES[tone].light}, ${alpha(TONES[tone].light, 0.25)})`,
              ...t.applyStyles('dark', { backgroundImage: `linear-gradient(${TONES[tone].dark}, ${alpha(TONES[tone].dark, 0.25)})` }),
            })}
          />
        </Box>
      )}
      <IconTile tone={tone} size={36}>
        {icon}
      </IconTile>
      <Box sx={{ minWidth: 0, pt: 0.125 }}>
        <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1.5 }}>
          {label}
        </Typography>
        <Typography variant="subtitle1" component="p" ref={valueRef} sx={{ lineHeight: 1.3, fontVariantNumeric: 'tabular-nums', borderRadius: '6px', mx: -0.5, px: 0.5, width: 'fit-content', maxWidth: '100%' }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
          {detail}
        </Typography>
      </Box>
    </Box>
  )
}

/**
 * Behind the result: the analysis in the order it happened (the profile that was read, the
 * career direction it points to, how the 20 roles were ranked, how reliable the model is),
 * and the cautions that come with every result. Every figure comes from the answers or the API.
 */
export default function Behind({ result, answers, motion }: { result: Recommendation; answers: FormState; motion?: (i: number) => SurfaceMotion }) {
  // the line joining the stages draws itself, one stretch after another, as the list is read
  const list = useRef<HTMLOListElement>(null)
  const reduce = useReducedMotion()
  const reveal = useReveal()
  const { scrollYProgress } = useScroll({ target: list, offset: ['start 85%', 'end 55%'] })
  const first = useTransform(scrollYProgress, [0, 1 / 3], [0, 1])
  const second = useTransform(scrollYProgress, [1 / 3, 2 / 3], [0, 1])
  const third = useTransform(scrollYProgress, [2 / 3, 1], [0, 1])
  // with reduced motion, and for results returned to, the line is simply there
  const draw = !reduce && reveal
  const progress = stepProgress(answers)
  const answered = progress.reduce((n, p) => n + p.answered, 0)
  const questions = progress.reduce((n, p) => n + p.total, 0)
  const used = Object.values(answers.tech).reduce((n, t) => n + t.have.length, 0)
  const wanted = Object.values(answers.tech).reduce((n, t) => n + t.want.length, 0)
  const family = result.families[0]
  const shape = matchShape(result.ranking.map((r) => r.probability))
  const model = result.model

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Tile icon={<Psychology />} tone="violet" title="How SkillPath reached this" className="avoid-break" motion={motion?.(0)}>
          <Box component="ol" ref={list} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            <Stage icon={<PersonOutlined />} tone="indigo" label="Profile read" value={`${answered} of ${questions} answers`} detail={`${used} technologies used · ${wanted} wanted`} drawn={draw ? first : undefined} />
            <Stage icon={<Explore />} tone="cyan" label="Strongest direction" value={`${family.family} · ${pct(family.probability)}`} detail="Top career family, adding up its roles" drawn={draw ? second : undefined} />
            <Stage icon={<Leaderboard />} tone="violet" label={`${model.classes} roles ranked`} value={shape.title} detail={shape.detail} drawn={draw ? third : undefined} />
            <Stage
              icon={<VerifiedOutlined />}
              tone="emerald"
              label="Model reliability"
              value={`${pct(model.test_top3_accuracy)} top-3 accuracy`}
              detail={`On ${model.test_rows.toLocaleString()} survey respondents it never saw`}
              last
            />
          </Box>
        </Tile>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <Tile icon={<InfoOutlined />} tone="amber" title="Please keep in mind" className="avoid-break" motion={motion?.(1)}>
          <Stack component="ul" spacing={1.75} sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {result.notes.map((n) => (
              <Stack key={n} component={m.li} {...revealChild('item')} direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                <Box aria-hidden="true" sx={(t) => ({ mt: '8px', width: 6, height: 6, borderRadius: '50%', flexShrink: 0, bgcolor: TONES.amber.light, ...t.applyStyles('dark', { bgcolor: TONES.amber.dark }) })} />
                <Typography variant="body2" color="text.secondary">
                  {n}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Tile>
      </Grid>
    </Grid>
  )
}
