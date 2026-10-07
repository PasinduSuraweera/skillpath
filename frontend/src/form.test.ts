// Unit tests for the form logic: conversion to the API profile, client-side
// validation (which mirrors app/schemas.py), server error mapping and the
// what-if change descriptions.  Run: npm test
import { describe, expect, it } from 'vitest'
import optionsJson from '../../artifacts/options.json'
import type { Options } from './api/types'
import {
  describeChanges,
  emptyForm,
  fromProfile,
  serverErrors,
  stepOf,
  stepProgress,
  toProfile,
  validate,
  withTechnology,
} from './form'
import { SAMPLES } from './samples'

const options = optionsJson as unknown as Options

describe('toProfile / fromProfile', () => {
  it('sends an untouched form as an all-unknown profile', () => {
    expect(toProfile(emptyForm())).toEqual({
      country: null,
      years_code: null,
      work_exp: null,
      ed_level: null,
      learn_code_ai: null,
      tech: {},
      ai: { AISelect: null, AIAgents: null, AIAcc: null, AISent: null },
    })
  })

  it('leaves out untouched technology areas and sends "none" on its own', () => {
    const form = emptyForm()
    form.tech.Language.have = ['Python']
    form.tech.Webframe.none = true
    expect(toProfile(form).tech).toEqual({ Language: { have: ['Python'], want: [] }, Webframe: { none: true } })
  })

  it('turns year text into numbers and blank text into null', () => {
    const form = { ...emptyForm(), years_code: '7', work_exp: ' ', ed_level: '' }
    const p = toProfile(form)
    expect(p.years_code).toBe(7)
    expect(p.work_exp).toBeNull()
    expect(p.ed_level).toBeNull()
  })

  it.each(SAMPLES.map((s) => [s.id, s] as const))('round-trips the "%s" sample', (_, sample) => {
    const again = toProfile(fromProfile(sample.profile))
    expect(again.country).toBe(sample.profile.country)
    expect(again.years_code).toBe(sample.profile.years_code)
    for (const [block, answer] of Object.entries(sample.profile.tech ?? {})) {
      const sent = again.tech?.[block as keyof typeof again.tech]
      if (answer.none) expect(sent).toEqual({ none: true })
      else if (answer.have?.length || answer.want?.length) expect(sent?.have).toEqual(answer.have ?? [])
    }
  })
})

describe('validate', () => {
  it('accepts an empty form: every question is optional', () => {
    expect(validate(emptyForm(), options)).toEqual({})
  })

  it.each([
    ['-1', 'Enter a number from 0 to 60.'],
    ['61', 'Enter a number from 0 to 60.'],
    ['2.5', 'Enter years coding as a whole number of years.'],
    ['abc', 'Enter years coding as a whole number of years.'],
  ])('rejects years coding "%s"', (value, message) => {
    expect(validate({ ...emptyForm(), years_code: value }, options).years_code).toBe(message)
  })

  it.each(['0', '60', '', ' '])('accepts years coding "%s"', (value) => {
    expect(validate({ ...emptyForm(), years_code: value }, options)).toEqual({})
  })

  it('checks work experience the same way', () => {
    expect(validate({ ...emptyForm(), work_exp: '99' }, options).work_exp).toBe('Enter a number from 0 to 60.')
  })

  it('rejects a country that is not in the list', () => {
    expect(validate({ ...emptyForm(), country: 'Atlantis' }, options).country).toBe('Choose a country from the list.')
    expect(validate({ ...emptyForm(), country: 'Sri Lanka' }, options)).toEqual({})
  })

  it('rejects ticking 90% or more of a technology list, like the API', () => {
    const langs = options.tech.Language // 42 options -> 38 is the first rejected count
    const form = emptyForm()
    form.tech.Language.have = langs.slice(0, 37)
    expect(validate(form, options)).toEqual({})
    form.tech.Language.have = langs.slice(0, 38)
    expect(validate(form, options)['tech.Language']).toMatch(/^You selected 38 of 42\./)
  })

  it('passes every built-in sample', () => {
    for (const s of SAMPLES) expect(validate(fromProfile(s.profile), options), s.id).toEqual({})
  })
})

describe('samples', () => {
  it('only use answers the API offers', () => {
    const countries = new Set(options.countries.map((c) => c.Country))
    for (const { id, profile } of SAMPLES) {
      if (profile.country) expect(countries.has(profile.country), `${id} country`).toBe(true)
      if (profile.ed_level) expect(options.ed_level, `${id} education`).toContain(profile.ed_level)
      if (profile.learn_code_ai) expect(options.learn_code_ai, `${id} learn_code_ai`).toContain(profile.learn_code_ai)
      for (const [field, value] of Object.entries(profile.ai ?? {})) {
        if (value) expect(options.ai[field as keyof typeof options.ai], `${id} ${field}`).toContain(value)
      }
      for (const [block, answer] of Object.entries(profile.tech ?? {})) {
        const allowed = options.tech[block as keyof typeof options.tech]
        for (const t of [...(answer.have ?? []), ...(answer.want ?? [])]) {
          expect(allowed, `${id} ${block}`).toContain(t)
        }
      }
    }
  })

  it('have unique ids', () => {
    expect(new Set(SAMPLES.map((s) => s.id)).size).toBe(SAMPLES.length)
  })
})

