import Stack from '@mui/material/Stack'
import type { Dispatch, SetStateAction } from 'react'
import { AI_FIELDS } from '../api/types'
import type { AIField, Options } from '../api/types'
import type { Errors, FormState } from '../form'
import { AI_QUESTIONS, LEARN_CODE_AI_QUESTION } from '../questions'
import ChoiceCards from './ChoiceCards'
import StepHeading from './StepHeading'

interface Props {
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
  options: Options
  errors: Errors
}

// narrowest answer card per question: short scale words share one row, sentences get room
const MIN_WIDTH: Record<AIField, number> = { AISelect: 150, AIAgents: 220, AIAcc: 150, AISent: 130 }

export default function AIStep({ form, setForm, options, errors }: Props) {
  return (
    <Stack spacing={4}>
      <StepHeading title="AI in your work">
        How you use and feel about AI tools. People in different roles answered these very differently in 2025, so they
        help the model. Each question is optional.
      </StepHeading>
      {AI_FIELDS.map((f, i) => (
        <ChoiceCards
          key={f}
          number={i + 1}
          question={AI_QUESTIONS[f]}
          value={form.ai[f]}
          choices={options.ai[f]}
          minWidth={MIN_WIDTH[f]}
          error={errors[`ai.${f}`]}
          onChange={(v) => setForm((s) => ({ ...s, ai: { ...s.ai, [f]: v } }))}
        />
      ))}
      <ChoiceCards
        number={AI_FIELDS.length + 1}
        question={LEARN_CODE_AI_QUESTION}
        value={form.learn_code_ai}
        choices={options.learn_code_ai}
        minWidth={300}
        error={errors.learn_code_ai}
        onChange={(v) => setForm((s) => ({ ...s, learn_code_ai: v }))}
      />
    </Stack>
  )
}
