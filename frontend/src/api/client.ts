import type { FieldError, Options, Profile, Recommendation } from './types'

/** The API rejected the answers (HTTP 422); `fields` says which and why. */
export class ValidationError extends Error {
  readonly fields: FieldError[]

  constructor(message: string, fields: FieldError[]) {
    super(message)
    this.fields = fields
  }
}

const UNREACHABLE =
  'Cannot reach the SkillPath API. Start it in another terminal with ' +
  '"uvicorn app.main:app --reload" (from the project root, with the venv active) and try again.'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
  return body as T
}

export function getOptions(): Promise<Options> {
  return request<Options>('/api/options')
}

export function predict(profile: Profile): Promise<Recommendation> {
  return request<Recommendation>('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
}
