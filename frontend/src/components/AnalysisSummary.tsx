import Explore from '@mui/icons-material/Explore'
import Leaderboard from '@mui/icons-material/Leaderboard'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import VerifiedOutlined from '@mui/icons-material/VerifiedOutlined'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import type { CSSProperties, ReactNode } from 'react'
import type { Recommendation } from '../api/types'
import { stepProgress } from '../form'
import type { FormState } from '../form'
import { matchShape, pct } from '../format'
import { useHighlight } from '../motion'

interface Props {
  result: Recommendation
  /** the answers that produced this result */
  answers: FormState
  /** position in the results reveal; the four cells follow one another, half a step apart */
  revealFrom: number
}

function Item(props: { icon: ReactNode; label: string; value: string; detail: ReactNode; i: number }) {
  const theme = useTheme()
  // a what-if that changes this figure tints it briefly
  const valueRef = useHighlight<HTMLParagraphElement>(props.value, alpha(theme.palette.primary.main, 0.16))
  return (
    <Box
      component="li"
      className="sp-reveal"
      style={{ '--i': props.i } as CSSProperties}
      sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', minWidth: 0, p: { xs: 1.5, md: 2 } }}
    >
      <Box
        aria-hidden="true"
        sx={(t) => ({
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: '9px',
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: alpha(t.palette.primary.main, 0.1),
          '& svg': { fontSize: 18 },
        })}
      >
        {props.icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1.5 }}>
          {props.label}
        </Typography>
        <Typography
          variant="subtitle1"
          component="p"
          ref={valueRef}
          sx={{ lineHeight: 1.3, fontVariantNumeric: 'tabular-nums', borderRadius: '6px', mx: -0.5, px: 0.5, width: 'fit-content' }}
        >
          {props.value}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
          {props.detail}
        </Typography>
      </Box>
    </Box>
  )
}

/**
 * The analysis behind the result, in the order it happened: the profile that was
 * read, the career direction it points to, how the 20 roles were ranked, and how
 * reliable the model is. Every figure comes from the answers or the API response.
 */
export default function AnalysisSummary({ result, answers, revealFrom }: Props) {
  const progress = stepProgress(answers)
  const answered = progress.reduce((n, p) => n + p.answered, 0)
  const questions = progress.reduce((n, p) => n + p.total, 0)
  const used = Object.values(answers.tech).reduce((n, t) => n + t.have.length, 0)
  const wanted = Object.values(answers.tech).reduce((n, t) => n + t.want.length, 0)
  const family = result.families[0]
  const shape = matchShape(result.ranking.map((r) => r.probability))
  const m = result.model

  return (
    <Paper component="section" aria-labelledby="analysis-title" sx={{ overflow: 'hidden' }}>
      <h2 id="analysis-title" className="sp-sr-only">
        How SkillPath reached this result
      </h2>
      <Box
        component="ol"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          // hairlines between the cells, whatever the column count
          '& > li': { borderTop: 1, borderLeft: 1, borderColor: 'divider', mt: '-1px', ml: '-1px' },
        }}
      >
        <Item
          i={revealFrom}
          icon={<PersonOutlined />}
          label="Profile read"
          value={`${answered} of ${questions} answers`}
          detail={`${used} technologies used · ${wanted} wanted`}
        />
        <Item
          i={revealFrom + 1 * 0.5}
          icon={<Explore />}
          label="Strongest direction"
          value={`${family.family} · ${pct(family.probability)}`}
          detail="Top career family, adding up its roles"
        />
        <Item
          i={revealFrom + 2 * 0.5}
          icon={<Leaderboard />}
          label={`${m.classes} roles ranked`}
          value={shape.title}
          detail={shape.detail}
        />
        <Item
          i={revealFrom + 3 * 0.5}
          icon={<VerifiedOutlined />}
          label="Model reliability"
          value={`${pct(m.test_top3_accuracy)} top-3 accuracy`}
          detail={`On ${m.test_rows.toLocaleString()} survey respondents it never saw`}
        />
      </Box>
    </Paper>
  )
}
