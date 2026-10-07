import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

/** Title and one-paragraph explanation at the top of a wizard step. The title takes focus when the step opens. */
export default function StepHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: { xs: 0.5, md: 1 } }}>
      <Typography variant="h3" component="h2" id="step-title" tabIndex={-1}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 720, textWrap: 'pretty' }}>
        {children}
      </Typography>
    </Box>
  )
}
