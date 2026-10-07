// Depth and atmosphere: how fast each layer of the page moves as it scrolls past, the
// pointer's gentle pull on decoration, and the mood of the backdrop section by section.
//
// The page is built in layers, back to front, each moving at its own share of the scroll:
//
//   backdrop    the aurora (AmbientBackground)          barely moves: far away
//   light       glows placed behind glass (Glow)          0.55×: the colour the glass refracts
//   decor       decorative shapes (the constellation)     0.75×
//   glass       large glass that holds no reading text    0.92×
//   content     text, controls, data                      1×: never displaced
//   foreground  small floating glass fragments            1.12×: in front, so a little faster
//
// Depth runs only where it helps and costs little (useScrollFx: wide screens, a fine pointer,
// no reduced motion). Every effect is a transform driven by a MotionValue: nothing re-renders
// while scrolling, and each moving element is its own compositor layer (LAYER), so the
// browser moves pixels it already has instead of painting them again.
import { motionValue, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react'
import type { RefObject } from 'react'

/** Share of the scroll speed each layer moves at. */
export const SPEED = {
  light: 0.55,
  decor: 0.75,
  glass: 0.92,
  content: 1,
  foreground: 1.12,
} as const

/**
 * For an element a scroll or pointer value transforms every frame: its own compositor layer.
 * Without it the browser re-rasterises the element (glass, text, SVG) on every frame it moves;
 * measured at 2× pixel density while scrolling, this cuts raster work about tenfold. Only on
 * elements that really move (each layer costs GPU memory), and only while they do.
 */
export const LAYER = { willChange: 'transform' } as const

// ---------------------------------------------------------------------------
// Layout changes: one observer for every layer that needs to re-measure
// ---------------------------------------------------------------------------

const layoutListeners = new Set<() => void>()
let layoutObserver: ResizeObserver | null = null
const fireLayout = () => layoutListeners.forEach((f) => f())

/** Call `measure` whenever the page may have moved things (the body resizing, the window resizing). */
function onLayout(measure: () => void) {
  layoutListeners.add(measure)
  if (!layoutObserver) {
    layoutObserver = new ResizeObserver(fireLayout)
    layoutObserver.observe(document.body)
    window.addEventListener('resize', fireLayout)
  }
  return () => {
    layoutListeners.delete(measure)
    if (layoutListeners.size || !layoutObserver) return
    layoutObserver.disconnect()
    layoutObserver = null
    window.removeEventListener('resize', fireLayout)
  }
}

/** An element's top in the document, ignoring transforms (its own parallax must not feed back into it). */
export function documentTop(el: HTMLElement) {
  let top = 0
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) top += n.offsetTop
  return top
}

// ---------------------------------------------------------------------------
// Parallax
// ---------------------------------------------------------------------------

/**
 * Vertical offset (px) that makes an element move at `speed` × the scroll while it crosses
 * the window. It sits exactly where the layout put it when it is centred in the window (or,
 * for anything already on screen when the page opens, at the top of the page), drifts behind
 * (speed < 1) or ahead (speed > 1) of the page either side of that, and stops drifting once it
 * is out of view, so it never wanders back into sight. 0 when `on` is false.
 */
export function useDepth(ref: RefObject<HTMLElement | null>, speed: number, on: boolean): MotionValue<number> {
  const { scrollY } = useScroll()
  // [first scroll position it is visible at, last one, the one it sits in place at]
  const span = useMotionValue<[number, number, number]>([0, 0, 0])
  useLayoutEffect(() => {
    if (!on) return
    const measure = () => {
      const el = ref.current
      if (!el) return
      const top = documentTop(el)
      const h = el.offsetHeight
      const vh = window.innerHeight
      span.set([top - vh, top + h, Math.max(0, top + h / 2 - vh / 2)])
    }
    measure()
    return onLayout(measure)
  }, [ref, on, span])
  return useTransform(() => {
    const y = scrollY.get()
    const [first, last, rest] = span.get()
    if (!on) return 0
    return (1 - speed) * (Math.min(last, Math.max(first, y)) - rest)
  })
}

// ---------------------------------------------------------------------------
// Pointer depth
// ---------------------------------------------------------------------------

// where the mouse is, -1 to 1 from the centre of the window; one listener however many layers follow it
const pointer = { x: motionValue(0), y: motionValue(0) }
let pointerUsers = 0
const followPointer = (e: PointerEvent) => {
  if (e.pointerType !== 'mouse') return
  pointer.x.set((e.clientX / window.innerWidth) * 2 - 1)
  pointer.y.set((e.clientY / window.innerHeight) * 2 - 1)
}

/**
 * A gentle pull towards the mouse for decoration: up to `reach` px each way, eased by a soft
 * spring so it trails the hand rather than tracking it. Layers further back get a smaller
 * reach, so the scene seems to turn slightly. Mouse only, and nothing at all when `on` is false.
 */
export function usePointerDepth(reach: number, on: boolean): { x: MotionValue<number>; y: MotionValue<number> } {
  useEffect(() => {
    if (!on) return
    if (pointerUsers++ === 0) window.addEventListener('pointermove', followPointer, { passive: true })
    return () => {
      if (--pointerUsers === 0) window.removeEventListener('pointermove', followPointer)
    }
  }, [on])
  const spring = { stiffness: 50, damping: 18, mass: 0.8 }
  const sx = useSpring(pointer.x, spring)
  const sy = useSpring(pointer.y, spring)
  return { x: useTransform(sx, (v) => (on ? v * reach : 0)), y: useTransform(sy, (v) => (on ? v * reach : 0)) }
}

// ---------------------------------------------------------------------------
// Atmosphere: the backdrop's mood follows the section in the middle of the window
// ---------------------------------------------------------------------------

/**
 * The page's moods, from the top of the story to the end:
 *   dawn    the opening (start page, top of the results): deep and rich
 *   focus   working through skills (how it works, the questionnaire, your path): brighter, cooler
 *   accent  the career choice (comparing roles, the role in detail): the accent hues
 *   calm    the wider picture and the record (landscape, behind the result, explorations): settled
 */
export type Mood = 'dawn' | 'focus' | 'accent' | 'calm'

let mood: Mood = 'dawn'
const moodListeners = new Set<() => void>()
const moodOf = new Map<Element, Mood>()
let moodObserver: IntersectionObserver | null = null

function setMood(next: Mood | undefined) {
  if (!next || next === mood) return
  mood = next
  moodListeners.forEach((f) => f())
}

function moodWatcher() {
  // a thin band across the middle of the window: whichever section crosses it sets the mood
  moodObserver ??= new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setMood(moodOf.get(e.target))), {
    rootMargin: '-48% 0px -48% 0px',
  })
  return moodObserver
}

/** Give a section a mood: while it is in the middle of the window, the backdrop takes it on. */
export function useMood(ref: RefObject<Element | null>, value: Mood) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    moodOf.set(el, value)
    const watcher = moodWatcher()
    watcher.observe(el)
    return () => {
      watcher.unobserve(el)
      moodOf.delete(el)
    }
  }, [ref, value])
}

const subscribeMood = (onChange: () => void) => {
  moodListeners.add(onChange)
  return () => moodListeners.delete(onChange)
}
/** The current mood (for the backdrop). */
export const useAtmosphere = () => useSyncExternalStore(subscribeMood, () => mood, () => 'dawn' as Mood)
