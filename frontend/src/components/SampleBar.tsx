import CheckCircle from '@mui/icons-material/CheckCircle'
import PersonSearch from '@mui/icons-material/PersonSearch'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { SAMPLES } from '../samples'
import type { Sample } from '../samples'

interface Props {
  onPick: (s: Sample) => void
  disabled: boolean
  /** the example the answers still match, if any */
  activeId: string | null
}

export default function SampleBar({ onPick, disabled, activeId }: Props) {
  return (
    <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1 }} className="no-print">
      <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
        Try an example:
      </Typography>
      {SAMPLES.map((s) => {
        const active = s.id === activeId
        return (
          <Tooltip key={s.id} title={s.summary} arrow>
            <Chip
              icon={active ? <CheckCircle /> : <PersonSearch />}
              label={s.name}
              onClick={() => onPick(s)}
              disabled={disabled}
              variant={active ? 'filled' : 'outlined'}
              color="primary"
              aria-pressed={active}
              sx={{ maxWidth: '100%' }}
            />
          </Tooltip>
        )
      })}
    </Stack>
  )
}
