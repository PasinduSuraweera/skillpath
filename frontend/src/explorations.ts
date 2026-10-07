// The visitor's explorations in this session: every prediction, in order, with the answers
// that produced it and what changed since the one before. Kept in memory only (nothing is
// stored or sent anywhere), so the results page can show how the what-ifs moved the result
// and return to an earlier set of answers.
import type { Recommendation } from './api/types'
import type { FormState } from './form'

export interface Exploration {
  /** run number in this session, from 1 */
  id: number
  /** when the result arrived (ms since the epoch) */
  at: number
  form: FormState
  result: Recommendation
  /** differences from the previous exploration's answers (describeChanges); empty for the first */
  changes: string[]
  /** the technology a "what if I add" shortcut added, if that is how this run started */
  tech: string | null
  /** the earlier run whose answers this one went back to, if any */
  from: number | null
}

/** Explorations kept: enough to retrace a session, few enough to scan. */
export const MAX_EXPLORATIONS = 8

/** A short description of how an exploration came about (the first one is the starting point). */
export function explorationLabel(e: Exploration): string {
  if (e.from !== null) return `Back to run ${e.from}`
  if (!e.changes.length) return 'Your answers'
  if (e.tech) return `Added ${e.tech}`
  return e.changes.length === 1 ? '1 answer changed' : `${e.changes.length} answers changed`
}
