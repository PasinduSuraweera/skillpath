import { createTheme } from '@mui/material/styles'

// Light and dark palettes. The app starts in the visitor's system setting and
// the header button switches it (MUI remembers the choice in localStorage).
export const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#1565c0' },
        secondary: { main: '#ef6c00' },
        background: { default: '#f5f7fb' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#64b5f6' },
        secondary: { main: '#ffb74d' },
        background: { default: '#0f1419', paper: '#171d24' },
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiPaper: { defaultProps: { variant: 'outlined' } },
    MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
  },
})
