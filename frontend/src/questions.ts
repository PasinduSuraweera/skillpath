// Plain-English wording for each question, taken from the 2025 survey
// questionnaire so the answers mean what they meant to the respondents the
// model was trained on.
import type { AIField, TechBlock } from './api/types'

export interface TechAreaText {
  title: string
  hint: string
  /** false for SOTags: the survey has no "I don't use any" gate for it */
  hasNone: boolean
}

export const TECH_AREAS: Record<TechBlock, TechAreaText> = {
  Language: { title: 'Programming languages', hint: 'Programming, scripting and markup languages', hasNone: true },
  Database: { title: 'Databases', hint: 'Database environments and data stores', hasNone: true },
  Platform: { title: 'Cloud and dev platforms', hint: 'Cloud providers, containers, package managers and build tools', hasNone: true },
  Webframe: { title: 'Web frameworks', hint: 'Web frameworks and web technologies', hasNone: true },
  DevEnvs: { title: 'Editors and IDEs', hint: 'Code editors and development environments', hasNone: true },
  AIModels: { title: 'AI models', hint: 'Large language models you used for development work', hasNone: true },
  SOTags: { title: 'Newer tools and topics', hint: 'Stack Overflow tags for tools and topics new in 2025', hasNone: false },
}

export const HAVE_LABEL = 'Used for extensive work in the past year'
export const WANT_LABEL = 'Want to work with next year'

export const AI_QUESTIONS: Record<AIField, string> = {
  AISelect: 'Do you currently use AI tools in your development process?',
  AIAgents: 'Do you use AI agents (AI that carries out multi-step tasks for you) at work?',
  AIAcc: 'How much do you trust the accuracy of the output from AI tools?',
  AISent: 'How favourable is your view of using AI tools in your development workflow?',
}

export const LEARN_CODE_AI_QUESTION =
  'In the past year, did you spend time learning how to use AI-enabled tools?'
