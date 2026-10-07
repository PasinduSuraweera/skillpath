import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

/** Title and one-paragraph explanation at the top of a wizard step. The title takes focus when the step opens. */
export default function StepHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="h5" component="h2" id="step-title" tabIndex={-1} sx={{ fontSize: { xs: '1.25rem', sm: '1.375rem' } }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
        {children}
      </Typography>
    </Box>
  )
}
