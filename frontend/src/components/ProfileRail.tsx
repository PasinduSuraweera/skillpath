import Check from '@mui/icons-material/Check'
import TipsAndUpdates from '@mui/icons-material/TipsAndUpdatesOutlined'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { AnimatePresence, m } from 'motion/react'
import { Eyebrow, RingGauge } from '../design/primitives'
import { FORCED_COLORS, HOVER, RADIUS, TONES, ink, toneColor, white } from '../design/tokens'
import { RevealContext, TRANSITION } from '../motion'
import { STEPS } from '../steps'


interface Props {
  step: number
  /** answered / total per question step (stepProgress in form.ts) */
  progress: { answered: number; total: number }[]
  disabled: boolean
  onGo: (step: number) => void
}

/**
 * The questionnaire's map, also its progress display. On wide screens a rail beside the
 * questions: how complete the profile is, the three steps with their answered counts, and why
 * the current step matters. On phones the steps become a strip above the questions.
 */
export default function ProfileRail({ step, progress, disabled, onGo }: Props) {
  const answered = progress.reduce((n, p) => n + p.answered, 0)
  const questions = progress.reduce((n, p) => n + p.total, 0)

  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        p: { xs: 1, md: 2.5 },
        // widths only per breakpoint: a responsive border shorthand would reset the colour to black
        borderStyle: 'solid',
        borderWidth: 0,
        borderBottomWidth: { xs: 1, md: 0 },
        borderRightWidth: { xs: 0, md: 1 },
        borderColor: 'divider',
        bgcolor: white(0.28),
        ...t.applyStyles('dark', { bgcolor: white(0.015) }),
        borderTopLeftRadius: RADIUS.panel - 1,
        borderTopRightRadius: { xs: RADIUS.panel - 1, md: 0 },
        borderBottomLeftRadius: { md: RADIUS.panel - 1 },
      })}
    >
      {/* completeness: counts up when the answers change (a sample loaded), not when the page opens */}
      <RevealContext.Provider value={false}>
        <Stack direction="row" sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1.75, px: 0.5, pt: 0.5 }}>
          <RingGauge value={answered / questions} size={64} thickness={7} glow={false}>
            <Typography component="span" sx={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round((answered / questions) * 100)}
              <Box component="span" sx={{ fontSize: '0.625rem', fontWeight: 600, ml: '1px', color: 'text.secondary' }}>
                %
              </Box>
            </Typography>
          </RingGauge>
          <Box sx={{ minWidth: 0 }}>
            <Eyebrow>Profile completeness</Eyebrow>
            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {answered} of {questions} questions
            </Typography>
          </Box>
        </Stack>
      </RevealContext.Provider>

      <Box component="ol" aria-label="Questionnaire steps" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: { xs: 0.5, md: 0.75 }, gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', md: '1fr' } }}>
        {STEPS.map((s, i) => {
          const p = progress[i]
          const active = i === step
          const done = p.answered === p.total
          const Icon = s.icon
          return (
            <li key={s.title}>
              <ButtonBase
                onClick={() => onGo(i)}
                disabled={disabled}
                aria-current={active ? 'step' : undefined}
                sx={(t) => ({
                  position: 'relative',
                  isolation: 'isolate',
                  width: '100%',
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  textAlign: { xs: 'center', md: 'left' },
                  gap: { xs: 0.5, md: 1.5 },
                  px: { xs: 0.5, md: 1.25 },
                  py: { xs: 1, md: 1.25 },
                  borderRadius: `${RADIUS.inset}px`,
                  color: 'text.primary',
                  transition: 'background-color 150ms ease',
                  [HOVER]: { '&:hover:not([aria-current])': { bgcolor: ink(0.04), ...t.applyStyles('dark', { bgcolor: white(0.04) }) } },
                  [FORCED_COLORS]: active ? { border: '2px solid CanvasText' } : {},
                })}
              >
                {active && (
                  <Box
                    component={m.span}
                    layoutId="rail-active"
                    transition={{ layout: TRANSITION.spring }}
                    aria-hidden="true"
                    sx={(t) => ({
                      position: 'absolute',
                      inset: 0,
                      zIndex: -1,
                      borderRadius: `${RADIUS.inset}px`,
                      bgcolor: white(0.9),
                      border: `1px solid ${white(1)}`,
                      boxShadow: `0 1px 2px ${ink(0.06)}, 0 8px 22px -10px ${alpha('#312e81', 0.3)}`,
                      ...t.applyStyles('dark', { bgcolor: white(0.08), border: `1px solid ${white(0.1)}`, boxShadow: '0 8px 22px -10px rgba(0, 0, 0, 0.7)' }),
                    })}
                  />
                )}
                {/* step marker: the area's icon in its tone; a check once every question in it is answered */}
                <Box
                  aria-hidden="true"
                  sx={(t) => ({
                    position: 'relative',
                    flexShrink: 0,
                    width: { xs: 32, md: 36 },
                    height: { xs: 32, md: 36 },
                    borderRadius: '11px',
                    display: 'grid',
                    placeItems: 'center',
                    color: active ? '#fff' : toneColor(t, s.tone),
                    bgcolor: active ? TONES[s.tone].light : alpha(TONES[s.tone].light, 0.1),
                    boxShadow: active ? `0 6px 16px -6px ${alpha(TONES[s.tone].light, 0.7)}` : 'none',
                    transition: 'background-color 200ms ease, color 200ms ease, box-shadow 200ms ease',
                    ...t.applyStyles('dark', {
                      color: active ? '#0b1020' : toneColor(t, s.tone),
                      bgcolor: active ? TONES[s.tone].dark : alpha(TONES[s.tone].dark, 0.14),
                    }),
                    '& svg': { fontSize: 19 },
                  })}
                >
                  <Icon />
                  <AnimatePresence initial={false}>
                    {done && (
                      <Box
                        component={m.span}
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={TRANSITION.small}
                        sx={(t) => ({
                          position: 'absolute',
                          right: -5,
                          bottom: -5,
                          width: 17,
                          height: 17,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: t.palette.success.main,
                          color: '#fff',
                          border: `2px solid ${white(0.95)}`,
                          ...t.applyStyles('dark', { color: '#0b1020', border: '2px solid #11142a' }),
                          '& svg': { fontSize: 11 },
                        })}
                      >
                        <Check />
                      </Box>
                    )}
                  </AnimatePresence>
                </Box>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography component="span" sx={{ display: 'block', fontWeight: active ? 650 : 550, fontSize: { xs: '0.8125rem', md: '0.9375rem' }, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      {s.title}
                    </Box>
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                      {s.short}
                    </Box>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block', fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>
                    {p.answered} of {p.total}
                    <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                      {' '}
                      answered
                    </Box>
                  </Typography>
                </Box>
              </ButtonBase>
            </li>
          )
        })}
      </Box>

      {/* why this step matters: changes with the step */}
      <Box
        sx={(t) => ({
          display: { xs: 'none', md: 'block' },
          mt: 'auto',
          p: 1.75,
          borderRadius: `${RADIUS.inset}px`,
          border: `1px solid ${alpha(TONES.violet.light, 0.16)}`,
          backgroundImage: `linear-gradient(160deg, ${alpha(TONES.indigo.light, 0.08)}, ${alpha(TONES.violet.light, 0.04)})`,
          ...t.applyStyles('dark', {
            border: `1px solid ${alpha(TONES.violet.dark, 0.18)}`,
            backgroundImage: `linear-gradient(160deg, ${alpha(TONES.indigo.dark, 0.1)}, ${alpha(TONES.violet.dark, 0.05)})`,
          }),
        })}
      >
        <Stack direction="row" sx={(t) => ({ alignItems: 'center', gap: 0.75, mb: 0.75, color: toneColor(t, 'violet') })}>
          <TipsAndUpdates sx={{ fontSize: 16 }} aria-hidden="true" />
          <Typography variant="overline" component="p" sx={{ lineHeight: 1.4, color: 'inherit' }}>
            Why it matters
          </Typography>
        </Stack>
        <AnimatePresence mode="wait" initial={false}>
          <Typography key={step} component={m.p} variant="body2" color="text.secondary" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={TRANSITION.small}>
            {STEPS[step]?.tip}
          </Typography>
        </AnimatePresence>
      </Box>
    </Box>
  )
}
