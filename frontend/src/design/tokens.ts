// SkillPath design tokens: colour, materials (glass levels), elevation, radius and type.
// The MUI theme (theme.ts) and every component read from here, so a surface, a shadow or
// an accent means the same thing everywhere.
//
// Materials, from the back of the page to the front:
//   canvas    the aurora backdrop (AmbientBackground), fixed and static
//   panel     the main glass surfaces (hero, workspace, dashboard tiles): heavy blur over the canvas
//   spotlight the one hero surface of a screen (the best match): panel glass with an accent wash
//   inset     sections inside a panel: a quiet fill, never blurred (it already sits on glass)
//   chrome    navigation and sticky bars: content scrolls under them
//   floating  menus, popovers, the slow-request overlay: above the page, must read over anything
//   inverse   tooltips and toasts: ink on a light page, light on a dark one
// Blur is real (backdrop-filter) for panel, spotlight, chrome, floating and inverse. It drops to
// a smaller radius on phones (costlier there, and less of it shows), and to solid fills when the
// browser cannot blur, when the visitor asks for less transparency, and in print.
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

export const white = (a: number) => `rgba(255, 255, 255, ${a})`
export const ink = (a: number) => `rgba(11, 16, 32, ${a})`

export const INK = '#0b1020'
export const INK_DARK = '#eef0f8'

/** Brand hues. Text-safe values per scheme (over 4.5:1 on the page and on glass). */
export const BRAND = {
  indigo: { light: '#4f46e5', dark: '#a5b4fc' },
  violet: { light: '#6d28d9', dark: '#c4b5fd' },
}

/** The primary action and the model's strongest statements. White text on it stays over 5:1. */
export const BRAND_GRADIENT = 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)'
/** Dark mode: the same direction in light tints, under ink text. */
export const BRAND_GRADIENT_DARK = 'linear-gradient(135deg, #a5b4fc 0%, #c4b5fd 100%)'
/** Large display text only (headline accent, the match figure): never body copy. */
export const TEXT_GRADIENT = 'linear-gradient(100deg, #4f46e5 0%, #7c3aed 55%, #c026d3 100%)'
export const TEXT_GRADIENT_DARK = 'linear-gradient(100deg, #a5b4fc 0%, #c4b5fd 50%, #f0abfc 100%)'
/** Decorative only (rings, glows, the analysis orb): the full aurora. */
export const AURORA = ['#6366f1', '#8b5cf6', '#d946ef', '#22d3ee'] as const

/**
 * Tones give each kind of insight its own hue, so a glance tells AI outlook from pay from
 * skills. Used for icons, bars and tints; text stays ink or secondary for contrast.
 */
export const TONES = {
  indigo: { light: '#4f46e5', dark: '#a5b4fc' },
  violet: { light: '#7c3aed', dark: '#c4b5fd' },
  cyan: { light: '#0e7490', dark: '#67e8f9' },
  emerald: { light: '#047857', dark: '#6ee7b7' },
  amber: { light: '#b45309', dark: '#fcd34d' },
  rose: { light: '#be123c', dark: '#fda4af' },
} as const
export type Tone = keyof typeof TONES

/** A tone's colour for the current scheme. */
export const toneColor = (t: Theme, tone: Tone) => (t.palette.mode === 'dark' ? TONES[tone].dark : TONES[tone].light)

/** Radius scale. */
export const RADIUS = { control: 12, inset: 16, card: 22, panel: 28, pill: 999 }

/** Elevation: shadows tinted with the accent in light mode, deep and neutral in dark mode. */
const SHADOW = {
  low: {
    light: `0 1px 1px ${ink(0.04)}, 0 6px 16px -8px rgba(49, 46, 129, 0.16)`,
    dark: `0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 20px -10px rgba(0, 0, 0, 0.6)`,
  },
  mid: {
    light: `0 1px 2px ${ink(0.05)}, 0 18px 44px -18px rgba(49, 46, 129, 0.28)`,
    dark: `0 1px 2px rgba(0, 0, 0, 0.5), 0 22px 48px -20px rgba(0, 0, 0, 0.75)`,
  },
  high: {
    light: `0 2px 4px ${ink(0.05)}, 0 32px 72px -28px rgba(49, 46, 129, 0.38)`,
    dark: `0 2px 6px rgba(0, 0, 0, 0.5), 0 36px 80px -28px rgba(0, 0, 0, 0.85)`,
  },
} as const
export type Elevation = keyof typeof SHADOW

