import Fade from '@mui/material/Fade'
import { alpha, createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { DURATION, EASE, motionCssVars } from './motion'

// Light and dark palettes. The app starts in the visitor's system setting and
// the header button switches it (MUI remembers the choice in localStorage).
//
// Visual language: quiet neutral surfaces, one indigo accent for anything the
// model says or the visitor should act on, and a single indigo-to-violet
// gradient (BRAND_GRADIENT) kept for the few "intelligence" moments: the
// best match and the analysis state. Neutral controls (outlined and text
// buttons) stay grey so the one primary action on a screen stands out.
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

/** Radius scale: controls, inset panels, cards. */
export const RADIUS = { control: 10, inset: 12, card: 16 }

/** Elevation scale (light mode; dark mode uses borders and a top highlight instead). */
export const ELEVATION = {
  card: `0 1px 2px ${slate(0.04)}, 0 2px 6px -2px ${slate(0.05)}`,
  raised: `0 1px 2px ${slate(0.05)}, 0 8px 24px -8px ${slate(0.12)}`,
  floating: `0 16px 40px -12px ${slate(0.22)}, 0 4px 10px -4px ${slate(0.08)}`,
}

const colorTransition = (props: string[]) =>
  props.map((p) => `${p} ${DURATION.hover}ms ${EASE.standard}`).join(', ')
const press = `transform ${DURATION.press}ms ${EASE.out}`
const hoverOnly = '@media (hover: hover) and (pointer: fine)'

const focusRing = ({ theme }: { theme: Theme }) => ({
  '&.Mui-focusVisible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
})

/** The resting card: hairline border and a soft two-layer shadow (just a top highlight in dark mode). */
const cardSurface = ({ theme }: { theme: Theme }) => ({
  borderColor: theme.palette.divider,
  boxShadow: ELEVATION.card,
  ...theme.applyStyles('dark', { boxShadow: `inset 0 1px 0 ${white(0.04)}` }),
})

/** Floating layers (menus, autocomplete lists): a deeper shadow so they read as above the page. */
const floatingSurface = ({ theme }: { theme: Theme }) => ({
  borderRadius: RADIUS.inset,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: ELEVATION.floating,
  ...theme.applyStyles('dark', { boxShadow: `0 16px 40px -8px rgba(0, 0, 0, 0.6)`, backgroundColor: '#151b25' }),
})

export const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#3e63dd', dark: '#3051c4', light: '#6f8ef0' },
        secondary: { main: '#d97706' },
        success: { main: '#16825d' },
        error: { main: '#d93a2b' },
        warning: { main: '#c26a00' },
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
        body: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          // a faint wash of the accent at the top of the page; static, and drawn as an image so
          // background-color stays the plain page colour (print and the dark-mode test read it)
          backgroundImage: `radial-gradient(1100px 420px at 50% -160px, ${alpha(theme.palette.primary.main, 0.09)}, transparent 70%)`,
          backgroundRepeat: 'no-repeat',
          ...theme.applyStyles('dark', {
            backgroundImage: `radial-gradient(1100px 420px at 50% -160px, ${alpha(theme.palette.primary.main, 0.12)}, transparent 70%)`,
          }),
        },
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
        },
        sizeSmall: { minHeight: 32, paddingInline: 10 },
        sizeLarge: { minHeight: 46, paddingInline: 22, fontSize: '0.975rem' },
        contained: ({ theme }) => ({
          // a light top edge and a tinted shadow give the one primary action some depth
          boxShadow: `inset 0 1px 0 ${white(0.16)}, 0 1px 2px ${alpha(theme.palette.primary.dark, 0.3)}, 0 2px 6px -2px ${alpha(theme.palette.primary.main, 0.35)}`,
          // gated: on touch screens a tap would leave the hover shadow stuck
          [hoverOnly]: {
            '&:hover': {
              boxShadow: `inset 0 1px 0 ${white(0.16)}, 0 1px 2px ${alpha(theme.palette.primary.dark, 0.3)}, 0 6px 16px -4px ${alpha(theme.palette.primary.main, 0.45)}`,
            },
          },
          '&.Mui-disabled': { boxShadow: 'none' },
          ...theme.applyStyles('dark', { boxShadow: `inset 0 1px 0 ${white(0.3)}` }),
        }),
        // outlined and text buttons are neutral: secondary actions should not compete with the primary one
        outlined: ({ theme }) => ({
          color: theme.palette.text.primary,
          borderColor: slate(0.14),
          backgroundColor: theme.palette.background.paper,
          boxShadow: `0 1px 2px ${slate(0.05)}`,
          [hoverOnly]: { '&:hover': { borderColor: slate(0.24), backgroundColor: theme.palette.background.paper } },
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
    // while settling from 97% towards their anchor (MUI sets transform-origin at the anchor), and
    // leave with a plain, quicker fade.
    MuiPopover: {
      defaultProps: { slots: { transition: Fade } },
      styleOverrides: {
        paper: (props: { theme: Theme }) => ({ ...floatingSurface(props), animation: `sp-settle ${DURATION.small}ms ${EASE.out}` }),
      },
    },
    MuiMenu: {
      defaultProps: { transitionDuration: { enter: DURATION.small, exit: 120 } },
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
    // Tooltips: a short fade with a slight settle from the trigger side (MUI sets the origin per
    // placement), instead of Grow's squash; moving between tooltips skips the delay.
    MuiTooltip: {
      defaultProps: {
        enterDelay: 250,
        enterNextDelay: 0,
        slots: { transition: Fade },
        slotProps: { transition: { timeout: { enter: 150, exit: 100 } } },
      },
      styleOverrides: {
        tooltip: ({ theme }) => ({
          animation: `sp-settle 150ms ${EASE.out}`,
          fontSize: '0.75rem',
          lineHeight: 1.45,
          padding: '6px 10px',
          borderRadius: 8,
          maxWidth: 300,
          backgroundColor: ink,
          boxShadow: `0 8px 24px -6px ${slate(0.3)}`,
          ...theme.applyStyles('dark', { backgroundColor: '#e7e9ee', color: ink }),
        }),
        arrow: ({ theme }) => ({ color: ink, ...theme.applyStyles('dark', { color: '#e7e9ee' }) }),
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
          backgroundColor: theme.palette.background.paper,
          transition: colorTransition(['box-shadow', 'background-color']),
          '& .MuiOutlinedInput-notchedOutline': { borderColor: slate(0.16), transition: colorTransition(['border-color']) },
          [hoverOnly]: { '&:hover:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: slate(0.3) } },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 1, borderColor: theme.palette.primary.main },
          '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}` },
          '&.Mui-error.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(theme.palette.error.main, 0.18)}` },
          '&.Mui-disabled': { backgroundColor: 'transparent' },
          ...theme.applyStyles('dark', {
            backgroundColor: white(0.025),
            '& .MuiOutlinedInput-notchedOutline': { borderColor: white(0.14) },
            [hoverOnly]: { '&:hover:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: white(0.28) } },
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
          borderRadius: RADIUS.inset,
          backgroundColor: ink,
          boxShadow: `0 12px 32px -8px ${slate(0.35)}`,
          ...theme.applyStyles('dark', { backgroundColor: '#e7e9ee', color: ink }),
        }),
      },
    },
  },
})
