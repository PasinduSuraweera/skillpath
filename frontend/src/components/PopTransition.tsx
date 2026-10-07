import Fade from '@mui/material/Fade'
import type { FadeProps } from '@mui/material/Fade'
import { animate } from 'motion/mini'
import { forwardRef } from 'react'
import { DURATION, TRANSITION, prefersReducedMotion } from '../motion'

type Side = 'top' | 'bottom' | 'left' | 'right'

interface Arrival {
  /** the side the popup arrives from; by default the side its trigger is on */
  from?: Side
  /** px travelled on the way in */
  travel?: number
}

export interface PopTransitionProps extends FadeProps, Arrival {}

// the toast passes them through Snackbar's transition slot
declare module '@mui/material/Snackbar' {
  interface SnackbarTransitionSlotPropsOverrides extends Arrival {}
}

/**
 * Where the trigger is, from the transform origin MUI gives the popup: Popover sets it at
 * the anchor, Tooltip by placement. Null when it is the centre (nothing to move from).
 */
function triggerSide(node: HTMLElement): Side | null {
  const [x, y] = getComputedStyle(node).transformOrigin.split(' ').map(parseFloat)
  const { offsetWidth: w, offsetHeight: h } = node
  if (y <= h * 0.25) return 'top'
  if (y >= h * 0.75) return 'bottom'
  if (x <= w * 0.25) return 'left'
  if (x >= w * 0.75) return 'right'
  return null
}

const shift = (side: Side | null, d: number) =>
  side === 'top' ? [0, -d] : side === 'bottom' ? [0, d] : side === 'left' ? [-d, 0] : side === 'right' ? [d, 0] : [0, 0]

/**
 * Menus, tooltips and toasts: they fade (MUI's Fade, which also handles mounting and
 * unmounting) while settling from just under full size and a few px towards their trigger,
 * and leave with a quicker fade that shrinks a little. Never from a squashed state. With
 * reduced motion, only the fade.
 */
const PopTransition = forwardRef<HTMLElement, PopTransitionProps>(function PopTransition(
  { from, travel = 4, onEntering, onExit, timeout, ...props },
  ref,
) {
  const exit = typeof timeout === 'number' ? timeout : (timeout?.exit ?? DURATION.small)
  return (
    <Fade
      ref={ref}
      timeout={timeout}
      {...props}
      onEntering={(node, appearing) => {
        onEntering?.(node, appearing) // Popover positions the paper here, setting its transform origin
        if (prefersReducedMotion()) return
        const settle = (side: Side | null) => {
          const [dx, dy] = shift(side, travel)
          animate(node, { transform: [`translate(${dx}px, ${dy}px) scale(0.97)`, 'none'] }, TRANSITION.small)
        }
        const side = from ?? triggerSide(node)
        // a tooltip's placement (and with it its transform origin) arrives a frame later; it is
        // still nearly transparent then, so starting a frame late does not show
        if (side || from) settle(side)
        else requestAnimationFrame(() => settle(triggerSide(node)))
      }}
      onExit={(node) => {
        onExit?.(node)
        if (prefersReducedMotion()) return
        animate(node, { transform: ['none', 'scale(0.98)'] }, { ...TRANSITION.small, duration: exit / 1000 })
      }}
    />
  )
})

export default PopTransition
