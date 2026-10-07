import { alpha, createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import '@fontsource-variable/inter/opsz.css'
import PopTransition from './components/PopTransition'
import {
  BRAND,
  BRAND_GRADIENT,
  BRAND_GRADIENT_DARK,
  FONT,
  FORCED_COLORS,
  HOVER,
  INK,
  INK_DARK,
  RADIUS,
  TOUCH,
  glass,
  glassEdge,
  ink,
  mergeStyles,
  shadow,
  white,
} from './design/tokens'
import { DURATION, EASE, motionCssVars } from './motion'

// The MUI theme, built from the design tokens (design/tokens.ts). The app starts in the
// visitor's system setting and the nav button switches it (MUI remembers the choice).
//
// Visual language: content on layered glass over an aurora canvas. One indigo-to-violet
// gradient marks the primary action and the model's strongest statements; insights get
// their own tones (design/tokens.ts TONES). Secondary controls are neutral glass so the
// one primary action on a screen stands out.
//
// Motion: MUI's transition tokens come from motion.ts, so its menus, tooltips, collapses
// and colour changes share the app's curves. MUI uses "easeInOut" for nearly all of them
// (mostly enters and exits), so it is the strong ease-out here; real on-screen movement
// uses EASE.inOut from motion.ts directly.

const colorTransition = (props: string[]) => props.map((p) => `${p} ${DURATION.hover}ms ${EASE.standard}`).join(', ')
const press = `transform ${DURATION.press}ms ${EASE.out}`

/** On touch screens, a hit area of at least 44 × 44 px around a small control, without changing its layout. */
const touchTarget = {
  [TOUCH]: {
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
  '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
})

/** Floating layers (menus, autocomplete lists): the most opaque glass and the deepest shadow. */
const floatingSurface = ({ theme }: { theme: Theme }) =>
  mergeStyles(glass(theme, 'floating'), glassEdge(theme), shadow(theme, 'high'), { borderRadius: RADIUS.inset })

export const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: BRAND.indigo.light, dark: '#4338ca', light: '#818cf8', contrastText: '#ffffff' },
        secondary: { main: '#b45309' },
        // deep enough to stay over 4.5:1 as text on the page and on the light tints they sit on
        success: { main: '#047857', dark: '#065f46' },
        error: { main: '#c42b1c' },
        warning: { main: '#a35a00' },
        background: { default: '#f3f4fa', paper: '#ffffff' },
        text: { primary: INK, secondary: '#4a5470' },
        divider: ink(0.09),
      },
    },
    dark: {
      palette: {
        primary: { main: BRAND.indigo.dark, dark: '#818cf8', light: '#c7d2fe', contrastText: INK },
        secondary: { main: '#fcd34d' },
        success: { main: '#6ee7b7', dark: '#34d399' },
        error: { main: '#ff8a80' },
        warning: { main: '#fbbf24' },
        background: { default: '#06070d', paper: '#11142a' },
        text: { primary: INK_DARK, secondary: 'rgba(238, 240, 248, 0.68)' },
        divider: white(0.09),
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
    fontFamily: FONT.sans,
    // tighter tracking as type gets bigger; body text stays near 0
    h1: { fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 1.02, fontSize: 'clamp(2.375rem, 1.45rem + 3.5vw, 4.25rem)' },
    h2: { fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.08, fontSize: 'clamp(1.75rem, 1.3rem + 1.6vw, 2.5rem)' },
    h3: { fontWeight: 680, letterSpacing: '-0.028em', lineHeight: 1.12, fontSize: 'clamp(1.375rem, 1.15rem + 0.9vw, 1.875rem)' },
    h4: { fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.2, fontSize: '1.25rem' },
    h5: { fontWeight: 620, letterSpacing: '-0.014em', lineHeight: 1.3, fontSize: '1.0625rem' },
    h6: { fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.35, fontSize: '0.9375rem' },
    subtitle1: { fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.4 },
    subtitle2: { fontWeight: 600, letterSpacing: '-0.006em', lineHeight: 1.45 },
    body1: { lineHeight: 1.6, letterSpacing: '-0.006em' },
    body2: { lineHeight: 1.55, letterSpacing: '-0.003em' },
    caption: { lineHeight: 1.45, letterSpacing: '0' },
    overline: { fontWeight: 650, letterSpacing: '0.1em', fontSize: '0.6875rem', lineHeight: 1.6 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '-0.008em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        ':root': motionCssVars,
        // background-color stays the plain page colour (print and the dark-mode test read it);
        // the colour above it is AmbientBackground
        body: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          fontOpticalSizing: 'auto',
          textRendering: 'optimizeLegibility',
        },
        '::selection': { backgroundColor: alpha(theme.palette.primary.main, 0.22) },
      }),
    },
    // No Material ripple: presses scale instead and keyboard focus gets a ring.
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
      styleOverrides: { root: focusRing },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        // capsule buttons: the shape reads as "pressable" at a glance
        root: {
          borderRadius: RADIUS.pill,
          minHeight: 42,
          paddingInline: 18,
          transition: `${colorTransition(['background-color', 'border-color', 'color', 'box-shadow'])}, ${press}`,
          '&:active': { transform: 'scale(0.97)' },
          [TOUCH]: { minHeight: 46 },
        },
        sizeSmall: { minHeight: 32, paddingInline: 12, fontSize: '0.8125rem', ...touchTarget, [TOUCH]: { ...touchTarget[TOUCH], minHeight: 36 } },
        sizeLarge: { minHeight: 52, paddingInline: 26, fontSize: '1rem' },
        contained: ({ theme }) => ({
          // the brand gradient, a lit top edge and a glow in the accent's hue: the one primary action
          backgroundImage: BRAND_GRADIENT,
          boxShadow: `inset 0 1px 0 ${white(0.22)}, 0 1px 2px ${alpha('#4338ca', 0.35)}, 0 8px 22px -8px ${alpha('#6d28d9', 0.55)}`,
          [HOVER]: {
            '&:hover': {
              boxShadow: `inset 0 1px 0 ${white(0.22)}, 0 1px 2px ${alpha('#4338ca', 0.35)}, 0 14px 32px -10px ${alpha('#6d28d9', 0.7)}`,
            },
          },
          '&.Mui-disabled': { boxShadow: 'none', backgroundImage: 'none' },
          [FORCED_COLORS]: { border: '1px solid ButtonText' },
          ...theme.applyStyles('dark', {
            backgroundImage: BRAND_GRADIENT_DARK,
            boxShadow: `inset 0 1px 0 ${white(0.5)}, 0 10px 28px -10px ${alpha('#a78bfa', 0.6)}`,
            [HOVER]: { '&:hover': { boxShadow: `inset 0 1px 0 ${white(0.5)}, 0 14px 36px -10px ${alpha('#a78bfa', 0.8)}` } },
          }),
        }),
        // outlined buttons are neutral glass: secondary actions should not compete with the primary one
        outlined: ({ theme }) => ({
          color: theme.palette.text.primary,
          borderColor: ink(0.12),
          backgroundColor: white(0.62),
          boxShadow: `inset 0 1px 0 ${white(0.9)}, 0 1px 2px ${ink(0.06)}`,
          [HOVER]: { '&:hover': { borderColor: ink(0.22), backgroundColor: white(0.9) } },
          '&.Mui-disabled': { boxShadow: 'none' },
          ...theme.applyStyles('dark', {
            borderColor: white(0.14),
            backgroundColor: white(0.05),
            boxShadow: `inset 0 1px 0 ${white(0.06)}`,
            [HOVER]: { '&:hover': { borderColor: white(0.26), backgroundColor: white(0.1) } },
          }),
        }),
        text: ({ theme }) => ({ [HOVER]: { '&:hover': { backgroundColor: theme.palette.action.hover } } }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: `${colorTransition(['background-color', 'color'])}, ${press}`,
          '&:active': { transform: 'scale(0.94)' },
          ...touchTarget,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 550, borderRadius: RADIUS.pill, transition: `${colorTransition(['background-color', 'border-color', 'color'])}, ${press}` },
        clickable: { '&:active': { transform: 'scale(0.96)', boxShadow: 'none' } },
      },
      variants: [
        {
          props: { variant: 'outlined', color: 'default' },
          style: ({ theme }) => ({
            borderColor: ink(0.12),
            backgroundColor: white(0.5),
            ...theme.applyStyles('dark', { borderColor: white(0.14), backgroundColor: white(0.04) }),
          }),
        },
      ],
    },
    MuiMenuItem: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          marginInline: 6,
          minHeight: 40,
          fontSize: '0.9375rem',
          // long answers wrap instead of running off a phone screen
          whiteSpace: 'normal',
          lineHeight: 1.4,
          '&.Mui-focusVisible': { outline: 'none' },
          '&.Mui-selected': { fontWeight: 600 },
          [theme.breakpoints.up('sm')]: { minHeight: 36 },
        }),
      },
    },
    // MUI's own papers (accordion, fallback cards) are panel glass; app surfaces use design/Surface
    MuiPaper: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        rounded: { borderRadius: RADIUS.card },
        outlined: ({ theme }) => ({ ...glass(theme, 'panel'), ...glassEdge(theme), ...shadow(theme, 'low') }),
      },
    },
    // Menus and select lists fade while settling towards their anchor (PopTransition), not MUI's squashed Grow.
    MuiPopover: {
      defaultProps: { slots: { transition: PopTransition } },
      styleOverrides: { paper: floatingSurface },
    },
    MuiMenu: {
      defaultProps: { slots: { transition: PopTransition }, transitionDuration: { enter: DURATION.small, exit: 120 } },
      styleOverrides: { list: { paddingBlock: 6 } },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: floatingSurface,
        // groups are styled by class, so a list that renders its own groups (AboutStep) matches
        listbox: ({ theme }) => ({
          padding: 6,
          '& .MuiAutocomplete-groupLabel': {
            top: -6,
            fontSize: '0.6875rem',
            fontWeight: 650,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            lineHeight: '32px',
            color: theme.palette.text.secondary,
            // sticky over the options scrolling under it: glass like the menu, so they blur away behind it
            ...glass(theme, 'floating'),
          },
          '& .MuiAutocomplete-groupUl': { padding: 0, '& .MuiAutocomplete-option': { paddingLeft: 24 } },
        }),
        option: { borderRadius: 10, minHeight: '38px !important' },
        tag: { maxWidth: 'calc(100% - 8px)', borderRadius: 999 },
      },
    },
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
          padding: '7px 11px',
          borderRadius: 10,
          maxWidth: 300,
          color: '#fff',
          boxShadow: `0 10px 30px -8px ${ink(0.35)}`,
          ...theme.applyStyles('dark', { color: INK }),
        }),
        arrow: ({ theme }) => ({ color: INK, ...theme.applyStyles('dark', { color: INK_DARK }) }),
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontWeight: 450 } } },
    MuiFormHelperText: { styleOverrides: { root: { marginInline: 4, marginTop: 6, lineHeight: 1.45 } } },
    // Fields are frosted wells: a brighter fill than the panel, a hairline, and a soft accent halo on focus.
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: RADIUS.control,
          backgroundColor: white(0.66),
          boxShadow: `inset 0 1px 2px ${ink(0.04)}`,
          transition: colorTransition(['box-shadow', 'background-color']),
          // a field's edge is what shows where to type: strong enough to find
          '& .MuiOutlinedInput-notchedOutline': { borderColor: ink(0.2), transition: colorTransition(['border-color']) },
          [HOVER]: { '&:hover:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: ink(0.36) } },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 1, borderColor: theme.palette.primary.main },
          '&.Mui-focused': { backgroundColor: white(0.95), boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.16)}` },
          '&.Mui-error.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(theme.palette.error.main, 0.16)}` },
          '&.Mui-disabled': { backgroundColor: 'transparent', boxShadow: 'none' },
          ...theme.applyStyles('dark', {
            backgroundColor: white(0.04),
            boxShadow: 'none',
            '&.Mui-focused': { backgroundColor: white(0.07), boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.2)}` },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: white(0.18), transition: colorTransition(['border-color']) },
            [HOVER]: { '&:hover:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: white(0.32) } },
          }),
        }),
      },
    },
    MuiSelect: { defaultProps: { MenuProps: { slotProps: { paper: { sx: { mt: 0.75 } } } } } },
    MuiCheckbox: {
      styleOverrides: {
        root: { ...touchTarget, borderRadius: 8, transition: `${colorTransition(['background-color', 'color'])}, ${press}`, '&:active': { transform: 'scale(0.9)' } },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: ({ theme }) => ({ borderRadius: 999, backgroundColor: ink(0.07), ...theme.applyStyles('dark', { backgroundColor: white(0.08) }) }),
        // a value that changes (what-if re-run) moves on screen: ease-in-out
        bar: { borderRadius: 999, transition: `transform ${DURATION.large}ms ${EASE.inOut}` },
      },
    },
    MuiDivider: { styleOverrides: { root: ({ theme }) => ({ borderColor: theme.palette.divider }) } },
    MuiCollapse: { defaultProps: { timeout: DURATION.large } },
    MuiAlert: {
      styleOverrides: {
        // translucent but not blurred: alerts open inside a fading wrapper, which would switch a blur off mid-fade
        root: ({ theme }) => ({
          borderRadius: RADIUS.inset,
          alignItems: 'flex-start',
          backgroundColor: white(0.78),
          ...theme.applyStyles('dark', { backgroundColor: 'rgba(17, 20, 38, 0.82)' }),
          ...shadow(theme, 'low'),
        }),
      },
      // a hairline and a wash in the alert's own colour, over the glass
      variants: (['error', 'warning', 'info', 'success'] as const).map((severity) => ({
        props: { variant: 'standard' as const, severity },
        style: ({ theme }: { theme: Theme }) => ({
          border: `1px solid ${alpha(theme.palette[severity].main, 0.3)}`,
          backgroundImage: `linear-gradient(${alpha(theme.palette[severity].main, 0.1)}, ${alpha(theme.palette[severity].main, 0.06)})`,
          '& .MuiAlert-icon': { color: theme.palette[severity].main },
        }),
      })),
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({ borderColor: theme.palette.divider, fontVariantNumeric: 'tabular-nums' }),
        head: ({ theme }) => ({
          fontWeight: 650,
          color: theme.palette.text.secondary,
          fontSize: '0.6875rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }),
      },
    },
    MuiSkeleton: {
      styleOverrides: { root: ({ theme }) => ({ backgroundColor: ink(0.06), ...theme.applyStyles('dark', { backgroundColor: white(0.06) }) }) },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: ({ theme }) => ({
          ...glass(theme, 'inverse'),
          borderRadius: RADIUS.inset,
          border: 'none',
          color: '#fff',
          paddingInline: 18,
          boxShadow: `0 18px 44px -12px ${ink(0.45)}`,
          ...theme.applyStyles('dark', { color: INK, boxShadow: '0 18px 44px -12px rgba(0, 0, 0, 0.8)' }),
        }),
      },
    },
  },
})
