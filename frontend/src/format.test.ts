// Unit tests for number formatting.  Run: npm test
import { describe, expect, it } from 'vitest'
import { matchShape, money, pct, points } from './format'

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

describe('matchShape', () => {
  it('names a single strong match', () => {
    expect(matchShape([0.64, 0.23, 0.03]).title).toBe('Clear front-runner')
  })
  it('names a near tie at the top', () => {
    expect(matchShape([0.31, 0.27, 0.12]).title).toBe('Close race at the top')
  })
  it('names a spread-out profile', () => {
    expect(matchShape([0.18, 0.14, 0.1]).title).toBe('Broad profile')
  })
  it('falls back to a few options', () => {
    expect(matchShape([0.42, 0.2, 0.1]).title).toBe('A few strong options')
  })
  it('copes with a short list', () => {
    expect(matchShape([]).title).toBe('Broad profile')
  })
})
