// Smooth scrolling (Lenis) and the app's one way to scroll programmatically.
//
// Feel: wheel and trackpad input is eased towards its target (lerp) instead of jumping, so a
// flick accelerates smoothly and settles naturally. The lerp is high (0.17 of the remaining
// distance each frame: the page moves on the next frame, is 95% there in about a quarter of a
// second after the last input and settles soon after), so it follows the hand closely and
// stops cleanly: polished, never floaty. Measured with real wheel input, frames stay at 16.7 ms. Lenis moves the real window scroll, so sticky
// elements, Motion's useScroll and the browser's own features keep working.
//
// Left native:
//   - touch (phones, tablets): Lenis does not smooth touch by default (syncTouch off)
//   - keyboard (arrows, space, Page Down): the browser's own scrolling
//   - anything that scrolls itself (menus, autocomplete lists, the explorations row): allowNestedScroll
//   - while a MUI modal (a select menu) holds the page still: the page must not move behind it
//   - reduced motion: no smoothing at all, and programmatic scrolls jump
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { cancelFrame, frame } from 'motion/react'
import type { FrameData } from 'motion/react'
import { prefersReducedMotion } from './motion'

let lenis: Lenis | null = null

/**
 * Lenis moves the page from Motion's frame loop, in its read step: the scroll is set before
 * Motion writes this frame's transforms, never after (a scroll set after style writes makes
 * the browser recalculate style and layout on the spot, every frame).
 */
const tick = ({ timestamp }: FrameData) => lenis?.raf(timestamp)

/** A MUI modal (select menu, popover) is open and has locked the page's scrolling. */
const pageLocked = () => document.body.style.overflow === 'hidden'

/**
 * Start smooth scrolling where it helps (a fine pointer, no reduced motion); returns the
 * cleanup. Started again when the reduced-motion setting changes.
 */
export function startSmoothScroll(): () => void {
  const fine = window.matchMedia('(pointer: fine)')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const start = () => {
    cancelFrame(tick)
    lenis?.destroy()
    lenis = null
    if (!fine.matches || reduced.matches) return
    lenis = new Lenis({
      lerp: 0.17,
      wheelMultiplier: 1,
      smoothWheel: true,
      syncTouch: false,
      allowNestedScroll: true,
      autoRaf: false,
      prevent: (node) => pageLocked() || !!node.closest?.('.MuiPopover-root, .MuiAutocomplete-popper, .MuiDialog-root'),
    })
    frame.read(tick, true)
  }
  start()
  fine.addEventListener('change', start)
  reduced.addEventListener('change', start)
  return () => {
    fine.removeEventListener('change', start)
    reduced.removeEventListener('change', start)
    cancelFrame(tick)
    lenis?.destroy()
    lenis = null
  }
}

/** Programmatic scrolls glide for this long (s), easing out: quick to start, soft to land. */
const GLIDE = 0.9
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

/** Clearance for the floating nav (taller from 600 px), so content scrolled to is not left under it. */
export const navClearance = () => (window.innerWidth < 600 ? 72 : 88)

/** Scroll the page to `top` (px). `smooth` glides, otherwise it jumps; reduced motion always jumps. */
export function scrollToTop(top: number, smooth: boolean) {
  const glide = smooth && !prefersReducedMotion()
  if (lenis) lenis.scrollTo(top, { immediate: !glide, duration: GLIDE, easing: easeOutExpo, force: true })
  else window.scrollTo({ top, behavior: glide ? 'smooth' : 'auto' })
}

/** Bring `el` to the top of the window, below the nav. */
export function scrollToElement(el: HTMLElement, smooth: boolean) {
  const top = el.getBoundingClientRect().top + window.scrollY - navClearance()
  scrollToTop(Math.max(0, top), smooth)
}
