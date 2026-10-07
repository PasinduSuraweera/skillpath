import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DURATION, RevealContext, cubicBezier, easeInOut, easeOut, motionCssVars, tween, useCountUp } from './motion'

describe('cubicBezier', () => {
  it('starts at 0 and ends at 1', () => {
    for (const ease of [easeOut, easeInOut]) {
      expect(ease(0)).toBe(0)
      expect(ease(1)).toBe(1)
      expect(ease(-0.5)).toBe(0)
      expect(ease(2)).toBe(1)
    }
  })

  it('is the identity for the linear curve', () => {
    const linear = cubicBezier(0, 0, 1, 1)
    for (const t of [0.1, 0.25, 0.5, 0.9]) expect(linear(t)).toBeCloseTo(t, 4)
  })

  it('matches the CSS keyword curves', () => {
    // reference values for cubic-bezier(0.25, 0.1, 0.25, 1) ("ease") at t = 0.5
    expect(cubicBezier(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024, 3)
    // ease-in-out is symmetric about the middle
    const inOut = cubicBezier(0.42, 0, 0.58, 1)
    expect(inOut(0.5)).toBeCloseTo(0.5, 4)
    expect(inOut(0.3) + inOut(0.7)).toBeCloseTo(1, 4)
  })

  it('never goes backwards', () => {
    for (const ease of [easeOut, easeInOut]) {
      let prev = 0
      for (let t = 0; t <= 1; t += 0.01) {
        const v = ease(t)
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
        prev = v
      }
    }
  })

  it('front-loads the ease-out: most of the change happens early', () => {
    expect(easeOut(0.25)).toBeGreaterThan(0.7)
    expect(easeInOut(0.25)).toBeLessThan(0.15)
  })
})

describe('tween', () => {
  it('interpolates and clamps progress', () => {
    expect(tween(0, 0.64, 0)).toBe(0)
    expect(tween(0, 0.64, 1)).toBeCloseTo(0.64)
    expect(tween(0.64, 0.2, 5)).toBeCloseTo(0.2)
    expect(tween(10, 20, 0.5, (t) => t)).toBe(15)
  })
})

describe('motion tokens', () => {
  it('keeps interface motion under 300 ms', () => {
    for (const key of ['press', 'hover', 'small', 'medium', 'large'] as const) expect(DURATION[key]).toBeLessThan(300)
  })

  it('exposes every duration used by the stylesheet as a CSS variable', () => {
    expect(motionCssVars['--dur-enter']).toBe(`${DURATION.enter}ms`)
    expect(motionCssVars['--stagger-reveal']).toMatch(/^\d+ms$/)
  })
})

describe('useCountUp', () => {
  /** the figure drawn on the first frame */
  const firstFrame = (reveal: boolean, from?: number) => {
    const Probe = () => String(useCountUp(0.42, from).value)
    return renderToString(createElement(RevealContext.Provider, { value: reveal }, createElement(Probe)))
  }

  it('counts a new result up from 0, or from its previous figure', () => {
    expect(firstFrame(true)).toBe('0')
    expect(firstFrame(true, 0.3)).toBe('0.3')
  })

  it('shows results that are returned to at their final figures', () => {
    expect(firstFrame(false)).toBe('0.42')
    expect(firstFrame(false, 0.3)).toBe('0.42')
  })
})
