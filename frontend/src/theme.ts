import { alpha, createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import PopTransition from './components/PopTransition'
import { DURATION, EASE, motionCssVars } from './motion'

// Light and dark palettes. The app starts in the visitor's system setting and
// the header button switches it (MUI remembers the choice in localStorage).
//
// Visual language: quiet neutral surfaces, one indigo accent for anything the
// model says or the visitor should act on, and a single indigo-to-violet
// gradient (BRAND_GRADIENT) kept for the few "intelligence" moments: the
// primary action, the best match and the analysis state. Neutral controls
// (outlined and text buttons) stay grey so the one primary action on a screen
// stands out.
//
// Glass: the page sits on a static ambient background (AmbientBackground) and
// the layers above it are translucent. Real backdrop blur is kept for the layers
// that content scrolls or sits under (header and sticky bars, menus, tooltips,
// toasts, overlays), where it is visible. Cards are translucent without blur: over
// a soft gradient a blurred card looks the same and costs a GPU pass every frame.
//
// Motion: MUI's transition tokens are set from motion.ts, so its own menus,
// tooltips, collapses and colour changes use the same curves and durations as
// the app's animations. MUI uses "easeInOut" as the default for nearly all of
// them (most are enters and exits), so it is the strong ease-out here; real
// on-screen movement uses EASE.inOut from motion.ts directly.

const ink = '#0f1729'
const slate = (a: number) => `rgba(15, 23, 42, ${a})`
const white = (a: number) => `rgba(255, 255, 255, ${a})`

/** Accent used for the best match and the analysis state, never for plain controls. */
export const BRAND_VIOLET = { light: '#6e56cf', dark: '#b49cff' }
export const BRAND_GRADIENT = `linear-gradient(135deg, #3e63dd 0%, ${BRAND_VIOLET.light} 100%)`
export const BRAND_GRADIENT_DARK = `linear-gradient(135deg, #8da4ff 0%, ${BRAND_VIOLET.dark} 100%)`

/**
 * Accent-coloured text on a tint of the accent (pills, status chips). In light mode the
 * deeper indigo keeps it over 4.5:1, which the main indigo misses on a 12% tint.
 */
export const tintInk = (t: Theme) => ({ color: t.palette.primary.dark, ...t.applyStyles('dark', { color: t.palette.primary.main }) })

/** Radius scale: controls, inset panels, cards, large panels. */
export const RADIUS = { control: 10, inset: 12, card: 16, panel: 20 }

/** Brand hues behind the glass (AmbientBackground): the accent indigo, the violet, and a cool blue. */
export const AMBIENT = { indigo: '#3e63dd', violet: BRAND_VIOLET.light, blue: '#0ea5e9' }

/**
 * Fills (light, dark), translucent so the ambient background shows through and never blurred:
 * cards, and controls on them (fields, answer cards, outlined buttons), a step brighter than the card.
 */
export const SURFACE = {
  card: [white(0.72), white(0.04)],
  raised: [white(0.84), white(0.06)],
  control: [white(0.7), white(0.03)],
} as const

/** One of the SURFACE fills for the current colour scheme. */
export const surfaceFill = (t: Theme, level: keyof typeof SURFACE) => ({
  backgroundColor: SURFACE[level][0],
  ...t.applyStyles('dark', { backgroundColor: SURFACE[level][1] }),
})

/** Floating layers in dark mode sit a step above the paper colour. */
const FLOATING_DARK = '#151b25'
/** Tooltips and toasts in dark mode: near-white, with ink text. */
const INVERSE_DARK = '#e7e9ee'

type GlassLayer = 'chrome' | 'floating' | 'inverse' | 'overlay'
/** Backdrop blur in px (wide screens, phones; on a phone it costs more and shows less) and fill opacity (light, dark). */
const GLASS: Record<GlassLayer, { blur: [number, number]; fill: [number, number]; saturate: boolean }> = {
  /** header and sticky bars: content scrolls under them */
  chrome: { blur: [16, 10], fill: [0.72, 0.66], saturate: true },
  /** menus, tooltips, toasts: above the page, and must read clearly over anything */
  floating: { blur: [20, 10], fill: [0.84, 0.82], saturate: true },
  /** tooltips and toasts: ink on a light page, light on a dark one, so a short message stands apart */
  inverse: { blur: [12, 8], fill: [0.9, 0.92], saturate: true },
  /** covers content that is waiting (the analysis state over the form) */
  overlay: { blur: [8, 6], fill: [0.8, 0.8], saturate: false },
}

/**
 * A blurred glass layer. Solid when the browser cannot blur, when the visitor asks for less
 * transparency, and in print.
 */
export function glass(t: Theme, layer: GlassLayer) {
  const { blur, fill, saturate } = GLASS[layer]
  const base = (dark: boolean) =>
    layer === 'chrome'
      ? t.palette.background.default
      : layer === 'inverse'
        ? dark
          ? INVERSE_DARK
          : ink
        : dark && layer === 'floating'
          ? FLOATING_DARK
          : t.palette.background.paper
  const filter = (px: number) => `${saturate ? 'saturate(160%) ' : ''}blur(${px}px)`
  const solid = { backgroundColor: base(false), ...t.applyStyles('dark', { backgroundColor: base(true) }) }
  const flat = { backdropFilter: 'none', WebkitBackdropFilter: 'none', ...solid }
  return {
    backgroundColor: alpha(base(false), fill[0]),
    ...t.applyStyles('dark', { backgroundColor: alpha(base(true), fill[1]) }),
    backdropFilter: filter(blur[0]),
    WebkitBackdropFilter: filter(blur[0]),
    [t.breakpoints.down('sm')]: { backdropFilter: filter(blur[1]), WebkitBackdropFilter: filter(blur[1]) },
    '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': solid,
    '@media (prefers-reduced-transparency: reduce)': flat,
    '@media print': flat,
  }
}

/** A shadow in the accent's hue: soft depth that belongs to the page instead of grey smudges. */
const indigo = (a: number) => `rgba(46, 64, 160, ${a})`

/** Elevation scale (light mode; dark mode uses edges and a top highlight instead). */
export const ELEVATION = {
  card: `0 1px 2px ${slate(0.04)}, 0 4px 14px -6px ${indigo(0.1)}`,
  raised: `0 1px 2px ${slate(0.05)}, 0 14px 32px -14px ${indigo(0.26)}`,
  floating: `0 18px 44px -14px ${indigo(0.3)}, 0 4px 12px -4px ${slate(0.08)}`,
}

const colorTransition = (props: string[]) =>
  props.map((p) => `${p} ${DURATION.hover}ms ${EASE.standard}`).join(', ')
const press = `transform ${DURATION.press}ms ${EASE.out}`
const hoverOnly = '@media (hover: hover) and (pointer: fine)'
const touch = '@media (pointer: coarse)'

/** On touch screens, a hit area of at least 44 × 44 px around a small control, without changing its layout. */
const touchTarget = {
  [touch]: {
    '&::after': {
      content: '""',
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: 'max(100%, 44px)',
      height: 'max(100%, 44px)',
      transform: 'translate(-50%, -50%)',
    },
  },
}

const focusRing = ({ theme }: { theme: Theme }) => ({
  '&.Mui-focusVisible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
})

/**
 * The resting card, a glass surface: translucent fill, a hairline edge, a lit top edge and a
 * soft shadow (dark mode: the edges only). Solid when the visitor asks for less transparency.
 */
const cardSurface = ({ theme }: { theme: Theme }) => ({
  ...surfaceFill(theme, 'card'),
  borderColor: theme.palette.divider,
  boxShadow: `inset 0 1px 0 ${white(0.9)}, ${ELEVATION.card}`,
  ...theme.applyStyles('dark', { boxShadow: `inset 0 1px 0 ${white(0.06)}` }),
  '@media (prefers-reduced-transparency: reduce)': { backgroundColor: theme.palette.background.paper },
})

/** Floating layers (menus, autocomplete lists): blurred glass and a deeper shadow, so they read as above the page. */
const floatingSurface = ({ theme }: { theme: Theme }) => ({
  ...glass(theme, 'floating'),
  borderRadius: RADIUS.inset,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: `inset 0 1px 0 ${white(0.7)}, ${ELEVATION.floating}`,
  ...theme.applyStyles('dark', { boxShadow: `inset 0 1px 0 ${white(0.06)}, 0 16px 40px -8px rgba(0, 0, 0, 0.6)` }),
})

export const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#3e63dd', dark: '#3051c4', light: '#6f8ef0' },
        secondary: { main: '#d97706' },
        // deep enough to stay over 4.5:1 as text on the page grey and on the light tints they sit on
        success: { main: '#127452' },
        error: { main: '#c8321f' },
        warning: { main: '#a35a00' },
        background: { default: '#f7f8fa', paper: '#ffffff' },
        text: { primary: ink, secondary: '#525c6b' },
        divider: slate(0.09),
      },
    },
    dark: {
      palette: {
        primary: { main: '#8da4ff', dark: '#7088f0', light: '#b1c0ff' },
        secondary: { main: '#fbbf24' },
        success: { main: '#4cc38a' },
        error: { main: '#ff6b5e' },
        warning: { main: '#f5a524' },
        background: { default: '#0a0d12', paper: '#11161e' },
        text: { primary: '#e7e9ee', secondary: 'rgba(231, 233, 238, 0.64)' },
        divider: white(0.08),
      },
    },
  },
  shape: { borderRadius: RADIUS.control },
  transitions: {
    easing: { easeInOut: EASE.out, easeOut: EASE.out, easeIn: EASE.out, sharp: EASE.out },
    duration: {
      shortest: DURATION.press,
      shorter: DURATION.hover,
      short: DURATION.small,
      standard: DURATION.medium,
      complex: DURATION.large,
      enteringScreen: DURATION.medium,
      leavingScreen: DURATION.small,
    },
  },
  typography: {
    // the platform UI face (SF Pro, Segoe UI, Roboto): no web font to download, and it renders crisply everywhere
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    // tighter tracking as type gets bigger; body text stays at 0
    h3: { fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.08 },
    h4: { fontWeight: 700, letterSpacing: '-0.028em', lineHeight: 1.15 },
    h5: { fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.2 },
    h6: { fontWeight: 600, letterSpacing: '-0.012em', lineHeight: 1.3, fontSize: '1.125rem' },
    subtitle1: { fontWeight: 600, letterSpacing: '-0.006em', lineHeight: 1.4 },
    subtitle2: { fontWeight: 600, letterSpacing: '-0.003em' },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.55 },
    caption: { lineHeight: 1.45, letterSpacing: '0.005em' },
    overline: { fontWeight: 600, letterSpacing: '0.08em', fontSize: '0.6875rem', lineHeight: 1.6 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '-0.003em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        ':root': motionCssVars,
        // background-color stays the plain page colour (print and the dark-mode test read it);
        // the colour above it is AmbientBackground
        body: { WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' },
        '::selection': { backgroundColor: alpha(theme.palette.primary.main, 0.2) },
      }),
    },
    // No Material ripple: presses scale instead (below) and keyboard focus gets a ring.
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
      styleOverrides: { root: focusRing },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: RADIUS.control,
          minHeight: 38,
          paddingInline: 16,
          transition: `${colorTransition(['background-color', 'border-color', 'color', 'box-shadow'])}, ${press}`,
          '&:active': { transform: 'scale(0.97)' },
          // fingers need taller buttons than a mouse pointer
          [touch]: { minHeight: 44 },
        },
        sizeSmall: { minHeight: 32, paddingInline: 10, ...touchTarget, [touch]: { ...touchTarget[touch], minHeight: 36 } },
        sizeLarge: { minHeight: 46, paddingInline: 22, fontSize: '0.975rem' },
        contained: ({ theme }) => ({
          // the brand gradient, a light top edge and a tinted shadow give the one primary action some depth
          backgroundImage: BRAND_GRADIENT,
          boxShadow: `inset 0 1px 0 ${white(0.16)}, 0 1px 2px ${alpha(theme.palette.primary.dark, 0.3)}, 0 2px 6px -2px ${alpha(theme.palette.primary.main, 0.35)}`,
          // gated: on touch screens a tap would leave the hover shadow stuck
          [hoverOnly]: {
            '&:hover': {
              boxShadow: `inset 0 1px 0 ${white(0.16)}, 0 1px 2px ${alpha(theme.palette.primary.dark, 0.3)}, 0 6px 16px -4px ${alpha(theme.palette.primary.main, 0.45)}`,
            },
          },
          '&.Mui-disabled': { boxShadow: 'none', backgroundImage: 'none' },
          ...theme.applyStyles('dark', {
            backgroundImage: BRAND_GRADIENT_DARK,
            boxShadow: `inset 0 1px 0 ${white(0.3)}`,
            [hoverOnly]: { '&:hover': { boxShadow: `inset 0 1px 0 ${white(0.3)}, 0 6px 18px -6px ${alpha(BRAND_VIOLET.dark, 0.5)}` } },
          }),
        }),
        // outlined and text buttons are neutral: secondary actions should not compete with the primary one
        outlined: ({ theme }) => ({
          color: theme.palette.text.primary,
          borderColor: slate(0.14),
          backgroundColor: SURFACE.control[0],
          boxShadow: `0 1px 2px ${slate(0.05)}`,
          [hoverOnly]: { '&:hover': { borderColor: slate(0.24), backgroundColor: white(0.9) } },
          '&.Mui-disabled': { boxShadow: 'none' },
          ...theme.applyStyles('dark', {
            borderColor: white(0.14),
            backgroundColor: white(0.03),
            boxShadow: 'none',
            [hoverOnly]: { '&:hover': { borderColor: white(0.26), backgroundColor: white(0.06) } },
          }),
        }),
        text: ({ theme }) => ({
          [hoverOnly]: { '&:hover': { backgroundColor: theme.palette.action.hover } },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: `${colorTransition(['background-color', 'color'])}, ${press}`,
          '&:active': { transform: 'scale(0.95)' },
          ...touchTarget,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, transition: `${colorTransition(['background-color', 'border-color', 'color'])}, ${press}` },
        clickable: { '&:active': { transform: 'scale(0.97)', boxShadow: 'none' } },
      },
      variants: [
        {
          // neutral chips get the same hairline as inputs and outlined buttons
          props: { variant: 'outlined', color: 'default' },
          style: ({ theme }) => ({ borderColor: slate(0.14), ...theme.applyStyles('dark', { borderColor: white(0.14) }) }),
        },
      ],
    },
    MuiMenuItem: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          marginInline: 6,
          minHeight: 38,
          fontSize: '0.9375rem',
          // long answers ("Secondary school (e.g. American high school, …)") wrap instead of running off a phone screen
          whiteSpace: 'normal',
          lineHeight: 1.4,
          '&.Mui-focusVisible': { outline: 'none' },
          '&.Mui-selected': { fontWeight: 600 },
          [theme.breakpoints.up('sm')]: { minHeight: 36 },
        }),
      },
    },
    MuiPaper: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        rounded: { borderRadius: RADIUS.card },
        outlined: cardSurface,
      },
    },
    // Menus and select lists: MUI's Grow starts at a squashed scale(0.75, 0.56). Instead they fade
    // while settling from 97% towards their anchor (PopTransition), and leave with a quicker fade.
    MuiPopover: {
      defaultProps: { slots: { transition: PopTransition } },
      styleOverrides: { paper: floatingSurface },
    },
    // Menu hands Popover its own (empty) transition slot, so it needs the transition set as well
    MuiMenu: {
      defaultProps: { slots: { transition: PopTransition }, transitionDuration: { enter: DURATION.small, exit: 120 } },
      styleOverrides: { list: { paddingBlock: 6 } },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: floatingSurface,
        listbox: { padding: 6 },
        option: { borderRadius: 8, minHeight: '36px !important' },
        groupLabel: ({ theme }) => ({
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          lineHeight: '32px',
          color: theme.palette.text.secondary,
          backgroundColor: 'inherit',
        }),
        tag: { maxWidth: 'calc(100% - 8px)', borderRadius: 8 },
      },
    },
    // Tooltips: a short fade with a slight settle from the trigger side (PopTransition), instead
    // of Grow's squash; moving between tooltips skips the delay.
    MuiTooltip: {
      defaultProps: {
        enterDelay: 250,
        enterNextDelay: 0,
        slots: { transition: PopTransition },
        slotProps: { transition: { timeout: { enter: 150, exit: 100 } } },
      },
      styleOverrides: {
        tooltip: ({ theme }) => ({
          ...glass(theme, 'inverse'),
          fontSize: '0.75rem',
          lineHeight: 1.45,
          padding: '6px 10px',
          borderRadius: 8,
          maxWidth: 300,
          color: '#fff',
          boxShadow: `0 8px 24px -6px ${slate(0.3)}`,
          ...theme.applyStyles('dark', { color: ink }),
        }),
        // the arrow is a separate shape: solid, so its overlap with the bubble does not show
        arrow: ({ theme }) => ({ color: ink, ...theme.applyStyles('dark', { color: INVERSE_DARK }) }),
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontWeight: 450 } },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginInline: 2, marginTop: 6, lineHeight: 1.45 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: RADIUS.control,
          backgroundColor: SURFACE.control[0],
          transition: colorTransition(['box-shadow', 'background-color']),
          // a field's edge is what shows where to type: strong enough to find (MUI's own default strength)
          '& .MuiOutlinedInput-notchedOutline': { borderColor: slate(0.24), transition: colorTransition(['border-color']) },
          [hoverOnly]: { '&:hover:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: slate(0.4) } },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 1, borderColor: theme.palette.primary.main },
          '&.Mui-focused': { backgroundColor: theme.palette.background.paper, boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}` },
          '&.Mui-error.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(theme.palette.error.main, 0.18)}` },
          '&.Mui-disabled': { backgroundColor: 'transparent' },
          ...theme.applyStyles('dark', {
            backgroundColor: SURFACE.control[1],
            '&.Mui-focused': { backgroundColor: white(0.05), boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}` },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: white(0.2), transition: colorTransition(['border-color']) },
            [hoverOnly]: { '&:hover:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: white(0.34) } },
          }),
        }),
      },
    },
    MuiSelect: {
      defaultProps: { MenuProps: { slotProps: { paper: { sx: { mt: 0.75 } } } } },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          ...touchTarget,
          borderRadius: 8,
          transition: `${colorTransition(['background-color', 'color'])}, ${press}`,
          '&:active': { transform: 'scale(0.9)' },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 999,
          backgroundColor: slate(0.07),
          ...theme.applyStyles('dark', { backgroundColor: white(0.08) }),
        }),
        bar: {
          borderRadius: 999,
          // a value that changes (what-if re-run) moves on screen: ease-in-out
          transition: `transform ${DURATION.large}ms ${EASE.inOut}`,
        },
      },
    },
    MuiDivider: {
      styleOverrides: { root: ({ theme }) => ({ borderColor: theme.palette.divider }) },
    },
    MuiAccordion: {
      styleOverrides: {
        root: { borderRadius: RADIUS.card, '&::before': { display: 'none' } },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 56,
          paddingInline: theme.spacing(2.5),
          borderRadius: RADIUS.card,
          transition: colorTransition(['background-color']),
          [hoverOnly]: { '&:hover': { backgroundColor: theme.palette.action.hover } },
          '&.Mui-focusVisible': { outlineOffset: -2, backgroundColor: 'transparent' },
        }),
        // the chevron turns over on screen: ease-in-out, a touch slower than a colour change
        expandIconWrapper: { transition: `transform ${DURATION.medium}ms ${EASE.inOut}` },
      },
    },
    MuiCollapse: { defaultProps: { timeout: DURATION.large } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: RADIUS.inset, alignItems: 'flex-start' },
      },
      // a hairline in the alert's own colour, so the tinted box has an edge on the light page
      variants: (['error', 'warning'] as const).map((severity) => ({
        props: { variant: 'standard' as const, severity },
        style: ({ theme }: { theme: Theme }) => ({ border: `1px solid ${alpha(theme.palette[severity].main, 0.22)}` }),
      })),
    },
    MuiStepButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: RADIUS.inset,
          transition: colorTransition(['background-color']),
          [hoverOnly]: { '&:hover': { backgroundColor: theme.palette.action.hover } },
        }),
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: ({ theme }) => ({
          fontWeight: 500,
          transition: colorTransition(['color']),
          '&.Mui-active, &.Mui-completed': { fontWeight: 600, color: theme.palette.text.primary },
        }),
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: { transition: colorTransition(['color']) },
        text: { fontWeight: 600 },
      },
    },
    MuiStepConnector: {
      styleOverrides: {
        line: ({ theme }) => ({ borderTopWidth: 2, borderRadius: 2, borderColor: theme.palette.divider, transition: colorTransition(['border-color']) }),
        root: ({ theme }) => ({
          '&.Mui-active .MuiStepConnector-line, &.Mui-completed .MuiStepConnector-line': {
            borderColor: theme.palette.primary.main,
          },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({ borderColor: theme.palette.divider, fontVariantNumeric: 'tabular-nums' }),
        head: ({ theme }) => ({
          fontWeight: 600,
          color: theme.palette.text.secondary,
          fontSize: '0.75rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }),
      },
    },
    MuiSkeleton: {
      styleOverrides: { root: ({ theme }) => ({ backgroundColor: slate(0.07), ...theme.applyStyles('dark', { backgroundColor: white(0.07) }) }) },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: ({ theme }) => ({
          ...glass(theme, 'inverse'),
          borderRadius: RADIUS.inset,
          border: 'none',
          color: '#fff',
          boxShadow: `0 12px 32px -8px ${slate(0.35)}`,
          ...theme.applyStyles('dark', { color: ink }),
        }),
      },
    },
  },
})
