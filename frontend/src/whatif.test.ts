// Unit tests for the what-if comparison (rank movements and the plain-words summary).  Run: npm test
import { describe, expect, it } from 'vitest'
import type { Recommendation, RoleRecommendation } from './api/types'
import { compareRuns, whatIfHighlights } from './whatif'

/** A result whose ranking is the given [job, probability] pairs (most likely first); the top 3 are the roles. */
function result(order: [string, number][]): Recommendation {
  const ranking = order.map(([job, probability]) => ({ job_role: job, label: `${job} Developer`, family: 'X', probability }))
  return {
    roles: ranking.slice(0, 3).map((r, i) => ({ ...r, rank: i + 1 }) as unknown as RoleRecommendation),
    ranking,
    families: [],
    notes: [],
    profile: { region: null, experience_band: null, tech_areas_answered: [] },
    model: { name: 'm', classes: order.length, test_top3_accuracy: 0.8, test_family_top3_accuracy: 0.9, test_rows: 100, intended_use: '' },
    attribution: '',
  }
}

const before = result([['A', 0.6], ['B', 0.2], ['C', 0.1], ['D', 0.06], ['E', 0.04]])

describe('compareRuns', () => {
  it('lists the current top 3 first, then roles that left it, with ranks on both sides', () => {
    const after = result([['A', 0.55], ['D', 0.22], ['B', 0.12], ['C', 0.07], ['E', 0.04]])
    const rows = compareRuns(before, after)
    expect(rows.map((r) => r.job_role)).toEqual(['A', 'D', 'B', 'C'])
    const d = rows[1]
    expect(d.before.rank).toBe(4)
    expect(d.after.rank).toBe(2)
    expect(d.climb).toBe(2)
    expect(d.entered).toBe(true)
    expect(d.delta).toBeCloseTo(0.16)
    const c = rows[3]
    expect(c.left).toBe(true)
    expect(c.climb).toBe(-1)
  })
})

describe('whatIfHighlights', () => {
  it('says when the best match changes', () => {
    const after = result([['B', 0.5], ['A', 0.3], ['C', 0.1], ['D', 0.06], ['E', 0.04]])
    expect(whatIfHighlights(before, after)[0]).toEqual({ tone: 'up', text: 'B Developer is now your best match (was #2).' })
  })

  it('names roles entering and leaving the top 3', () => {
    const after = result([['A', 0.55], ['D', 0.22], ['B', 0.12], ['C', 0.07], ['E', 0.04]])
    const texts = whatIfHighlights(before, after).map((h) => h.text)
    expect(texts[0]).toBe('A Developer is still your best match, down 5.0 pts to 55%.')
    expect(texts).toContain('D Developer moved into your top 3 (#4 → #2).')
    expect(texts).toContain('C Developer dropped out of your top 3 (#3 → #4).')
    expect(texts.length).toBeLessThanOrEqual(3)
  })

  it('falls back to the largest shift when the line-up is the same', () => {
    const after = result([['A', 0.6], ['B', 0.15], ['C', 0.14], ['D', 0.07], ['E', 0.04]])
    const h = whatIfHighlights(before, after)
    expect(h[0].tone).toBe('same')
    expect(h[1]).toEqual({ tone: 'down', text: 'B Developer lost 5.0 pts.' })
  })

  it('says so when nothing moved', () => {
    expect(whatIfHighlights(before, before).map((h) => h.tone)).toEqual(['same', 'same'])
  })
})
