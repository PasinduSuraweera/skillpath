import PersonSearch from '@mui/icons-material/PersonSearch'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { SAMPLES } from '../samples'
import type { Sample } from '../samples'

export default function SampleBar({ onPick, disabled }: { onPick: (s: Sample) => void; disabled: boolean }) {
  return (
    <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1 }} className="no-print">
      <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
        Try an example:
      </Typography>
      {SAMPLES.map((s) => (
        <Tooltip key={s.id} title={s.summary} arrow>
          <Chip
            icon={<PersonSearch />}
            label={s.name}
            onClick={() => onPick(s)}
            disabled={disabled}
            variant="outlined"
            color="primary"
          />
        </Tooltip>
      ))}
    </Stack>
  )
}