/** The lit top edge every glass surface has: light catching the rim. */
const RIM = { light: `inset 0 1px 0 ${white(0.85)}`, dark: `inset 0 1px 0 ${white(0.07)}` }

export const shadow = (t: Theme, level: Elevation) => ({
  boxShadow: `${RIM.light}, ${SHADOW[level].light}`,
  ...t.applyStyles('dark', { boxShadow: `${RIM.dark}, ${SHADOW[level].dark}` }),
})

type Material = 'panel' | 'chrome' | 'floating' | 'inverse' | 'overlay'
interface MaterialSpec {
  /** backdrop blur in px: wide screens, phones */
  blur: [number, number]
  /** fill (light, dark): a vertical sheen, brighter at the top like real glass */
  fill: [string, string]
  /** solid colour when blur is unavailable or unwanted */
  solid: [string, string]
}

const MATERIALS: Record<Material, MaterialSpec> = {
  panel: {
    blur: [28, 16],
    fill: [
      `linear-gradient(180deg, ${white(0.74)} 0%, ${white(0.56)} 100%)`,
      'linear-gradient(180deg, rgba(30, 34, 60, 0.62) 0%, rgba(16, 19, 36, 0.52) 100%)',
    ],
    solid: ['#ffffff', '#11142a'],
  },
  chrome: {
    blur: [24, 18],
    fill: [`linear-gradient(180deg, ${white(0.78)}, ${white(0.68)})`, 'linear-gradient(180deg, rgba(18, 21, 40, 0.74), rgba(12, 14, 28, 0.66))'],
    solid: ['#f6f7fc', '#0c0e1c'],
  },
  floating: {
    blur: [32, 20],
    fill: [`linear-gradient(180deg, ${white(0.9)}, ${white(0.84)})`, 'linear-gradient(180deg, rgba(32, 36, 62, 0.9), rgba(22, 25, 46, 0.88))'],
    solid: ['#ffffff', '#181b31'],
  },
  inverse: {
    blur: [16, 12],
    fill: ['linear-gradient(180deg, rgba(17, 22, 44, 0.92), rgba(11, 16, 32, 0.92))', `linear-gradient(180deg, ${white(0.95)}, rgba(238, 240, 248, 0.93))`],
    solid: [INK, INK_DARK],
  },
  overlay: {
    blur: [12, 8],
    fill: [`linear-gradient(180deg, ${white(0.74)}, ${white(0.66)})`, 'linear-gradient(180deg, rgba(10, 12, 24, 0.74), rgba(10, 12, 24, 0.7))'],
    solid: ['#f6f7fc', '#0c0e1c'],
  },
}

// a style object as MUI's sx accepts it
type Style = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const isObject = (v: unknown): v is Style => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Combine style objects, merging nested rules (media queries, selectors) instead of letting a
 * later one replace an earlier one. Spreading glass() and glassEdge() side by side would let
 * the edge's `@media print` drop the glass's "no blur in print" rule.
 */
export function mergeStyles(...parts: object[]): Style {
  const out: Style = {}
  for (const part of parts) {
    for (const [k, v] of Object.entries(part)) {
      out[k] = isObject(v) && isObject(out[k]) ? mergeStyles(out[k], v) : v
    }
  }
  return out
}

/** Media query for print and for visitors who ask for less transparency. */
export const PLAIN_MEDIA = ['@media (prefers-reduced-transparency: reduce)', '@media print'] as const
/** High-contrast modes (Windows contrast themes): the system drops gradients and shadows, so edges need real borders. */
export const FORCED_COLORS = '@media (forced-colors: active)'

/**
 * A glass material: translucent sheen, backdrop blur and saturation. Solid where the
 * browser cannot blur, for reduced transparency, and in print (PDF output ignores blur).
 */
