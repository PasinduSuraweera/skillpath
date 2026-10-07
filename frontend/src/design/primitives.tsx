// Shared building blocks of the SkillPath interface. Every screen is made of these, so a
// tile, a label or a meter looks and behaves the same wherever it appears.
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { m, useScroll, useTransform } from 'motion/react'
import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { LAYER } from '../depth'
import { TRANSITION, useCountUp, usePrinting, useReveal, useScrollFx, useSeen } from '../motion'
import { panel } from './surfaces'
import { AURORA, BRAND_GRADIENT, BRAND_GRADIENT_DARK, FORCED_COLORS, TONES, gradientText, ink, tint, toneColor, white } from './tokens'
import type { Tone } from './tokens'

// ---------------------------------------------------------------------------
// Type and labels
// ---------------------------------------------------------------------------

/** Small uppercase label above a title, optionally with a tone dot. */
export function Eyebrow({ children, tone, sx, component = 'p', id }: { children: ReactNode; tone?: Tone; sx?: SxProps<Theme>; component?: 'p' | 'span' | 'h2' | 'h3'; id?: string }) {
  return (
    <Typography variant="overline" color="text.secondary" component={component} id={id} sx={[{ display: 'flex', alignItems: 'center', gap: 0.875, lineHeight: 1.5 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {tone && (
        <Box
          component="span"
          aria-hidden="true"
          sx={(t) => ({ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, bgcolor: toneColor(t, tone), boxShadow: `0 0 0 3px ${alpha(TONES[tone].light, 0.16)}` })}
        />
      )}
      {children}
    </Typography>
  )
}

/** Gradient text for display sizes (the headline accent, big figures). */
export function GradientText({ children }: { children: ReactNode }) {
  return (
    <Box component="span" sx={(t) => gradientText(t)}>
      {children}
    </Box>
  )
}

/** Title block of a section: eyebrow, heading, a line of explanation and actions on the right. */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  id,
  tone,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  id?: string
  tone?: Tone
}) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'flex-end' }, justifyContent: 'space-between', gap: { xs: 1.5, sm: 3 } }}>
      <Box sx={{ minWidth: 0, maxWidth: 720 }}>
        {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
        <Typography variant="h3" component="h2" id={id} sx={{ mt: eyebrow ? 0.5 : 0 }}>
          {title}
        </Typography>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 0.75, textWrap: 'pretty' }}>
            {description}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

/** An icon on a tinted rounded square in a tone: marks what kind of insight a tile holds. */
export function IconTile({ tone = 'indigo', size = 36, children, glow }: { tone?: Tone; size?: number; children: ReactNode; glow?: boolean }) {
  return (
    <Box
      aria-hidden="true"
      sx={(t) => ({
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: `${Math.round(size * 0.32)}px`,
        display: 'grid',
        placeItems: 'center',
        color: toneColor(t, tone),
        ...tint(t, tone, 0.11, 0.16),
        boxShadow: `inset 0 1px 0 ${white(0.6)}${glow ? `, 0 6px 18px -6px ${alpha(TONES[tone].light, 0.55)}` : ''}`,
        ...t.applyStyles('dark', { boxShadow: `inset 0 1px 0 ${white(0.08)}${glow ? `, 0 6px 20px -6px ${alpha(TONES[tone].dark, 0.45)}` : ''}` }),
        '& svg': { fontSize: Math.round(size * 0.52) },
        [FORCED_COLORS]: { border: '1px solid CanvasText' },
      })}
    >
      {children}
    </Box>
  )
}

