import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Dispatch, SetStateAction } from 'react'
import { AI_FIELDS } from '../api/types'
import type { Options } from '../api/types'
import type { Errors, FormState } from '../form'
import { AI_QUESTIONS, LEARN_CODE_AI_QUESTION } from '../questions'

interface Props {
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
  options: Options
  errors: Errors
}

function Choice(props: {
  label: string
  value: string
  choices: string[]
  error?: string
  onChange: (v: string) => void
}) {
  return (
    <TextField
      select
      fullWidth
      label={props.label}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      error={!!props.error}
      helperText={props.error}
      slotProps={{ inputLabel: { sx: { whiteSpace: 'normal', pr: 3 } } }}
    >
      <MenuItem value="">
        <em>Prefer not to say</em>
      </MenuItem>
      {props.choices.map((c) => (
        <MenuItem key={c} value={c} sx={{ whiteSpace: 'normal' }}>
          {c}
        </MenuItem>
      ))}
    </TextField>
  )
}

export default function AIStep({ form, setForm, options, errors }: Props) {
  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Typography variant="h6">AI in your work</Typography>
        <Typography variant="body2" color="text.secondary">
          How you use and feel about AI tools. People in different roles answered these very differently in 2025, so
          they help the model.
        </Typography>
      </Grid>
      {AI_FIELDS.map((f) => (
        <Grid key={f} size={12}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
            {AI_QUESTIONS[f]}
          </Typography>
          <Choice
            label="Your answer"
            value={form.ai[f]}
            choices={options.ai[f]}
            error={errors[`ai.${f}`]}
            onChange={(v) => setForm((s) => ({ ...s, ai: { ...s.ai, [f]: v } }))}
          />
        </Grid>
      ))}
      <Grid size={12}>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          {LEARN_CODE_AI_QUESTION}
        </Typography>
        <Choice
          label="Your answer"
          value={form.learn_code_ai}
          choices={options.learn_code_ai}
          error={errors.learn_code_ai}
          onChange={(v) => setForm((s) => ({ ...s, learn_code_ai: v }))}
        />
      </Grid>
    </Grid>
  )
}
