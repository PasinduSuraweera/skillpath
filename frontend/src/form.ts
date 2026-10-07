// Form state, its conversion to the API profile, and validation.
//
// Every question is optional, exactly like the survey: a skipped question is
// sent as "unknown" and the model handles it the way it handled skipped
// questions in training. The client checks mirror app/schemas.py so most
// mistakes are caught before the request; the server stays the authority and
// its 422 field errors are mapped back onto the same fields.
import { AI_FIELDS, TECH_BLOCKS } from './api/types'
import type { AIField, FieldError, Options, Profile, TechBlock } from './api/types'
import { TECH_AREAS } from './questions'

export interface TechState {
  have: string[]
  want: string[]
  none: boolean
}

export interface FormState {
  country: string | null
  years_code: string // text inputs; '' means skipped
  work_exp: string
  ed_level: string
  learn_code_ai: string
  tech: Record<TechBlock, TechState>
  ai: Record<AIField, string>
}

/** Field keys shared by client checks and server errors, e.g. 'years_code', 'tech.Language', 'ai.AISelect'. */
export type Errors = Record<string, string>

// same rule that removed careless "tick everything" answers from training (config.STRAIGHTLINE_SHARE)
export const STRAIGHTLINE_SHARE = 0.9

export function emptyForm(): FormState {
  const tech = {} as Record<TechBlock, TechState>
  for (const b of TECH_BLOCKS) tech[b] = { have: [], want: [], none: false }
  const ai = {} as Record<AIField, string>
  for (const f of AI_FIELDS) ai[f] = ''
  return { country: null, years_code: '', work_exp: '', ed_level: '', learn_code_ai: '', tech, ai }
}

const toNumber = (s: string) => (s.trim() === '' ? null : Number(s))
const toText = (s: string | null) => (s && s.trim() ? s : null)

/** Form -> request body. Untouched technology areas are left out (unknown). */
export function toProfile(form: FormState): Profile {
  const tech: Profile['tech'] = {}
  for (const b of TECH_BLOCKS) {
    const t = form.tech[b]
    if (t.none) tech[b] = { none: true }
    else if (t.have.length || t.want.length) tech[b] = { have: t.have, want: t.want }
  }
  return {
    country: toText(form.country),
    years_code: toNumber(form.years_code),
    work_exp: toNumber(form.work_exp),
    ed_level: toText(form.ed_level),
    learn_code_ai: toText(form.learn_code_ai),
    tech,
    ai: Object.fromEntries(AI_FIELDS.map((f) => [f, toText(form.ai[f])])),
  }
}

/** Request body -> form (used to load the sample profiles). */
export function fromProfile(p: Profile): FormState {
  const form = emptyForm()
  form.country = p.country ?? null
  form.years_code = p.years_code == null ? '' : String(p.years_code)
  form.work_exp = p.work_exp == null ? '' : String(p.work_exp)
  form.ed_level = p.ed_level ?? ''
  form.learn_code_ai = p.learn_code_ai ?? ''
  for (const b of TECH_BLOCKS) {
    const t = p.tech?.[b]
    if (t) form.tech[b] = { have: [...(t.have ?? [])], want: [...(t.want ?? [])], none: !!t.none }
  }
  for (const f of AI_FIELDS) form.ai[f] = p.ai?.[f] ?? ''
  return form
}

function checkYears(value: string, max: number, what: string): string | null {
  if (value.trim() === '') return null
  const n = Number(value)
  if (!Number.isInteger(n)) return `Enter ${what} as a whole number of years.`
  if (n < 0 || n > max) return `Enter a number from 0 to ${max}.`
  return null
}

/** Client-side checks, mirroring app/schemas.py. Empty result = valid. */
export function validate(form: FormState, options: Options): Errors {
  const errors: Errors = {}
  const max = options.limits.years_max
  const yc = checkYears(form.years_code, max, 'years coding')
  if (yc) errors.years_code = yc
  const we = checkYears(form.work_exp, max, 'years of professional work')
  if (we) errors.work_exp = we
  if (form.country && !options.countries.some((c) => c.Country === form.country)) {
    errors.country = 'Choose a country from the list.'
  }
  for (const b of TECH_BLOCKS) {
    const t = form.tech[b]
    const limit = STRAIGHTLINE_SHARE * options.tech[b].length
    if (t.have.length >= limit) {
      errors[`tech.${b}`] =
        `You selected ${t.have.length} of ${options.tech[b].length}. ` +
        'Select only what you used for extensive work in the past year.'
    }
  }
  return errors
}

