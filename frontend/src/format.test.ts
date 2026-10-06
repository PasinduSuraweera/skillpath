// Unit tests for number formatting.  Run: npm test
import { describe, expect, it } from 'vitest'
import { money, pct, points } from './format'

describe('pct', () => {
  it.each([
    [0, '0%'],
    [0.004, '<1%'],
    [0.01, '1%'],
    [0.645, '65%'],
    [0.996, '>99%'],
    [1, '100%'],
  ])('%f -> %s', (p, text) => expect(pct(p)).toBe(text))
})

describe('points', () => {
  it.each([
    [0, '±0'],
    [0.0004, '±0'],
    [0.006, '+0.6 pts'], // 65% -> 66% must not read as ±0
    [-0.123, '−12.3 pts'],
    [0.2, '+20.0 pts'],
  ])('%f -> %s', (d, text) => expect(points(d)).toBe(text))
})

describe('money', () => {
  it('formats whole US dollars and shows a dash for missing values', () => {
    expect(money(23400)).toBe('$23,400')
    expect(money(null)).toBe('–')
    expect(money(undefined)).toBe('–')
  })
})