describe('serverErrors / stepOf', () => {
  it('maps technology errors onto their area by the message prefix', () => {
    expect(
      serverErrors([
        { field: 'tech', message: "Language.have: unknown technologies ['Cobol++']." },
        { field: 'tech', message: "Webframe: 'I don't use any' cannot be combined with selected technologies." },
        { field: 'years_code', message: 'Input should be greater than or equal to 0' },
      ]),
    ).toEqual({
      'tech.Language': "Language.have: unknown technologies ['Cobol++'].",
      'tech.Webframe': "Webframe: 'I don't use any' cannot be combined with selected technologies.",
      years_code: 'Input should be greater than or equal to 0',
    })
  })

  it('keeps an unknown technology area error under "tech"', () => {
    expect(serverErrors([{ field: 'tech', message: "'Foo' is not a valid technology area." }])).toEqual({
      tech: "'Foo' is not a valid technology area.",
    })
  })

  it('joins two errors for the same field', () => {
    const e = serverErrors([
      { field: 'country', message: 'A.' },
      { field: 'country', message: 'B.' },
    ])
    expect(e.country).toBe('A. B.')
  })

  it.each([
    ['country', 0],
    ['years_code', 0],
    ['ed_level', 0],
    ['tech', 1],
    ['tech.SOTags', 1],
    ['learn_code_ai', 2],
    ['ai.AISelect', 2],
  ])('sends a "%s" error to step %i', (key, step) => {
    expect(stepOf(key)).toBe(step)
  })
})

describe('describeChanges / withTechnology', () => {
  const base = fromProfile(SAMPLES[0].profile)

  it('reports nothing when nothing changed', () => {
    expect(describeChanges(base, fromProfile(SAMPLES[0].profile))).toEqual([])
  })

  it('describes scalar, technology and AI changes in plain words', () => {
    const after = fromProfile(SAMPLES[0].profile)
    after.years_code = '8'
    after.country = null
    after.tech.Language.have = after.tech.Language.have.filter((t) => t !== 'Java').concat('Go')
    after.tech.Platform = { have: [], want: [], none: true }
    after.ai.AISelect = ''
    expect(describeChanges(base, after)).toEqual([
      'Country: Sri Lanka → not answered',
      'Years coding: 4 → 8',
      'Programming languages used: + Go',
      'Programming languages used: − Java',
      'Cloud and dev platforms used: − npm, Pip',
      'Cloud and dev platforms want to learn: − Docker, Amazon Web Services (AWS)',
      'Cloud and dev platforms: now “I don’t use any”',
      'AI tool use: Yes, I use AI tools daily → not answered',
    ])
  })

  it('adds a suggested technology as used and drops it from "want"', () => {
    const after = withTechnology(base, 'Language', 'TypeScript')
    expect(after.tech.Language.have).toContain('TypeScript')
    expect(after.tech.Language.want).not.toContain('TypeScript')
    expect(base.tech.Language.have).not.toContain('TypeScript') // the original is not mutated
    expect(describeChanges(base, after)).toEqual([
      'Programming languages used: + TypeScript',
      'Programming languages want to learn: − TypeScript',
    ])
  })

  it('clears "I don’t use any" when a technology is added to that area', () => {
    const none = fromProfile(SAMPLES[1].profile) // data sample: Webframe none
    expect(none.tech.Webframe.none).toBe(true)
    const after = withTechnology(none, 'Webframe', 'FastAPI')
    expect(after.tech.Webframe).toEqual({ have: ['FastAPI'], want: [], none: false })
  })

  it('does not add a technology twice', () => {
    expect(withTechnology(base, 'Language', 'Java').tech.Language.have.filter((t) => t === 'Java')).toHaveLength(1)
  })
})

describe('stepProgress', () => {
  it('counts nothing for an empty form', () => {
    expect(stepProgress(emptyForm())).toEqual([
      { answered: 0, total: 4 },
      { answered: 0, total: 7 },
      { answered: 0, total: 5 },
    ])
  })

  it('counts a technology area once, including "I don\u2019t use any"', () => {
    const form = emptyForm()
    form.tech.Language = { have: ['Python', 'Go'], want: ['Rust'], none: false }
    form.tech.Database = { have: [], want: [], none: true }
    form.years_code = '  '
    form.country = 'Sri Lanka'
    form.learn_code_ai = 'Yes'
    const [about, tech, ai] = stepProgress(form)
    expect(about.answered).toBe(1) // blank text does not count
    expect(tech.answered).toBe(2)
    expect(ai.answered).toBe(1)
  })

  it('never counts more than the total for the example profiles', () => {
    for (const s of SAMPLES) {
      for (const p of stepProgress(fromProfile(s.profile))) expect(p.answered).toBeLessThanOrEqual(p.total)
    }
  })
})