/** Map the API's 422 field list onto form keys. Technology errors arrive as
 *  field "tech" with a message that starts with the area name. */
export function serverErrors(fields: FieldError[]): Errors {
  const errors: Errors = {}
  for (const { field, message } of fields) {
    let key = field
    if (field === 'tech') {
      const block = TECH_BLOCKS.find((b) => message.startsWith(`${b}.`) || message.startsWith(`${b}:`))
      if (block) key = `tech.${block}`
    }
    errors[key] = errors[key] ? `${errors[key]} ${message}` : message
  }
  return errors
}

/** Wizard step (0 About, 1 Technologies, 2 AI) that owns a field key. */
export function stepOf(key: string): number {
  if (key.startsWith('tech')) return 1
  if (key.startsWith('ai') || key === 'learn_code_ai') return 2
  return 0
}

/** How many questions of each wizard step are answered (a technology area counts once, "none" included). */
export function stepProgress(form: FormState): { answered: number; total: number }[] {
  const filled = (v: string | null) => !!v && v.trim() !== ''
  const about = [form.country, form.years_code, form.work_exp, form.ed_level].filter(filled).length
  const tech = TECH_BLOCKS.filter((b) => {
    const t = form.tech[b]
    return t.none || t.have.length > 0 || t.want.length > 0
  }).length
  const ai = [...AI_FIELDS.map((f) => form.ai[f]), form.learn_code_ai].filter(filled).length
  return [
    { answered: about, total: 4 },
    { answered: tech, total: TECH_BLOCKS.length },
    { answered: ai, total: AI_FIELDS.length + 1 },
  ]
}

const FIELD_LABELS: Record<string, string> = {
  country: 'Country',
  years_code: 'Years coding',
  work_exp: 'Years of professional work',
  ed_level: 'Education',
  learn_code_ai: 'Learning AI tools',
  AISelect: 'AI tool use',
  AIAgents: 'AI agents',
  AIAcc: 'Trust in AI',
  AISent: 'View of AI',
}

/** Human-readable differences between two answer sets, for the what-if panel. */
export function describeChanges(before: FormState, after: FormState): string[] {
  const out: string[] = []
  const show = (v: string | null) => (v && v.trim() ? v : 'not answered')
  const scalar = (key: keyof FormState) => {
    const a = before[key] as string | null
    const b = after[key] as string | null
    if ((a ?? '') !== (b ?? '')) out.push(`${FIELD_LABELS[key]}: ${show(a)} → ${show(b)}`)
  }
  ;(['country', 'years_code', 'work_exp', 'ed_level', 'learn_code_ai'] as const).forEach(scalar)
  for (const b of TECH_BLOCKS) {
    const x = before.tech[b]
    const y = after.tech[b]
    const area = TECH_AREAS[b].title
    for (const kind of ['have', 'want'] as const) {
      const added = y[kind].filter((t) => !x[kind].includes(t))
      const removed = x[kind].filter((t) => !y[kind].includes(t))
      const verb = kind === 'have' ? 'used' : 'want to learn'
      if (added.length) out.push(`${area} ${verb}: + ${added.join(', ')}`)
      if (removed.length) out.push(`${area} ${verb}: − ${removed.join(', ')}`)
    }
    if (x.none !== y.none) out.push(`${area}: ${y.none ? "now “I don’t use any”" : "no longer “I don’t use any”"}`)
  }
  for (const f of AI_FIELDS) {
    if (before.ai[f] !== after.ai[f]) out.push(`${FIELD_LABELS[f]}: ${show(before.ai[f])} → ${show(after.ai[f])}`)
  }
  return out
}

/** Add one technology to an area's "used" list (the "what if I learned this?" shortcut). */
export function withTechnology(form: FormState, block: TechBlock, technology: string): FormState {
  const t = form.tech[block]
  return {
    ...form,
    tech: {
      ...form.tech,
      [block]: {
        have: t.have.includes(technology) ? t.have : [...t.have, technology],
        want: t.want.filter((w) => w !== technology),
        none: false,
      },
    },
  }
}
