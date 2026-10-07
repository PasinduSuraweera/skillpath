import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import { m, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { useId, useRef } from 'react'
import { SPEED, useDepth, usePointerDepth } from '../depth'
import { AURORA, FONT, FORCED_COLORS, TONES } from '../design/tokens'
import type { Tone } from '../design/tokens'
import { TRANSITION } from '../motion'

/** The drawing's size (px) and the tilt of its orbits (degrees). */
const SIZE = 840
const C = SIZE / 2
const TILT = -18

/** Three orbits around the examples panel: the skills a developer's profile is made of. */
const ORBITS = [
  { rx: 404, ry: 196, dashed: false },
  { rx: 330, ry: 154, dashed: true },
  { rx: 256, ry: 116, dashed: false },
]

/**
 * Technologies on the orbits, placed where the panel in front leaves them visible (its sides
 * and the far ends of the tilt). Angle in degrees around the orbit.
 */
const NODES: { orbit: number; angle: number; label?: string; tone: Tone }[] = [
  { orbit: 0, angle: 196, label: 'Python', tone: 'indigo' },
  { orbit: 0, angle: 152, label: 'TypeScript', tone: 'violet' },
  { orbit: 0, angle: 338, tone: 'cyan' },
  { orbit: 0, angle: 18, tone: 'indigo' },
  { orbit: 0, angle: 268, label: 'Docker', tone: 'cyan' },
  { orbit: 0, angle: 96, label: 'SQL', tone: 'emerald' },
  { orbit: 1, angle: 172, label: 'React', tone: 'cyan' },
  { orbit: 1, angle: 4, tone: 'violet' },
  { orbit: 2, angle: 186, tone: 'violet' },
  { orbit: 1, angle: 300, label: 'Kotlin', tone: 'amber' },
]

/** A point on an orbit, in the drawing's coordinates (the tilt applied). */
function at(orbit: number, angle: number) {
  const { rx, ry } = ORBITS[orbit]
  const a = (angle * Math.PI) / 180
  const t = (TILT * Math.PI) / 180
  const x = rx * Math.cos(a)
  const y = ry * Math.sin(a)
  return { x: C + x * Math.cos(t) - y * Math.sin(t), y: C + x * Math.sin(t) + y * Math.cos(t) }
}

/**
 * The hero's far layer: tilted orbits with technologies on them, drawn once in SVG behind the
 * examples panel (whose glass frosts the middle of it). It is decoration, so it carries the
 * depth: it trails the scroll (the decor layer, 0.75×), drifts towards the mouse a little and
 * opens up slightly as the hero hands over to the page below (`progress`, the hero's own
 * scroll). Wide screens only; nothing here is read or pressed.
 */
export default function Constellation({ fx, intro, progress }: { fx: boolean; intro: boolean; progress: MotionValue<number> }) {
  const ref = useRef<HTMLDivElement>(null)
  const gid = `orbit-${useId().replace(/:/g, '')}`
  const depth = useDepth(ref, SPEED.decor, fx)
  const pull = usePointerDepth(16, fx)
  const y = useTransform(() => depth.get() + pull.y.get())
  const scale = useTransform(progress, [0, 1], [1, fx ? 1.1 : 1])

  return (
    <Box
      ref={ref}
      aria-hidden="true"
      className="no-print"
      sx={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: SIZE,
        height: SIZE,
        ml: `${-C}px`,
        mt: `${-C}px`,
        zIndex: -1,
        pointerEvents: 'none',
        display: { xs: 'none', md: 'block' },
        [FORCED_COLORS]: { display: 'none' },
      }}
    >
      <m.div
        initial={intro ? { opacity: 0, scale: 0.92 } : { opacity: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...TRANSITION.enter, duration: intro ? 1.4 : 0.4, delay: intro ? 0.15 : 0 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Box
          component={m.svg}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ x: pull.x, y, scale }}
          sx={(t) => ({
            width: '100%',
            height: '100%',
            overflow: 'visible',
            '--orbit-a': 0.34,
            '--node-halo': 0.16,
            '& .sp-orbit-label': { fill: t.palette.text.secondary },
            ...t.applyStyles('dark', { '--orbit-a': 0.42, '--node-halo': 0.22 }),
          })}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={AURORA[3]} />
              <stop offset="0.35" stopColor={AURORA[0]} />
              <stop offset="0.7" stopColor={AURORA[1]} />
              <stop offset="1" stopColor={AURORA[2]} />
            </linearGradient>
          </defs>
          <g transform={`rotate(${TILT} ${C} ${C})`} style={{ opacity: 'var(--orbit-a)' }}>
            {ORBITS.map((o, i) => (
              <ellipse
                key={i}
                cx={C}
                cy={C}
                rx={o.rx}
                ry={o.ry}
                fill="none"
                stroke={`url(#${gid})`}
                strokeWidth={o.dashed ? 1.25 : 1}
                strokeDasharray={o.dashed ? '2 7' : undefined}
                strokeLinecap="round"
              />
            ))}
          </g>
          {NODES.map((n, i) => {
            const p = at(n.orbit, n.angle)
            const color = TONES[n.tone].light
            // labels sit on the outer side of their node, so they never run into the orbits' middle
            const right = p.x >= C
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={10} fill={alpha(color, 1)} style={{ opacity: 'var(--node-halo)' }} />
                <circle cx={p.x} cy={p.y} r={3.5} fill={color} />
                {n.label && (
                  <text
                    className="sp-orbit-label"
                    x={p.x + (right ? 16 : -16)}
                    y={p.y + 4}
                    textAnchor={right ? 'start' : 'end'}
                    style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: '0.02em', opacity: 0.75 }}
                  >
                    {n.label}
                  </text>
                )}
              </g>
            )
          })}
        </Box>
      </m.div>
    </Box>
  )
}
