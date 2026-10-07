import { LazyMotion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { TRANSITION } from './motion'

// Motion's features download as a separate chunk, alongside the first API request
// (nothing is drawn before GET /api/options answers), so they are not part of the code
// needed to start the app.
const features = () => import('./motionFeatures').then((m) => m.default)

/**
 * Motion for the whole app. Components use `m.*`, not `motion.*` (strict mode enforces it,
 * since `motion.*` would bundle every feature up front). The default transition is the
 * medium ease-out from motion.ts, and with reduced motion Motion drops transform and
 * layout animation, keeping the fades.
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={features} strict>
      <MotionConfig reducedMotion="user" transition={TRANSITION.medium}>
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}
