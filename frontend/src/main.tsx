import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import AmbientBackground from './components/AmbientBackground'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import MotionProvider from './MotionProvider'
import { theme } from './theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline enableColorScheme />
      <AmbientBackground />
      <MotionProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </MotionProvider>
    </ThemeProvider>
  </StrictMode>,
)
