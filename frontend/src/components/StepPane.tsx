import { LayoutGroup, m, useIsPresent, useReducedMotion } from 'motion/react'
import type { ReactNode, Ref } from 'react'
import { useId } from 'react'
import { TRANSITION } from '../motion'

export type Direction = 'forward' | 'back' | null

/** px a step travels: in from the side it is heading to, out to the side it came from */
const SHIFT = 16
const side = (d: Direction) => (d === 'back' ? -1 : 1)

// With reduced motion the steps crossfade: Motion would make the slide instant, which
// still jumps the leaving step sideways, so there is no slide at all.
const variants = (shift: number) => ({
  enter: (d: Direction) => ({ opacity: 0, x: shift * side(d) }),
  shown: { opacity: 1, x: 0, transition: TRANSITION.medium },
  // leaving is quicker than arriving, so the new step is never kept waiting
  leave: (d: Direction) => ({ opacity: 0, x: -shift * side(d), transition: TRANSITION.small }),
})
const SLIDE = variants(SHIFT)
const FADE = variants(0)

/**
 * One wizard step inside AnimatePresence: it slides in the direction of travel while the
 * previous step slides out. The step on its way out is inert, hidden from screen readers
 * and marked data-leaving, so focus handling skips it (isLeaving in motion.ts): it briefly
 * shares its ids with the new one. Its own LayoutGroup keeps the answer highlights of this
 * visit separate from a previous visit to the same step.
 */
export default function StepPane({
  direction,
  inert,
  children,
  ref,
}: {
  direction: Direction
  inert: boolean
  children: ReactNode
  ref?: Ref<HTMLDivElement>
}) {
  const present = useIsPresent()
  const group = useId()
  const reduce = useReducedMotion()
  return (
    <m.div
      ref={ref}
      custom={direction}
      variants={reduce ? FADE : SLIDE}
      initial="enter"
      animate="shown"
      exit="leave"
      inert={inert || !present}
      aria-hidden={present ? undefined : true}
      data-leaving={present ? undefined : ''}
    >
      <LayoutGroup id={group}>{children}</LayoutGroup>
    </m.div>
  )
}
