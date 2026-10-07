import InfoOutlined from '@mui/icons-material/InfoOutlined'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { ReactNode } from 'react'

/** Small titled block inside a role card (AI outlook, salary, skills); its title is a level-4 heading under the role's. */
export function InsightSection(props: { icon: ReactNode; title: string; help: string; children: ReactNode }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.25 }}>
        {props.icon}
        <Typography variant="subtitle2" component="h4">
          {props.title}
        </Typography>
        {/* a real button, so the explanation also opens with the keyboard (and on tap) */}
        <Tooltip title={props.help} arrow describeChild enterTouchDelay={0} leaveTouchDelay={5000}>
          <IconButton size="small" className="no-print" aria-label={`About “${props.title}”`} sx={{ p: 0.25, ml: '2px !important', color: 'text.secondary' }}>
            <InfoOutlined sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>
      {props.children}
    </Box>
  )
}

/** The marker drawn on metric bars for the all-roles figure; also used in the legend. */
export function AverageTick({ inline }: { inline?: boolean }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={(t) => ({
        display: 'inline-block',
        width: 2,
        height: inline ? 10 : 11,
        borderRadius: 1,
        bgcolor: alpha(t.palette.text.primary, 0.55),
        verticalAlign: inline ? '-1px' : undefined,
      })}
    />
  )
}

/**
 * A 0-100 figure on one line, with a bar that carries a marker at the all-roles
 * value: the comparison reads from the bar instead of a sentence under every figure.
 * Screen readers get the comparison in words.
 */
export function Metric(props: { label: string; value: number; average: number; unit?: string }) {
  const unit = props.unit ?? ''
  const diff = props.value - props.average
  const compare = Math.abs(diff) < 2 ? 'about average' : diff > 0 ? 'above average' : 'below average'
  const avg = Math.min(100, Math.max(0, props.average))
  return (
    <Box sx={{ '& + &': { mt: 1.25 } }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
        <Typography variant="body2">{props.label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {Math.round(props.value)}
          {unit}
          <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 400, ml: 0.75 }}>
            avg {Math.round(props.average)}
            {unit}
          </Typography>
          <span className="sp-sr-only">, {compare}</span>
        </Typography>
      </Stack>
      <Box sx={{ position: 'relative', mt: 0.75 }}>
        <LinearProgress variant="determinate" value={Math.min(100, props.value)} sx={{ height: 5 }} aria-hidden="true" />
        <Box sx={{ position: 'absolute', top: -3, left: `calc(${avg}% - 1px)`, lineHeight: 0 }}>
          <AverageTick />
        </Box>
      </Box>
    </Box>
  )
}