/** A compact label on a tint: status, category, rank. */
export function Pill({ children, tone, icon, sx }: { children: ReactNode; tone?: Tone | 'neutral' | 'brand'; icon?: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box
      component="span"
      sx={[
        (t) => ({
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.25,
          minHeight: 22,
          borderRadius: 999,
          fontSize: '0.71875rem',
          fontWeight: 650,
          letterSpacing: '0.01em',
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          '& svg': { fontSize: 13 },
          [FORCED_COLORS]: { border: '1px solid CanvasText' },
          ...(!tone || tone === 'neutral'
            ? { color: 'text.secondary', bgcolor: ink(0.05), ...t.applyStyles('dark', { bgcolor: white(0.07) }) }
            : tone === 'brand'
              ? {
                  color: '#fff',
                  backgroundImage: BRAND_GRADIENT,
                  boxShadow: `0 4px 14px -4px ${alpha('#6d28d9', 0.5)}`,
                  ...t.applyStyles('dark', { color: '#0b1020', backgroundImage: BRAND_GRADIENT_DARK }),
                  '@media print': { color: t.palette.primary.main, backgroundImage: 'none', border: `1px solid ${t.palette.primary.main}` },
                }
              : { color: TONES[tone].light, ...tint(t, tone, 0.1, 0.16), ...t.applyStyles('dark', { color: TONES[tone].dark }) }),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {icon}
      {children}
    </Box>
  )
}

/** "What is this?" button with an explanation tooltip; a real button, so it also opens with the keyboard and on tap. */
export function HelpTip({ title, label }: { title: string; label: string }) {
  return (
    <Tooltip title={title} arrow describeChild enterTouchDelay={0} leaveTouchDelay={6000}>
      <IconButton size="small" className="no-print" aria-label={`About “${label}”`} sx={{ p: 0.25, color: 'text.secondary', flexShrink: 0 }}>
        <InfoOutlined sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Tile: the dashboard's basic unit
// ---------------------------------------------------------------------------

/**
 * Motion props (initial, animate, whileInView, transition …) for a glass surface. They go on
 * the surface itself, never on a wrapper: an ancestor with opacity below 1 (or any filter)
 * becomes a "backdrop root", and the glass inside would stop blurring the page until the
 * fade ends, then snap. Wrappers of glass may only move (transform).
 */
export type SurfaceMotion = Record<string, unknown>

/**
 * Light catching a large glass surface as it moves: a soft diagonal band of reflection that
 * slides across the glass while it crosses the window, so the material reads as a real pane
 * turning past a light rather than a flat tint. Put it first inside the glass (it sits under
 * the content: the glass's blur makes it a stacking context). A transform on one layer
 * (compositor only); wide screens only (useScrollFx), never printed.
 */
export function GlassSheen() {
  const ref = useRef<HTMLDivElement>(null)
  const fx = useScrollFx()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const x = useTransform(scrollYProgress, [0, 1], ['-55%', '55%'])
  if (!fx) return <div ref={ref} hidden />
  return (
    <Box
      ref={ref}
      aria-hidden="true"
      className="no-print"
      sx={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none', zIndex: -1, [FORCED_COLORS]: { display: 'none' } }}
    >
      <Box
        component={m.div}
        style={{ x }}
        sx={(t) => ({
          ...LAYER,
          position: 'absolute',
          inset: '-20% -40%',
          backgroundImage: `linear-gradient(105deg, transparent 38%, ${white(0.3)} 48%, ${white(0.08)} 54%, transparent 62%)`,
          ...t.applyStyles('dark', { backgroundImage: `linear-gradient(105deg, transparent 38%, ${white(0.055)} 48%, ${white(0.015)} 54%, transparent 62%)` }),
        })}
      />
    </Box>
  )
}

/**
 * A titled glass tile: icon, heading (level 3 by default) and an optional explanation and
 * action, then its content. The section is labelled by its heading for screen readers.
 */
export function Tile({
  icon,
  tone = 'indigo',
  title,
  subtitle,
  help,
  action,
  children,
  headingLevel = 'h3',
  sx,
  className,
  motion,
}: {
  icon?: ReactNode
  tone?: Tone
  title: ReactNode
  subtitle?: ReactNode
  help?: string
  action?: ReactNode
  children: ReactNode
  headingLevel?: 'h2' | 'h3' | 'h4'
  sx?: SxProps<Theme>
  className?: string
  /** the tile's entrance (see SurfaceMotion) */
  motion?: SurfaceMotion
}) {
  const id = useId()
  return (
    <Box
      component={m.section}
      {...motion}
      aria-labelledby={id}
      className={className}
      sx={[(t) => ({ ...panel(t), p: { xs: 2, sm: 2.75 }, height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }), ...(Array.isArray(sx) ? sx : [sx])]}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 2 }}>
        {icon && <IconTile tone={tone}>{icon}</IconTile>}
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h5" component={headingLevel} id={id}>
              {title}
            </Typography>
            {help && typeof title === 'string' && <HelpTip title={help} label={title} />}
          </Stack>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" component="p">
              {subtitle}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      {children}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

/** Bar colours: a tone, or the brand gradient for the strongest statement. */
const barFill = (t: Theme, tone: Tone | 'brand') =>
  tone === 'brand'
    ? { backgroundImage: BRAND_GRADIENT, ...t.applyStyles('dark', { backgroundImage: BRAND_GRADIENT_DARK }) }
    : { backgroundColor: toneColor(t, tone) }

/**
 * A 0-1 value as a bar, optionally with a tick at a comparison value (the all-roles figure).
 * Grows from its zero line when a result is revealed, and moves to new values after that.
 */
export function Meter({
  value,
  average,
  tone = 'indigo',
  height = 6,
  delay = 0,
  muted,
}: {
  value: number
  average?: number
  tone?: Tone | 'brand'
  height?: number
  delay?: number
  muted?: boolean
}) {
  const reveal = useReveal()
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  // fills when it scrolls into view (not off screen); print shows it filled at once
  const ref = useRef<HTMLDivElement>(null)
  const seen = useSeen(ref)
  const print = usePrinting()
  // the first growth waits for its place in the reveal; later values move at once
  const [grown, setGrown] = useState(!reveal)
  return (
    <Box ref={ref} aria-hidden="true" className="sp-track" sx={(t) => ({ position: 'relative', height, borderRadius: 999, bgcolor: ink(0.07), ...t.applyStyles('dark', { bgcolor: white(0.08) }) })}>
      <Box
        component={m.div}
        className="sp-bar"
        initial={reveal ? { scaleX: 0 } : false}
        animate={{ scaleX: seen ? clamp(value) : 0 }}
        transition={print ? { duration: 0 } : grown ? TRANSITION.update : { ...TRANSITION.reveal, delay }}
        onAnimationComplete={() => seen && setGrown(true)}
        sx={(t) => ({ position: 'absolute', inset: 0, borderRadius: 999, transformOrigin: 'left', opacity: muted ? 0.5 : 1, ...barFill(t, tone) })}
      />
      {average !== undefined && (
        <Box
          sx={(t) => ({
            position: 'absolute',
            top: -3,
            bottom: -3,
            left: `calc(${clamp(average) * 100}% - 1px)`,
            width: 2,
            borderRadius: 1,
            bgcolor: ink(0.55),
            boxShadow: `0 0 0 1.5px ${white(0.8)}`,
            ...t.applyStyles('dark', { bgcolor: white(0.75), boxShadow: '0 0 0 1.5px rgba(0, 0, 0, 0.5)' }),
            [FORCED_COLORS]: { bgcolor: 'CanvasText' },
          })}
        />
      )}
    </Box>
  )
}

/** The marker drawn on meters for the all-roles figure, for legends. */
export function AverageTick() {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={(t) => ({ display: 'inline-block', width: 2, height: 10, borderRadius: 1, verticalAlign: '-1px', bgcolor: ink(0.55), ...t.applyStyles('dark', { bgcolor: white(0.75) }) })}
    />
  )
}

/**
 * A 0-1 value as a ring, drawn in the aurora gradient. It fills in step with the figure
 * counting up in its centre (both follow useCountUp). Decorative: `children` carry the
 * figure, and the caller labels it for screen readers.
 */
export function RingGauge({
  value,
  size = 160,
  thickness = 12,
  children,
  glow = true,
  tone,
}: {
  value: number
  /** px, or per breakpoint (the ring scales; `thickness` is relative to the largest size) */
  size?: number | { xs: number; md: number }
  thickness?: number
  children?: ReactNode
  glow?: boolean
  /** a single tone instead of the aurora gradient */
  tone?: Tone
}) {
  // fills (and its figure counts) when it scrolls into view; print shows the final value
  const ref = useRef<HTMLDivElement>(null)
  const seen = useSeen(ref)
  const print = usePrinting()
  const counted = useCountUp(value, undefined, seen).value
  const shown = print ? value : counted
  const gid = `ring-${useId().replace(/:/g, '')}`
  const nominal = typeof size === 'number' ? size : size.md
  const sw = (thickness / nominal) * 100
  const r = 50 - sw / 2
  const c = 2 * Math.PI * r
  const v = Math.min(1, Math.max(0, shown))
  return (
    <Box ref={ref} sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <Box
        component="svg"
        viewBox="0 0 100 100"
        aria-hidden="true"
        sx={(t) => ({
          width: '100%',
          height: '100%',
          transform: 'rotate(-90deg)',
          overflow: 'visible',
          ...(glow && { filter: `drop-shadow(0 6px 16px ${alpha(AURORA[1], 0.35)})`, '@media print': { filter: 'none' } }),
          '& .sp-ring-track': { stroke: ink(0.07), ...t.applyStyles('dark', { stroke: white(0.08) }) },
          ...(tone && { '& .sp-ring-arc': { stroke: toneColor(t, tone) } }),
          [FORCED_COLORS]: { '& .sp-ring-arc': { stroke: 'CanvasText' }, '& .sp-ring-track': { stroke: 'GrayText' } },
        })}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={AURORA[0]} />
            <stop offset="0.5" stopColor={AURORA[1]} />
            <stop offset="1" stopColor={AURORA[2]} />
          </linearGradient>
        </defs>
        <circle className="sp-ring-track" cx="50" cy="50" r={r} fill="none" strokeWidth={sw} />
        <circle
          className="sp-ring-arc"
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={tone ? undefined : `url(#${gid})`}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          opacity={v < 0.004 ? 0 : 1}
        />
      </Box>
      {children && <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</Box>}
    </Box>
  )
}

/** A row of dots, one per item, the first `filled` in the accent: e.g. the role's key technologies you use. */
export function DotScale({ filled, total, tone = 'indigo', size = 9 }: { filled: number; total: number; tone?: Tone; size?: number }) {
  return (
    <Stack direction="row" aria-hidden="true" sx={{ gap: '4px', flexWrap: 'wrap' }}>
      {Array.from({ length: total }, (_, i) => (
        <Box
          key={i}
          sx={(t) => ({
            width: size,
            height: size,
            borderRadius: '50%',
            // a dot filled by a what-if (the skill just added) fills in rather than switching
            transition: 'background-color 420ms ease, box-shadow 420ms ease',
            ...(i < filled
              ? { bgcolor: toneColor(t, tone), boxShadow: `0 0 0 2px ${alpha(TONES[tone].light, 0.14)}` }
              : { bgcolor: ink(0.1), ...t.applyStyles('dark', { bgcolor: white(0.12) }) }),
            [FORCED_COLORS]: { border: '1px solid CanvasText', bgcolor: i < filled ? 'CanvasText' : 'Canvas' },
          })}
        />
      ))}
    </Stack>
  )
}
