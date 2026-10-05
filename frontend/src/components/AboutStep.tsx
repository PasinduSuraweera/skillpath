import Autocomplete from '@mui/material/Autocomplete'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Options } from '../api/types'
import type { Errors, FormState } from '../form'

interface Props {
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
  options: Options
  errors: Errors
}

export default function AboutStep({ form, setForm, options, errors }: Props) {
  // grouped by region, as the salary benchmark falls back to the region
  const countries = useMemo(
    () => [...options.countries].sort((a, b) => a.Region.localeCompare(b.Region) || a.Country.localeCompare(b.Country)),
    [options.countries],
  )
  const region = options.countries.find((c) => c.Country === form.country)?.Region
  const max = options.limits.years_max

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Typography variant="h6">About you</Typography>
        <Typography variant="body2" color="text.secondary">
          Every question is optional, just like in the survey. Skipped questions are treated as unknown, but the more
          you answer, the more personal the result.
        </Typography>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Autocomplete
          options={countries}
          groupBy={(c) => c.Region}
          getOptionLabel={(c) => c.Country}
          value={countries.find((c) => c.Country === form.country) ?? null}
          onChange={(_, c) => setForm((f) => ({ ...f, country: c?.Country ?? null }))}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Country you live in"
              error={!!errors.country}
              helperText={
                errors.country ??
                (region ? `Region: ${region}. Used for salary figures when your country has too few people.` : 'Type to search.')
              }
            />
          )}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          select
          fullWidth
          label="Highest level of formal education"
          value={form.ed_level}
          onChange={(e) => setForm((f) => ({ ...f, ed_level: e.target.value }))}
          error={!!errors.ed_level}
          helperText={errors.ed_level ?? 'Completed level. Choose “Some college/university” if you are still studying.'}
        >
          <MenuItem value="">
            <em>Prefer not to say</em>
          </MenuItem>
          {options.ed_level.map((e) => (
            <MenuItem key={e} value={e}>
              {e}
            </MenuItem>
          ))}
        </TextField>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          fullWidth
          type="number"
          label="Years coding (including education)"
          value={form.years_code}
          onChange={(e) => setForm((f) => ({ ...f, years_code: e.target.value }))}
          error={!!errors.years_code}
          helperText={errors.years_code ?? 'How many years since you started coding, counting school and university.'}
          slotProps={{ htmlInput: { min: 0, max, step: 1, inputMode: 'numeric' } }}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          fullWidth
          type="number"
          label="Years of professional work experience"
          value={form.work_exp}
          onChange={(e) => setForm((f) => ({ ...f, work_exp: e.target.value }))}
          error={!!errors.work_exp}
          helperText={
            errors.work_exp ??
            'Years working in a job. Students: 0. Left blank, it counts as 0 when years coding is filled in (as in the survey).'
          }
          slotProps={{ htmlInput: { min: 0, max, step: 1, inputMode: 'numeric' } }}
        />
      </Grid>
    </Grid>
  )
}
