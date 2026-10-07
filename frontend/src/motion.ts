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
// Tools, all timed from the tokens below:
//   - Motion (motion/react): elements that animate as React adds and removes them
//     (AnimatePresence: wizard steps, the what-if comparison, the role insights, the
//     theme icon; PopTransition for popups), the results reveal (revealMotion) and the
//     sections further down that rise as they scroll into view (inViewMotion), things
//     that move to a new place (layout: table rows reordering, content making room for
//     the comparison), selection indicators that slide between choices (layoutId on a
//     spring: nav, steps, role switcher, answers), bars and rings filling in, and cards
//     that both lift and press (whileHover / whileTap)
//   - CSS keyframes for small fixed entrances (index.css), and CSS transitions for
//     anything re-triggered, including the press on buttons
//   - the Web Animations API for the tint on figures that a what-if changed
import { useInView, useReducedMotion } from 'motion/react'
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { RefObject } from 'react'

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
const BUSY_DELAY = 200

/** CSS custom properties for the stylesheet (index.css): the tokens its keyframes use. */
export const motionCssVars = {
  '--ease-out': EASE.out,
  '--dur-small': `${DURATION.small}ms`,
  '--dur-medium': `${DURATION.medium}ms`,
  '--dur-large': `${DURATION.large}ms`,
  '--stagger': `${STAGGER}ms`,
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

/** True for an element inside content on its way out (a wizard step leaving: StepPane marks it data-leaving). */
export const isLeaving = (el: Element) => !!el.closest('[data-leaving]')

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

type Bezier = [number, number, number, number]
const bezierPoints = (css: string) => css.match(/[\d.]+/g)!.map(Number) as Bezier
export const easeOut = cubicBezier(...bezierPoints(EASE.out))
export const easeInOut = cubicBezier(...bezierPoints(EASE.inOut))

// ---------------------------------------------------------------------------
// The same tokens for Motion (seconds, and curves as control points)
// ---------------------------------------------------------------------------

const motionTween = (ms: number, css: string = EASE.out) => ({ duration: ms / 1000, ease: bezierPoints(css) })

/** Motion transitions on the DURATION scale: entering, leaving and feedback on EASE.out. */
export const TRANSITION = {
  press: motionTween(DURATION.press),
  small: motionTween(DURATION.small),
  medium: motionTween(DURATION.medium),
  large: motionTween(DURATION.large),
  enter: motionTween(DURATION.enter),
  /** something already on screen moving or resizing */
  move: motionTween(DURATION.large, EASE.inOut),
  /** a figure or bar settling on a new value after a what-if */
  update: motionTween(DURATION.update, EASE.inOut),
  /** a bar or ring filling in with a new result, in step with its figure counting up */
  reveal: motionTween(DURATION.reveal),
  /**
   * A selection indicator sliding between choices (nav, steps, role switcher, answers):
   * a critically damped spring with a hint of life, so it arrives rather than stops.
   */
  spring: { type: 'spring' as const, bounce: 0.14, duration: 0.42 },
}

// ---------------------------------------------------------------------------
// Scroll reveals: shared variants (one place for every "appears as you scroll" pattern)
// ---------------------------------------------------------------------------

/** When a section counts as in view: once, as its top passes 8% above the bottom of the window. */
export const VIEWPORT = { once: true, margin: '0px 0px -8% 0px' } as const
/** Between the members of a revealed group (header, then each card): hierarchy, not a wait. */
export const STAGGER_CHILDREN = 0.05

const rise = { ...TRANSITION.enter, duration: 0.5 }

/**
 * Variants for scroll reveals, all "hidden" → "shown". A container reveals on view and its
 * children (with only `variants`) follow it, STAGGER_CHILDREN apart:
 *   fadeUp           text and headings: a short rise
 *   fadeIn           supporting details: a fade
 *   scaleIn          small figures and badges: settle from just under full size
 *   glassLift        glass tiles: rise and settle a touch larger, then reveal their own children
 *   staggerContainer a group that only orders its children (no fade of its own, so glass inside keeps its blur)
 *   item             rows inside a revealed tile (timeline stages, list rows)
 *   fromLeft, depth, fromRight
 *                    cards of a row arriving from different depths: the outer ones slide in from
 *                    their own side, the middle one rises from further back, so the row assembles
 *                    in space rather than fading up as one
 * With reduced motion Motion keeps the fades and drops the movement (MotionProvider).
 */
const assemble = { ...rise, duration: 0.62, staggerChildren: STAGGER_CHILDREN, delayChildren: 0.12 }
export const VARIANTS = {
  fadeUp: { hidden: { opacity: 0, y: 16 }, shown: { opacity: 1, y: 0, transition: rise } },
  fadeIn: { hidden: { opacity: 0 }, shown: { opacity: 1, transition: rise } },
  scaleIn: { hidden: { opacity: 0, scale: 0.94 }, shown: { opacity: 1, scale: 1, transition: rise } },
  glassLift: {
    hidden: { opacity: 0, y: 28, scale: 0.985 },
    shown: { opacity: 1, y: 0, scale: 1, transition: { ...rise, staggerChildren: STAGGER_CHILDREN, delayChildren: 0.1 } },
  },
  fromLeft: { hidden: { opacity: 0, x: -40, y: 14, scale: 0.97 }, shown: { opacity: 1, x: 0, y: 0, scale: 1, transition: assemble } },
  depth: { hidden: { opacity: 0, y: 44, scale: 0.94 }, shown: { opacity: 1, y: 0, scale: 1, transition: assemble } },
  fromRight: { hidden: { opacity: 0, x: 40, y: 14, scale: 0.97 }, shown: { opacity: 1, x: 0, y: 0, scale: 1, transition: assemble } },
  staggerContainer: { hidden: {}, shown: { transition: { staggerChildren: STAGGER_CHILDREN * 2 } } },
  item: { hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0, transition: TRANSITION.large } },
}
export type Variant = keyof typeof VARIANTS

