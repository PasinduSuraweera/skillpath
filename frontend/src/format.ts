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
