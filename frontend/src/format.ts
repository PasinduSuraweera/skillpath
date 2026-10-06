// Number formatting shared by the result components.

export function pct(p: number): string {
  const v = p * 100
  if (v > 0 && v < 1) return '<1%'
  if (v > 99 && v < 100) return '>99%'
  return `${Math.round(v)}%`
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function money(v: number | null | undefined): string {
  return v == null ? '–' : usd.format(v)
}

/** Signed change in percentage points, e.g. "+12.3 pts" (one decimal, so 65% -> 66% never reads as ±0). */
export function points(delta: number): string {
  const v = Math.round(delta * 1000) / 10
  if (v === 0) return '±0'
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} pts`
}

/**
 * Plain-words reading of how the probability is spread over the ranking (most
 * likely first), for the analysis summary: one clear match, a near tie at the
 * top, a few options, or a profile the model cannot narrow down.
 */
export function matchShape(probabilities: number[]): { title: string; detail: string } {
  const [a = 0, b = 0, c = 0] = probabilities
  const top3 = a + b + c
  if (a >= 0.5) return { title: 'Clear front-runner', detail: `Your best match alone holds ${pct(a)}` }
  if (top3 < 0.45) return { title: 'Broad profile', detail: `Your top 3 hold only ${pct(top3)}; many roles fit` }
  if (a - b < 0.08) return { title: 'Close race at the top', detail: `#1 and #2 are ${pct(a)} and ${pct(b)}` }
  return { title: 'A few strong options', detail: `Your top 3 hold ${pct(top3)}` }
}
