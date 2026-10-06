import InfoOutlined from '@mui/icons-material/InfoOutlined'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

/** Small titled block inside a role card (AI outlook, salary, skills). */
export function InsightSection(props: { icon: ReactNode; title: string; help: string; children: ReactNode }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        {props.icon}
        <Typography variant="subtitle2">{props.title}</Typography>
        {/* a real button, so the explanation also opens with the keyboard (and on tap) */}
        <Tooltip title={props.help} arrow describeChild enterTouchDelay={0} leaveTouchDelay={5000}>
          <IconButton size="small" aria-label={`About “${props.title}”`} sx={{ p: 0.25, ml: '2px !important', color: 'text.secondary' }}>
            <InfoOutlined sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>
      {props.children}
    </Box>
  )
}

/** A 0-100 figure with a bar and a comparison against the all-roles value. */
export function Metric(props: { label: string; value: number; average: number; unit?: string }) {
  const unit = props.unit ?? ''
  const diff = props.value - props.average
  const compare = Math.abs(diff) < 2 ? 'about average' : diff > 0 ? 'above average' : 'below average'
  return (
    <Box sx={{ mb: 1 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography variant="body2">{props.label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(props.value)}
          {unit}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={Math.min(100, props.value)} sx={{ height: 5, my: 0.75 }} />
      <Typography variant="caption" color="text.secondary">
        {compare} (all roles: {Math.round(props.average)}
        {unit})
      </Typography>
    </Box>
  )
}
