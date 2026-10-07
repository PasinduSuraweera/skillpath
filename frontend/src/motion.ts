// Motion tokens and helpers. The theme (MUI's transitions) and the global CSS
// variables (--ease-out, --dur-*) are both built from these values, so every
// animation in the app shares one easing and duration scale.
//
// Hierarchy of motion, from most to least used:
//   1. essential: state changes, navigation, feedback, loading (CSS transitions, < 300 ms)
//   2. helpful:   selection, data that changes, progressive disclosure (CSS / WAAPI, < 300 ms)
//   3. explanatory, once per result: the match count-up and the results reveal (longer, see DURATION.reveal)
// Each explanatory animation plays once per new result. Nothing loops except the loading ring
// while a request is actually slow, and nothing animates on a keyboard shortcut or while typing.
//
// Tools: CSS keyframes for fixed entrances (index.css), CSS transitions for
// anything that can be re-triggered, and the Web Animations API for the two
// dynamic cases (layout moves and change highlights). No spring library: there
// are no gestures to carry velocity through, so curves are enough.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'

export const EASE = {
  /** entering / exiting / feedback: starts fast, so the UI feels instant */
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  /** something already on screen moving or changing size */
  inOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
  /** colour and background changes */
  standard: 'ease',
}

/** Milliseconds. UI motion stays under 300 ms; only the explanatory tokens at the end are longer. */
export const DURATION = {
  press: 140, // button press
  hover: 150, // colour and background changes
  small: 180, // tooltips, icons, exits
  medium: 220, // menus, step content, alerts
  large: 280, // panels expanding, items changing place
  /** each step of the results reveal (summary, role cards, the rest) */
  enter: 360,
  /** a number counting up to a new result: long enough to read as "computed", once per result */
  reveal: 650,
  /** a figure changing after a what-if: the new value settles in place */
  update: 420,
  /** tint that marks a value which just changed, fading out so the eye can find it */
  highlight: 1100,
  /** the light/dark switch spreading from its button: rare and deliberate, so allowed to be seen */
  theme: 420,
}

/** Delay between items of a small group entrance (alerts, panels). */
export const STAGGER = 40
/** Delay between the steps of the results reveal (summary, then each role card, then the rest). */
export const STAGGER_REVEAL = 70

/** Busy indicators wait this long, so a fast answer (the API takes ~15 ms) never flickers. */
export const BUSY_DELAY = 200

/** CSS custom properties for the stylesheet (index.css) and sx props. */
export const motionCssVars = {
  '--ease-out': EASE.out,
  '--ease-in-out': EASE.inOut,
  '--dur-press': `${DURATION.press}ms`,
  '--dur-hover': `${DURATION.hover}ms`,
  '--dur-small': `${DURATION.small}ms`,
  '--dur-medium': `${DURATION.medium}ms`,
  '--dur-large': `${DURATION.large}ms`,
  '--dur-enter': `${DURATION.enter}ms`,
  '--dur-highlight': `${DURATION.highlight}ms`,
  '--stagger': `${STAGGER}ms`,
  '--stagger-reveal': `${STAGGER_REVEAL}ms`,
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Whether the results on screen are being revealed (a new result) or returned to (Undo,
 * the stepper). The reveal and the count-ups explain a new result, so a return shows
 * everything as it was left instead of playing them again.
 */
export const RevealContext = createContext(true)
export const useReveal = () => useContext(RevealContext)

/** True once `on` has stayed true for `delay` ms; false again as soon as it turns off. */
export function useDelayedFlag(on: boolean, delay = BUSY_DELAY): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!on) return
    const t = window.setTimeout(() => setShown(true), delay)
    return () => {
      window.clearTimeout(t)
      setShown(false)
    }
  }, [on, delay])
  return on && shown
}

type ViewTransition = { ready: Promise<void>; finished: Promise<void> }

/**
 * Run a DOM-changing update as a View Transition where the browser supports it.
 * Given a point (the theme button's centre), the new page is revealed in a circle
 * growing from it; otherwise, and with reduced motion, it is a short crossfade
 * (index.css). Without View Transitions the update simply happens.
 */
export function withViewTransition(update: () => void, from?: { x: number; y: number }) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => ViewTransition }
  if (!doc.startViewTransition) return update()
  const root = document.documentElement
  // the page's own colour transitions wait while the new state is drawn: the switch is the
  // transition, and inside it text would otherwise still be fading from its old colour
  root.classList.add('sp-instant')
  const release = () => root.classList.remove('sp-instant')
  if (!doc.startViewTransition) {
    update()
    requestAnimationFrame(() => requestAnimationFrame(release))
    return
  }
  const reveal = !!from && !prefersReducedMotion()
  if (reveal) root.classList.add('sp-theme-reveal') // turns off the default crossfade
  const transition = doc.startViewTransition(update)
  transition.finished.finally(release).catch(() => {})
  if (!reveal || !from) return
  transition.ready
    .then(() => {
      // radius that reaches the farthest corner of the window
      const r = Math.hypot(Math.max(from.x, innerWidth - from.x), Math.max(from.y, innerHeight - from.y))
      root.animate(
        { clipPath: [`circle(0px at ${from.x}px ${from.y}px)`, `circle(${r}px at ${from.x}px ${from.y}px)`] },
        { duration: DURATION.theme, easing: EASE.out, pseudoElement: '::view-transition-new(root)' },
      )
    })
    .catch(() => {})
  transition.finished.finally(() => root.classList.remove('sp-theme-reveal')).catch(() => {})
}

