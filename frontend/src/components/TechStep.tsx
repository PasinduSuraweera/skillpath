import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import type { Dispatch, SetStateAction } from 'react'
import { TECH_BLOCKS } from '../api/types'
import type { Options } from '../api/types'
import type { Errors, FormState } from '../form'
import StepHeading from './StepHeading'
import TechArea from './TechArea'

interface Props {
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
  options: Options
  errors: Errors
}

export default function TechStep({ form, setForm, options, errors }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid size={12} sx={{ mb: 1 }}>
        <StepHeading title="Technologies">
          Technologies are the strongest signal for the model. For each area, pick what you have done extensive work
          with in the past year and what you want to work with next year. Tick “I don’t use any” if the area does not
          apply to you; leave it empty if you prefer not to answer.
        </StepHeading>
      </Grid>
      {errors.tech && (
        <Grid size={12}>
          <Alert severity="error" className="sp-rise">
            {errors.tech}
          </Alert>
        </Grid>
      )}
      {TECH_BLOCKS.map((block) => (
        <Grid key={block} size={{ xs: 12, md: 6 }}>
          <TechArea
            block={block}
            value={form.tech[block]}
            choices={options.tech[block]}
            error={errors[`tech.${block}`]}
            onChange={(value) => setForm((f) => ({ ...f, tech: { ...f.tech, [block]: value } }))}
          />
        </Grid>
      ))}
    </Grid>
  )
}