export function glass(t: Theme, material: Material) {
  const { blur, fill, solid } = MATERIALS[material]
  const filter = (px: number) => `blur(${px}px) saturate(180%)`
  const plain = { backgroundImage: 'none', backdropFilter: 'none', WebkitBackdropFilter: 'none', backgroundColor: solid[0], ...t.applyStyles('dark', { backgroundColor: solid[1] }) }
  return {
    backgroundColor: 'transparent',
    backgroundImage: fill[0],
    ...t.applyStyles('dark', { backgroundImage: fill[1] }),
    backdropFilter: filter(blur[0]),
    WebkitBackdropFilter: filter(blur[0]),
    [t.breakpoints.down('sm')]: { backdropFilter: filter(blur[1]), WebkitBackdropFilter: filter(blur[1]) },
    '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': plain,
    [PLAIN_MEDIA[0]]: plain,
    [PLAIN_MEDIA[1]]: plain,
  }
}

/** A material's sheen (light, dark), for surfaces that layer their own wash over it (the spotlight). */
export const glassFill = (material: Material) => MATERIALS[material].fill

/** The hairline edge of glass: a bright rim in light mode (glass on a light page), a faint one in dark mode. */
export const glassEdge = (t: Theme) => ({
  border: `1px solid ${white(0.7)}`,
  ...t.applyStyles('dark', { border: `1px solid ${white(0.09)}` }),
  // printed and plain surfaces sit on white: a neutral hairline instead of the white rim
  [PLAIN_MEDIA[0]]: { border: `1px solid ${t.palette.divider}` },
  [PLAIN_MEDIA[1]]: { border: `1px solid ${ink(0.14)}` },
  [FORCED_COLORS]: { border: '1px solid CanvasText' },
})

/** Fills for content inside a panel (light, dark). Never blurred: they already sit on glass. */
const INSET = {
  quiet: [white(0.46), white(0.035)],
  raised: [white(0.72), white(0.06)],
} as const

export const insetFill = (t: Theme, level: keyof typeof INSET = 'quiet') => ({
  backgroundColor: INSET[level][0],
  ...t.applyStyles('dark', { backgroundColor: INSET[level][1] }),
})

/** An inset section: quiet fill and a hairline, rounded one step tighter than the panel. */
export const inset = (t: Theme, level: keyof typeof INSET = 'quiet') => ({
  ...insetFill(t, level),
  borderRadius: `${RADIUS.inset}px`,
  border: `1px solid ${t.palette.divider}`,
})

/** A tint of a tone, for icon tiles, pills and selected states. */
export const tint = (t: Theme, tone: Tone, light = 0.1, dark = 0.16) => ({
  backgroundColor: alpha(TONES[tone].light, light),
  ...t.applyStyles('dark', { backgroundColor: alpha(TONES[tone].dark, dark) }),
})

/** Gradient-filled text, for display sizes only; plain accent colour in contrast themes and print. */
export const gradientText = (t: Theme) => ({
  backgroundImage: TEXT_GRADIENT,
  ...t.applyStyles('dark', { backgroundImage: TEXT_GRADIENT_DARK }),
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  [FORCED_COLORS]: { backgroundImage: 'none', color: 'CanvasText', WebkitTextFillColor: 'CanvasText' },
  '@media print': { backgroundImage: 'none', color: BRAND.indigo.light, WebkitTextFillColor: BRAND.indigo.light },
})

/** Accent-coloured text on a tint of the accent (pills): the deeper indigo keeps it over 4.5:1. */
export const tintInk = (t: Theme) => ({ color: t.palette.primary.dark, ...t.applyStyles('dark', { color: t.palette.primary.main }) })

/**
 * A 1px border in a gradient that follows rounded corners: a gradient layer masked down
 * to its outer pixel (border-image cannot be rounded). Put it on ::before. PDF output
 * ignores masks, so print hides it (callers draw a plain border there).
 */
export const gradientRing = (gradient: string) => ({
  content: '""',
  position: 'absolute',
  inset: 0,
  borderRadius: 'inherit',
  padding: '1px',
  backgroundImage: gradient,
  WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  WebkitMaskComposite: 'xor',
  mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
  pointerEvents: 'none',
  '@media print': { display: 'none' },
  [FORCED_COLORS]: { display: 'none' },
})

/** Hover only where there is a real pointer: on touch screens a tap would leave the hover stuck. */
export const HOVER = '@media (hover: hover) and (pointer: fine)'
export const TOUCH = '@media (pointer: coarse)'

/** Font stacks: SF Pro on Apple devices (system), Inter elsewhere (downloaded only there). */
export const FONT = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter Variable", "Segoe UI Variable Text", "Segoe UI", Roboto, system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace',
}
