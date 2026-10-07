import ExpandMore from '@mui/icons-material/ExpandMore'
import Hub from '@mui/icons-material/HubOutlined'
import Leaderboard from '@mui/icons-material/LeaderboardOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Recommendation } from '../../api/types'
import { Meter, Tile } from '../../design/primitives'
import type { SurfaceMotion } from '../../design/primitives'
import { FONT } from '../../design/tokens'
import { pct } from '../../format'
import { DURATION, EASE, TRANSITION } from '../../motion'

/** Roles listed before "See all": the top of the ranking, two full rows on wide screens. */
const PREVIEW = 6

function Bar({ label, value, strong, delay }: { label: ReactNode; value: number; strong?: boolean; delay?: number }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2, mb: 0.75 }}>
        <Typography variant="body2" sx={{ fontWeight: strong ? 650 : 450, minWidth: 0 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: strong ? 650 : 450, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {pct(value)}
        </Typography>
      </Stack>
      <Meter value={value} tone={strong ? 'brand' : 'cyan'} muted={!strong} delay={delay} />
    </Box>
  )
}

/**
 * The wider picture: the career families the profile points to, and every one of the 20
 * roles ranked (the top shown, the rest one press away).
 */
export default function Landscape({ result, motion }: { result: Recommendation; motion?: (i: number) => SurfaceMotion }) {
  const [all, setAll] = useState(false)
  const n = result.ranking.length
  const rows = all ? result.ranking : result.ranking.slice(0, PREVIEW)

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 5 }}>
        <Tile icon={<Hub />} tone="cyan" title="Career families" className="avoid-break" motion={motion?.(0)}>
          <Typography variant="body2" color="text.secondary" sx={{ mt: -0.5, mb: 2.5 }}>
            The {n} roles grouped into broader career paths. A family’s score adds up its roles, so it shows the direction
            even when no single role stands out.
          </Typography>
          <Stack spacing={2}>
            {result.families.map((f, i) => (
              <Bar key={f.family} label={f.family} value={f.probability} strong={i === 0} delay={0.08 * i} />
            ))}
          </Stack>
        </Tile>
      </Grid>
      <Grid size={{ xs: 12, md: 7 }}>
        <Tile icon={<Leaderboard />} tone="indigo" title={`All ${n} roles, ranked`} motion={motion?.(1)}>
          <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', columnGap: 4, rowGap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <AnimatePresence initial={false}>
              {rows.map((r, i) => (
                <m.li
                  key={r.job_role}
                  // the rest of the ranking arrives in order once "See all" opens it
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { ...TRANSITION.medium, delay: i >= PREVIEW ? (i - PREVIEW) * 0.025 : 0 } }}
                  exit={{ opacity: 0, transition: { duration: DURATION.small / 1000 } }}
                  style={{ minWidth: 0 }}
                >
                  <Bar
                    strong={i < 3}
                    value={r.probability}
                    label={
                      <>
                        <Box component="span" sx={{ fontFamily: FONT.mono, fontSize: '0.8125rem', color: 'text.secondary', display: 'inline-block', minWidth: '2.2ch' }}>
                          {i + 1}.
                        </Box>{' '}
                        {r.label}
                      </>
                    }
                  />
                </m.li>
              ))}
            </AnimatePresence>
          </Box>
          <Button
            color="inherit"
            onClick={() => setAll((a) => !a)}
            aria-expanded={all}
            className="no-print"
            endIcon={<ExpandMore sx={{ transform: all ? 'rotate(180deg)' : 'none', transition: `transform ${DURATION.medium}ms ${EASE.inOut}` }} />}
            sx={{ mt: 2.5, alignSelf: 'flex-start', color: 'text.secondary' }}
          >
            {all ? `Show the top ${PREVIEW}` : `See all ${n} job roles`}
          </Button>
        </Tile>
      </Grid>
    </Grid>
  )
}
