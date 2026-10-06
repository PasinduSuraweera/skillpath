import { alpha, createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { DURATION, EASE, motionCssVars } from './motion'

// Light and dark palettes. The app starts in the visitor's system setting and
// the header button switches it (MUI remembers the choice in localStorage).
//
// Motion: MUI's transition tokens are set from motion.ts, so its own menus,
// tooltips, collapses and colour changes use the same curves and durations as
// the app's animations. MUI uses "easeInOut" as the default for nearly all of
// them (most are enters and exits), so it is the strong ease-out here; real
// on-screen movement uses EASE.inOut from motion.ts directly.

const ink = '#111827'
const slate = (a: number) => `rgba(15, 23, 42, ${a})`
const white = (a: number) => `rgba(255, 255, 255, ${a})`

const colorTransition = (props: string[]) =>
  props.map((p) => `${p} ${DURATION.hover}ms ${EASE.standard}`).join(', ')
const press = `transform ${DURATION.press}ms ${EASE.out}`

const focusRing = ({ theme }: { theme: Theme }) => ({
  '&.Mui-focusVisible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
})

/** The resting card: hairline border and a soft two-layer shadow (just a top highlight in dark mode). */
const cardSurface = ({ theme }: { theme: Theme }) => ({
  borderColor: theme.palette.divider,
  boxShadow: `0 1px 2px ${slate(0.04)}, 0 2px 8px -2px ${slate(0.06)}`,
  ...theme.applyStyles('dark', { boxShadow: `inset 0 1px 0 ${white(0.03)}` }),
})

/** Floating layers (menus, autocomplete lists): a deeper shadow so they read as above the page. */
const floatingSurface = ({ theme }: { theme: Theme }) => ({
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: `0 12px 32px -8px ${slate(0.18)}, 0 4px 8px -4px ${slate(0.08)}`,
  ...theme.applyStyles('dark', { boxShadow: `0 16px 40px -8px rgba(0, 0, 0, 0.6)`, backgroundColor: '#161c24' }),
})

export const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#1565c0' },
        secondary: { main: '#ef6c00' },
        background: { default: '#f6f7f9', paper: '#ffffff' },
        text: { primary: ink, secondary: '#4b5563' },
        divider: slate(0.09),
      },
    },
    dark: {
      palette: {
        primary: { main: '#64b5f6' },
        secondary: { main: '#ffb74d' },
        background: { default: '#0b0f14', paper: '#12171e' },
        text: { primary: '#e6e8eb', secondary: 'rgba(230, 232, 235, 0.66)' },
        divider: white(0.08),
      },
    },
  },
  shape: { borderRadius: 10 },
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
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    // tighter tracking as type gets bigger; body text stays at 0
    h4: { fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15 },
    h5: { fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 },
    h6: { fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3 },
    subtitle1: { fontWeight: 600, letterSpacing: '-0.005em' },
    subtitle2: { fontWeight: 600 },
    body2: { lineHeight: 1.5 },
    caption: { lineHeight: 1.45 },
    overline: { fontWeight: 600, letterSpacing: '0.08em', fontSize: '0.6875rem' },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': motionCssVars,
      },
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
          borderRadius: 10,
          transition: `${colorTransition(['background-color', 'border-color', 'color', 'box-shadow'])}, ${press}`,
          '&:active': { transform: 'scale(0.97)' },
        },
        contained: ({ theme }) => ({
          boxShadow: `inset 0 1px 0 ${white(0.14)}, 0 1px 2px ${slate(0.18)}`,
          // gated: on touch screens a tap would leave the hover shadow stuck
          '@media (hover: hover) and (pointer: fine)': {
            '&:hover': { boxShadow: `inset 0 1px 0 ${white(0.14)}, 0 2px 6px ${alpha(theme.palette.primary.main, 0.28)}` },
          },
          '&.Mui-disabled': { boxShadow: 'none' },
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
    },
    MuiMenuItem: {
      styleOverrides: { root: { '&.Mui-focusVisible': { outline: 'none' } } },
    },
    MuiPaper: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        rounded: { borderRadius: 14 },
        outlined: cardSurface,
      },
    },
    MuiPopover: { styleOverrides: { paper: floatingSurface } },
    MuiMenu: { defaultProps: { transitionDuration: { enter: DURATION.medium, exit: DURATION.small } } },
    MuiAutocomplete: {
      styleOverrides: {
        paper: floatingSurface,
        tag: { maxWidth: 'calc(100% - 8px)' },
      },
    },
    MuiTooltip: {
      defaultProps: { enterDelay: 250, enterNextDelay: 0 },
      styleOverrides: {
        tooltip: ({ theme }) => ({
          fontSize: '0.75rem',
          lineHeight: 1.45,
          padding: '6px 10px',
          borderRadius: 8,
          maxWidth: 300,
          backgroundColor: ink,
          boxShadow: `0 8px 24px -6px ${slate(0.3)}`,
          ...theme.applyStyles('dark', { backgroundColor: '#e6e8eb', color: ink }),
        }),
        arrow: ({ theme }) => ({ color: ink, ...theme.applyStyles('dark', { color: '#e6e8eb' }) }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          transition: colorTransition(['box-shadow', 'background-color']),
          '& .MuiOutlinedInput-notchedOutline': { transition: colorTransition(['border-color']) },
          '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.16)}` },
          '&.Mui-error.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(theme.palette.error.main, 0.16)}` },
        }),
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
    MuiAccordion: {
      styleOverrides: {
        root: { borderRadius: 14, '&::before': { display: 'none' } },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 56,
          paddingInline: theme.spacing(2.5),
          borderRadius: 14,
          transition: colorTransition(['background-color']),
          '@media (hover: hover) and (pointer: fine)': { '&:hover': { backgroundColor: theme.palette.action.hover } },
          '&.Mui-focusVisible': { outlineOffset: -2, backgroundColor: 'transparent' },
        }),
      },
    },
    MuiCollapse: { defaultProps: { timeout: DURATION.large } },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 12, alignItems: 'flex-start' } },
    },
    MuiStepButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 12,
          transition: colorTransition(['background-color']),
          '@media (hover: hover) and (pointer: fine)': { '&:hover': { backgroundColor: theme.palette.action.hover } },
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
        head: ({ theme }) => ({ fontWeight: 600, color: theme.palette.text.secondary, fontSize: '0.8125rem' }),
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 12,
          backgroundColor: ink,
          boxShadow: `0 12px 32px -8px ${slate(0.35)}`,
          ...theme.applyStyles('dark', { backgroundColor: '#e6e8eb', color: ink }),
        }),
      },
    },
  },
})
