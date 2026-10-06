import Check from '@mui/icons-material/Check'
import CloudQueue from '@mui/icons-material/CloudQueue'
import Code from '@mui/icons-material/Code'
import NewReleases from '@mui/icons-material/NewReleases'
import Psychology from '@mui/icons-material/Psychology'
import Storage from '@mui/icons-material/Storage'
import Terminal from '@mui/icons-material/Terminal'
import Web from '@mui/icons-material/Web'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { useState } from 'react'
import type { TechBlock } from '../api/types'
import type { TechState } from '../form'
import { DURATION } from '../motion'
import { HAVE_LABEL, TECH_AREAS, WANT_LABEL } from '../questions'
import { RADIUS, tintInk } from '../theme'

const ICONS: Record<TechBlock, typeof Code> = {
  Language: Code,
  Database: Storage,
  Platform: CloudQueue,
  Webframe: Web,
  DevEnvs: Terminal,
  AIModels: Psychology,
  SOTags: NewReleases,
}

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
  const Icon = ICONS[block]
  // the check settles in when the visitor answers here, not every time the step opens
  const [touched, setTouched] = useState(false)
  const change = (v: TechState) => {
    setTouched(true)
    onChange(v)
  }

  const picker = (kind: 'have' | 'want', label: string) => (
    <Autocomplete
      multiple
      size="small"
      disableCloseOnSelect
      filterSelectedOptions
      options={choices}
      value={value[kind]}
      disabled={value.none}
      onChange={(_, list) => change({ ...value, [kind]: list })}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value[kind].length ? '' : 'Type to search'}
          error={!!error && kind === 'have'}
        />
      )}
    />
  )

  return (
    // an inset surface inside the step's card (not a second bordered card); it takes on
    // the primary colour once the area is answered
    <Box
      component="section"
      aria-label={area.title}
      sx={(t) => ({
        p: 2,
        height: '100%',
        borderRadius: `${RADIUS.inset}px`,
        border: '1px solid',
        borderColor: error ? t.palette.error.main : answered ? alpha(t.palette.primary.main, 0.32) : t.palette.divider,
        bgcolor: answered ? alpha(t.palette.primary.main, 0.035) : 'rgba(15, 23, 42, 0.018)',
        transition: `border-color ${DURATION.hover}ms ease, background-color ${DURATION.hover}ms ease`,
        ...t.applyStyles('dark', {
          bgcolor: answered ? alpha(t.palette.primary.main, 0.06) : 'rgba(255, 255, 255, 0.02)',
        }),
      })}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1.5 }}>
          {/* area icon: takes on the accent once the area is answered */}
          <Box
            aria-hidden="true"
            sx={(t) => ({
              flexShrink: 0,
              width: 34,
              height: 34,
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              color: answered ? 'primary.main' : 'text.secondary',
              bgcolor: answered ? alpha(t.palette.primary.main, 0.12) : alpha(t.palette.text.primary, 0.05),
              transition: `background-color ${DURATION.hover}ms ease, color ${DURATION.hover}ms ease`,
            })}
          >
            <Icon sx={{ fontSize: 19 }} />
          </Box>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle1" component="h3" sx={{ lineHeight: 1.35 }}>
              {area.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {area.hint}
            </Typography>
          </Box>
          <Chip
            size="small"
            icon={answered ? <Check className={touched ? 'sp-pop' : undefined} /> : undefined}
            label={value.none ? 'None' : answered ? `${value.have.length} used · ${value.want.length} wanted` : 'Skipped'}
            sx={(t) => ({
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
              bgcolor: answered ? alpha(t.palette.primary.main, 0.12) : 'transparent',
              ...(answered ? tintInk(t) : { color: 'text.secondary' }),
              border: '1px solid',
              borderColor: answered ? 'transparent' : 'divider',
              fontWeight: 600,
              '& .MuiChip-icon': { color: 'inherit', fontSize: 15, ml: 0.75, mr: -0.25 },
            })}
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
                onChange={(e) => change(e.target.checked ? { have: [], want: [], none: true } : { ...value, none: false })}
              />
            }
            label={<Typography variant="body2">I don’t use any of these</Typography>}
          />
        )}
        {error && (
          <FormHelperText error className="sp-fade">
            {error}
          </FormHelperText>
        )}
      </Stack>
    </Box>
  )
}