// ---------------------------------------------------------------------------
// Curves in JavaScript (for values drawn frame by frame, like a count-up)
// ---------------------------------------------------------------------------

/**
 * The CSS cubic-bezier() timing function as a function of progress (0-1), so a
 * value animated in JavaScript follows exactly the same curve as the CSS ones.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const x = (s: number) => ((ax * s + bx) * s + cx) * s
  const y = (s: number) => ((ay * s + by) * s + cy) * s
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx
  return (t) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    // Newton's method for the curve parameter whose x is t, with bisection as the fallback
    let s = t
    for (let i = 0; i < 8; i++) {
      const err = x(s) - t
      if (Math.abs(err) < 1e-6) return y(s)
      const d = dx(s)
      if (Math.abs(d) < 1e-6) break
      s -= err / d
    }
    let lo = 0
    let hi = 1
    s = t
    while (hi - lo > 1e-6) {
      if (x(s) < t) lo = s
      else hi = s
      s = (lo + hi) / 2
    }
    return y(s)
  }
}

const parseBezier = (css: string) => cubicBezier(...(css.match(/[\d.]+/g)!.map(Number) as [number, number, number, number]))
export const easeOut = parseBezier(EASE.out)
export const easeInOut = parseBezier(EASE.inOut)

/** The value `progress` (0-1) of the way from `from` to `to` along `ease`. */
export const tween = (from: number, to: number, progress: number, ease: (t: number) => number = easeOut) =>
  from + (to - from) * ease(Math.min(1, Math.max(0, progress)))

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * A number that counts to `target`: from 0 the first time (the result being
 * revealed), then from wherever it is to each new target (a what-if moving it).
 * With `from`, the first count starts there instead and moves like an update
 * (a what-if "after" figure leaving its "before" value). Returns the value to
 * draw and whether it is still moving. With reduced motion it is always the target,
 * and results being returned to (RevealContext) start at it.
 */
export function useCountUp(target: number, from?: number): { value: number; moving: boolean } {
  const reduce = prefersReducedMotion()
  const reveal = useReveal()
  const [value, setValue] = useState(() => (reduce || !reveal ? target : (from ?? 0)))
  const shown = useRef(value)
  // false until the first count has finished: an interrupted first count is still the reveal
  const settled = useRef(from !== undefined || !reveal)

  useEffect(() => {
    const from = shown.current
    if (reduce || from === target) {
      shown.current = target
      settled.current = true
      setValue(target)
      return
    }
    const reveal = !settled.current
    const duration = reveal ? DURATION.reveal : DURATION.update
    const ease = reveal ? easeOut : easeInOut
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const p = (now - start) / duration
      shown.current = tween(from, target, p, ease)
      setValue(shown.current)
      if (p < 1) frame = requestAnimationFrame(tick)
      else settled.current = true
    })
    return () => cancelAnimationFrame(frame)
  }, [target, reduce])

  return { value: reduce ? target : value, moving: !reduce && value !== target }
}

type Point = { x: number; y: number }

/**
 * FLIP for a list whose order can change: children marked `data-flip="<id>"`
 * glide from where they were to where they are now, instead of jumping, so a
 * role that moves from #3 to #1 is seen moving. Pass a string that changes when
 * the order does (the ids joined); other re-renders never animate. Items that
 * are new to the list are left to their own entrance animation.
 */
export function useFlip<T extends HTMLElement>(order: string) {
  const root = useRef<T>(null)
  const last = useRef(new Map<string, Point>())
  const lastOrder = useRef(order)

  const measure = () => {
    const el = root.current
    const map = new Map<string, Point>()
    if (!el) return map
    const base = el.getBoundingClientRect()
    el.querySelectorAll<HTMLElement>('[data-flip]').forEach((item) => {
      const r = item.getBoundingClientRect()
      // relative to the list, so scrolling or content above it moving does not count as a move
      map.set(item.dataset.flip!, { x: r.left - base.left, y: r.top - base.top })
    })
    return map
  }

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    // positions without any move still in flight
    el.querySelectorAll<HTMLElement>('[data-flip]').forEach((item) =>
      item.getAnimations().forEach((a) => a.id === 'flip' && a.cancel()),
    )
    const now = measure()
    if (order !== lastOrder.current && !prefersReducedMotion()) {
      el.querySelectorAll<HTMLElement>('[data-flip]').forEach((item) => {
        const before = last.current.get(item.dataset.flip!)
        const after = now.get(item.dataset.flip!)
        if (!before || !after) return
        const dx = before.x - after.x
        const dy = before.y - after.y
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
        const move = item.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
          duration: DURATION.large + 60,
          easing: EASE.inOut,
        })
        move.id = 'flip'
      })
    }
    lastOrder.current = order
    last.current = now
  })

  // the layout can change without a re-render (window resized, phone rotated): keep the
  // stored positions current so the next reorder starts from the right place
  useEffect(() => {
    const el = root.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      last.current = measure()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, []) // measure only reads refs

  return root
}

/**
 * Briefly tints an element when `value` changes (never on first render), so the
 * eye finds what a what-if changed. Colour only, so it also runs with reduced motion.
 */
export function useHighlight<T extends HTMLElement>(value: unknown, color: string) {
  const ref = useRef<T>(null)
  const previous = useRef(value)
  useEffect(() => {
    if (Object.is(previous.current, value)) return
    previous.current = value
    ref.current?.animate([{ backgroundColor: color }, { backgroundColor: 'transparent' }], {
      duration: DURATION.highlight,
      easing: EASE.out,
    })
  }, [value, color])
  return ref
}
