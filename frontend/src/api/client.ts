import type { FieldError, Options, Profile, Recommendation } from './types'

/** The API rejected the answers (HTTP 422); `fields` says which and why. */
export class ValidationError extends Error {
  readonly fields: FieldError[]

  constructor(message: string, fields: FieldError[]) {
    super(message)
    this.fields = fields
  }
}

// a visitor to the hosted app cannot start anything: there the API sleeps when idle and takes about a minute to wake
const UNREACHABLE = import.meta.env.DEV
  ? 'Cannot reach the SkillPath API. Start it in another terminal with ' +
    '"uvicorn app.main:app --reload" (from the project root, with the venv active) and try again.'
  : 'Cannot reach the SkillPath API. It may be starting up, which takes about a minute after a quiet spell. Please try again shortly.'

// a 200 that is not the SkillPath API's JSON, e.g. an HTML page from a misconfigured proxy
const UNEXPECTED = import.meta.env.DEV
  ? 'The SkillPath API sent a response this page cannot read. Check that /api points at the SkillPath API ' +
    '(SKILLPATH_API for the dev server) and try again.'
  : 'The SkillPath API sent a response this page cannot read. It may still be starting up. Please try again in a minute.'

/** `valid` checks the parts of a successful body the page relies on, so a wrong one is an error, not a crash. */
async function request<T>(path: string, valid: (body: Partial<T> | null) => boolean, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new Error(UNREACHABLE)
  }
  // the Vite proxy answers 502/504 when uvicorn is not running
  if (res.status === 502 || res.status === 503 || res.status === 504) throw new Error(UNREACHABLE)
  const body = await res.json().catch(() => null)
  if (res.status === 422 && body?.fields) throw new ValidationError(body.message, body.fields)
  if (!res.ok) throw new Error(body?.detail ?? `The API returned an error (HTTP ${res.status}).`)
  if (!valid(body)) throw new Error(UNEXPECTED)
  return body as T
}

export function getOptions(): Promise<Options> {
  return request<Options>('/api/options', (o) => Array.isArray(o?.countries) && Array.isArray(o?.job_roles) && !!o?.tech && !!o?.limits)
}

export function predict(profile: Profile): Promise<Recommendation> {
  const valid = (r: Partial<Recommendation> | null) =>
    Array.isArray(r?.roles) && r.roles.length > 0 && Array.isArray(r?.ranking) && Array.isArray(r?.families) && !!r?.model
  return request<Recommendation>('/api/predict', valid, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
}
