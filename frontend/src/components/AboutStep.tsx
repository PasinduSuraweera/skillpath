import Autocomplete from '@mui/material/Autocomplete'
import Grid from '@mui/material/Grid'
import ListSubheader from '@mui/material/ListSubheader'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { useId, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Options } from '../api/types'
import type { Errors, FormState } from '../form'
import StepHeading from './StepHeading'

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
  const regionId = useId()

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <StepHeading title="About you">
          Every question is optional, just like in the survey. Skipped questions are treated as unknown, but the more
          you answer, the more personal the result.
        </StepHeading>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Autocomplete
          options={countries}
          groupBy={(c) => c.Region}
          // each region is a labelled group of options: MUI's default puts the options in a plain
          // list inside the listbox, which screen readers cannot tie to the listbox
          renderGroup={(params) => (
            <li key={params.key} role="presentation">
              <ListSubheader component="div" role="presentation" id={`${regionId}-${params.key}`} className="MuiAutocomplete-groupLabel">
                {params.group}
              </ListSubheader>
              <ul role="group" aria-labelledby={`${regionId}-${params.key}`} className="MuiAutocomplete-groupUl">
                {params.children}
              </ul>
            </li>
          )}
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
