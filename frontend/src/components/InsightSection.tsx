import InfoOutlined from '@mui/icons-material/InfoOutlined'
import Box from '@mui/material/Box'
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
        <Tooltip title={props.help} arrow>
          <InfoOutlined fontSize="inherit" color="action" sx={{ cursor: 'help' }} aria-label={props.help} />
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
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {Math.round(props.value)}
          {unit}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={Math.min(100, props.value)} sx={{ height: 6, borderRadius: 3, my: 0.5 }} />
      <Typography variant="caption" color="text.secondary">
        {compare} (all roles: {Math.round(props.average)}
        {unit})
      </Typography>
    </Box>
  )
}
