import Autocomplete from '@mui/material/Autocomplete'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { TechBlock } from '../api/types'
import type { TechState } from '../form'
import { HAVE_LABEL, TECH_AREAS, WANT_LABEL } from '../questions'

interface Props {
  block: TechBlock
  value: TechState
  choices: string[] // most popular first
  error?: string
  onChange: (value: TechState) => void
}

export default function TechArea({ block, value, choices, error, onChange }: Props) {
  const area = TECH_AREAS[block]
  const answered = value.none || value.have.length > 0 || value.want.length > 0

  const picker = (kind: 'have' | 'want', label: string) => (
    <Autocomplete
      multiple
      size="small"
      disableCloseOnSelect
      filterSelectedOptions
      options={choices}
      value={value[kind]}
      disabled={value.none}
      onChange={(_, list) => onChange({ ...value, [kind]: list })}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={value[kind].length ? '' : 'Type to search'} error={!!error && kind === 'have'} />
      )}
    />
  )

  return (
    <Paper sx={{ p: 2, height: '100%', borderColor: error ? 'error.main' : undefined }}>
      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <div>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {area.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {area.hint}
            </Typography>
          </div>
          <Chip
            size="small"
            variant={answered ? 'filled' : 'outlined'}
            color={answered ? 'primary' : 'default'}
            label={value.none ? 'None' : answered ? `${value.have.length} used · ${value.want.length} wanted` : 'Skipped'}
          />
        </Stack>
        {picker('have', HAVE_LABEL)}
        {picker('want', WANT_LABEL)}
        {area.hasNone && (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={value.none}
                onChange={(e) => onChange(e.target.checked ? { have: [], want: [], none: true } : { ...value, none: false })}
              />
            }
            label={<Typography variant="body2">I don’t use any of these</Typography>}
          />
        )}
        {error && <FormHelperText error>{error}</FormHelperText>}
      </Stack>
    </Paper>
  )
}
