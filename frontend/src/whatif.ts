// What-if comparison: how the ranking moved between the previous result and the
// current one, and the few plain-words points worth saying about it.
import type { Recommendation } from './api/types'
import { pct, points } from './format'

/** Changes smaller than this (0.05 percentage points) count as no change. */
const NOISE = 0.0005

export interface Movement {
  job_role: string
  label: string
  before: { probability: number; rank: number }
  after: { probability: number; rank: number }
  delta: number
  /** rank change: positive = moved up the ranking */
  climb: number
  /** in the top 3 now but not before */
  entered: boolean
  /** in the top 3 before but not now */
  left: boolean
}

function position(r: Recommendation, job: string) {
  const i = r.ranking.findIndex((x) => x.job_role === job)
  return { probability: i < 0 ? 0 : r.ranking[i].probability, rank: i < 0 ? r.ranking.length + 1 : i + 1 }
}

/** Every role that was in either top 3, current order first, with its before and after position. */
export function compareRuns(before: Recommendation, after: Recommendation): Movement[] {
  const nowTop = after.roles.map((r) => r.job_role)
  const wasTop = before.roles.map((r) => r.job_role)
  const jobs = [...new Set([...nowTop, ...wasTop])]
  return jobs.map((job) => {
    const b = position(before, job)
    const a = position(after, job)
    return {
      job_role: job,
      label: after.ranking.find((x) => x.job_role === job)?.label ?? before.ranking.find((x) => x.job_role === job)?.label ?? job,
      before: b,
      after: a,
      delta: a.probability - b.probability,
      climb: b.rank - a.rank,
      entered: nowTop.includes(job) && !wasTop.includes(job),
      left: wasTop.includes(job) && !nowTop.includes(job),
    }
  })
}

export type Highlight = { tone: 'up' | 'down' | 'same'; text: string }

/**
 * Up to three sentences that say what the change did: whether the best match
 * changed, which roles entered or left the top 3, and the biggest shift otherwise.
 */
export function whatIfHighlights(before: Recommendation, after: Recommendation): Highlight[] {
  const rows = compareRuns(before, after)
  const out: Highlight[] = []
  const topNow = rows.find((r) => r.after.rank === 1)!
  const topBefore = rows.find((r) => r.before.rank === 1)!

  if (topNow.job_role !== topBefore.job_role) {
    out.push({ tone: 'up', text: `${topNow.label} is now your best match (was #${topNow.before.rank}).` })
  } else if (Math.abs(topNow.delta) >= NOISE) {
    out.push({
      tone: topNow.delta > 0 ? 'up' : 'down',
      text: `${topNow.label} is still your best match, ${topNow.delta > 0 ? 'up' : 'down'} ${points(topNow.delta).replace(/^[+−]/, '')} to ${pct(topNow.after.probability)}.`,
    })
  } else {
    out.push({ tone: 'same', text: `${topNow.label} is still your best match, unchanged at ${pct(topNow.after.probability)}.` })
  }

  for (const r of rows) {
    if (out.length >= 3) break
    if (r.job_role === topNow.job_role) continue
    if (r.entered) out.push({ tone: 'up', text: `${r.label} moved into your top 3 (#${r.before.rank} → #${r.after.rank}).` })
    else if (r.left) out.push({ tone: 'down', text: `${r.label} dropped out of your top 3 (#${r.before.rank} → #${r.after.rank}).` })
  }

  if (out.length === 1) {
    // no change in the top 3 line-up: name the largest shift among the others, if any
    const moved = rows
      .filter((r) => r.job_role !== topNow.job_role && Math.abs(r.delta) >= NOISE)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
    if (moved) {
      out.push({
        tone: moved.delta > 0 ? 'up' : 'down',
        text:
          moved.climb !== 0
            ? `${moved.label} moved from #${moved.before.rank} to #${moved.after.rank} (${points(moved.delta)}).`
            : `${moved.label} ${moved.delta > 0 ? 'gained' : 'lost'} ${points(moved.delta).replace(/^[+−]/, '')}.`,
      })
    } else {
      out.push({ tone: 'same', text: 'The rest of your top 3 did not change.' })
    }
  }
  return out
}
