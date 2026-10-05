// Types for the SkillPath API. They mirror the pydantic models in app/schemas.py
// and the options file built in src/skillpath/profile.py (GET /api/options).

export const TECH_BLOCKS = ['Language', 'Database', 'Platform', 'Webframe', 'DevEnvs', 'AIModels', 'SOTags'] as const
export type TechBlock = (typeof TECH_BLOCKS)[number]

export const AI_FIELDS = ['AISelect', 'AIAgents', 'AIAcc', 'AISent'] as const
export type AIField = (typeof AI_FIELDS)[number]

// ---------------------------------------------------------------------------
// GET /api/options
// ---------------------------------------------------------------------------
export interface JobRoleInfo {
  job_role: string
  label: string
  family: string
  description: string
}

export interface Options {
  countries: { Country: string; Region: string }[]
  tech: Record<TechBlock, string[]> // most popular first
  ed_level: string[] // ordered, lowest first
  ai: Record<AIField, string[]> // ordered scales
  learn_code_ai: string[]
  job_roles: JobRoleInfo[]
  limits: { years_min: number; years_max: number }
  attribution: string
}

// ---------------------------------------------------------------------------
// POST /api/predict  (request)
// ---------------------------------------------------------------------------
export interface TechAnswer {
  have?: string[]
  want?: string[]
  none?: boolean
}

export interface Profile {
  country?: string | null
  years_code?: number | null
  work_exp?: number | null
  ed_level?: string | null
  learn_code_ai?: string | null
  tech?: Partial<Record<TechBlock, TechAnswer>>
  ai?: Partial<Record<AIField, string | null>>
}

// ---------------------------------------------------------------------------
// POST /api/predict  (response)
// ---------------------------------------------------------------------------
export interface AIStats {
  n: number
  exposure_now: number
  exposure_expected: number
  threat_yes_pct: number
  threat_n: number
}

export interface AIOutlook extends AIStats {
  level: string
  all_roles: AIStats
}

export interface SalaryBenchmark {
  available: boolean
  reason?: string | null
  n?: number | null
  p25?: number | null
  median?: number | null
  p75?: number | null
  currency?: string | null
  experience_band?: string | null
  level?: string | null
  local?: boolean | null
  peer_group?: string | null
}

export interface SkillSuggestion {
  technology: string
  area: TechBlock
  share_pct: number
  lift: number
  wanted: boolean
}

export interface SkillGap {
  role_n: number
  typical_count: number
  matched: string[]
  missing: SkillSuggestion[]
}

export interface RoleRecommendation {
  rank: number
  job_role: string
  label: string
  family: string
  probability: number
  description: string
  low_confidence: boolean
  ai_outlook: AIOutlook
  salary: SalaryBenchmark
  skill_gap: SkillGap
}

export interface RankedRole {
  job_role: string
  label: string
  family: string
  probability: number
}

export interface Recommendation {
  roles: RoleRecommendation[]
  families: { family: string; probability: number }[]
  ranking: RankedRole[]
  notes: string[]
  profile: { region: string | null; experience_band: string | null; tech_areas_answered: TechBlock[] }
  model: {
    name: string
    classes: number
    test_top3_accuracy: number
    test_family_top3_accuracy: number
    test_rows: number
    intended_use: string
  }
  attribution: string
}

// 422 body written by the RequestValidationError handler in app/main.py
export interface FieldError {
  field: string
  message: string
}