/**
 * A group that reveals as it scrolls into view, once, and orders its children (give them
 * `revealChild`). Returned to (RevealContext false) everything is simply there. Marked
 * data-reveal, so print (which never scrolls) shows it in full (index.css).
 */
export const onView = (reveal: boolean, variant: Variant = 'staggerContainer') =>
  reveal ? { 'data-reveal': '', initial: 'hidden', whileInView: 'shown', viewport: VIEWPORT, variants: VARIANTS[variant] } : {}

/** A member of an onView group: follows the group's reveal in order. Print shows it in full. */
export const revealChild = (variant: Variant) => ({ 'data-reveal': '', variants: VARIANTS[variant] })

/**
 * The variant for the card at `i` of a row of `n`: in from the left, up from depth, in from the
 * right. Only while the cards really sit side by side (`row`); stacked on a phone, each rises.
 */
export const rowVariant = (i: number, n: number, row = true): Variant =>
  !row || n < 2 ? 'depth' : i === 0 ? 'fromLeft' : i === n - 1 ? 'fromRight' : 'depth'

/**
 * Something that opens in the page: the what-if comparison, an alert. Nothing animates its
 * height: the content below slides to make room (layout, see makeRoom), then it fades in.
 * On the way out it is lifted out of the page (AnimatePresence mode="popLayout") and fades,
 * and the content below waits for it before closing the gap, so nothing slides over it.
 */
export const OPENING = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0, transition: { ...TRANSITION.medium, delay: 0.12 } },
  exit: { opacity: 0, y: -8, transition: TRANSITION.small },
}
/** With reduced motion the content below jumps instead of sliding, so the panel goes at once too. */
export const OPENING_REDUCED = { ...OPENING, exit: { opacity: 0, transition: { duration: 0 } } }

/** Layout transition for the content below something that is open (it slides at once) or has just closed (it waits). */
export const makeRoom = (open: boolean) => (open ? TRANSITION.move : { ...TRANSITION.move, delay: TRANSITION.small.duration })

/**
 * One step of the results reveal, `i` steps (STAGGER_REVEAL apart) into it: a short rise
 * into place. `reveal` false (results being returned to, see RevealContext) starts it in
 * place. With reduced motion Motion drops the rise and keeps the fade.
 */
export const revealMotion = (i: number, reveal: boolean) => ({
  initial: reveal ? { opacity: 0, y: 14 } : (false as const),
  animate: { opacity: 1, y: 0 },
  transition: { ...TRANSITION.enter, delay: (i * STAGGER_REVEAL) / 1000, layout: TRANSITION.move },
})

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
 * and results being returned to (RevealContext) start at it. With `active` false (not
 * scrolled into view yet, see useSeen) it waits at its starting figure.
 */
export function useCountUp(target: number, from?: number, active = true): { value: number; moving: boolean } {
  const reduce = prefersReducedMotion()
  const reveal = useReveal()
  const [value, setValue] = useState(() => (reduce || !reveal ? target : (from ?? 0)))
  const shown = useRef(value)
  // false until the first count has finished: an interrupted first count is still the reveal
  const settled = useRef(from !== undefined || !reveal)

  useEffect(() => {
    // not yet in view (useSeen): hold the starting figure, and count once it is
    if (!active && !reduce) return
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
  }, [target, reduce, active])

  return { value: reduce ? target : value, moving: !reduce && value !== target }
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

// ---------------------------------------------------------------------------
// Scroll-aware hooks
// ---------------------------------------------------------------------------

const printQuery = () => (typeof window === 'undefined' ? null : window.matchMedia?.('print') ?? null)
let printing = false
function subscribePrint(onChange: () => void) {
  const set = (on: boolean) => () => {
    printing = on
    onChange()
  }
  const before = set(true)
  const after = set(false)
  const mq = printQuery()
  const media = (e: MediaQueryListEvent) => set(e.matches)()
  window.addEventListener('beforeprint', before)
  window.addEventListener('afterprint', after)
  mq?.addEventListener?.('change', media)
  return () => {
    window.removeEventListener('beforeprint', before)
    window.removeEventListener('afterprint', after)
    mq?.removeEventListener?.('change', media)
  }
}
/** True while the page is being printed (print never scrolls, so nothing may wait for a scroll). */
export const usePrinting = () => useSyncExternalStore(subscribePrint, () => printing, () => false)

/**
 * Whether a figure has come into view, so it can fill or count up as the visitor reaches it
 * rather than off screen: once, a little before its bottom edge is visible. Results returned
 * to (RevealContext false) and print count as seen at once.
 */
export function useSeen(ref: RefObject<Element | null>): boolean {
  const reveal = useReveal()
  const inView = useInView(ref, { once: true, margin: '0px 0px -6% 0px' })
  const print = usePrinting()
  return inView || !reveal || print
}

const FX_QUERY = '(min-width: 900px) and (pointer: fine)'
function subscribeFx(onChange: () => void) {
  const mq = window.matchMedia(FX_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
/**
 * Whether scroll-linked depth (parallax, the hero handing over to the next section) runs:
 * wide screens with a mouse or trackpad, without reduced motion. Phones keep plain, native
 * touch scrolling with reveals only: less to compute, and nothing moving under the finger.
 */
export function useScrollFx(): boolean {
  const reduce = useReducedMotion()
  const wide = useSyncExternalStore(subscribeFx, () => window.matchMedia(FX_QUERY).matches, () => false)
  return wide && !reduce
}
