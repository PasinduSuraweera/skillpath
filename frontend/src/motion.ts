// Motion tokens and helpers. The theme (MUI's transitions) and the global CSS
// variables (--ease-out, --dur-*) are both built from these values, so every
// animation in the app shares one easing and duration scale.
import { useEffect, useState } from 'react'

export const EASE = {
  /** entering / exiting / feedback: starts fast, so the UI feels instant */
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  /** something already on screen moving or changing size */
  inOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
  /** colour and background changes */
  standard: 'ease',
}

/** Milliseconds. UI motion stays under 300 ms. */
export const DURATION = {
  press: 140, // button press
  hover: 150, // colour and background changes
  small: 180, // tooltips, icons, exits
  medium: 220, // menus, step content, alerts
  large: 280, // panels expanding, results entering
}

/** Delay between items of a group entrance (role cards). */
export const STAGGER = 40

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
  '--stagger': `${STAGGER}ms`,
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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

/** Run a DOM-changing update as a View Transition (a short crossfade) where the browser supports it. */
export function withViewTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (!doc.startViewTransition) update()
  else doc.startViewTransition(update)
}
