import Add from '@mui/icons-material/Add'
import Check from '@mui/icons-material/Check'
import CloudQueue from '@mui/icons-material/CloudQueue'
import Code from '@mui/icons-material/Code'
import NewReleases from '@mui/icons-material/NewReleasesOutlined'
import Psychology from '@mui/icons-material/Psychology'
import Storage from '@mui/icons-material/Storage'
import Terminal from '@mui/icons-material/Terminal'
import Web from '@mui/icons-material/Web'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import type { TechBlock } from '../api/types'
import { IconTile, Pill } from '../design/primitives'
import { FORCED_COLORS, HOVER, RADIUS, TONES, insetFill, ink, white } from '../design/tokens'
import type { Tone } from '../design/tokens'
import type { TechState } from '../form'
import { DURATION, TRANSITION } from '../motion'
import { HAVE_LABEL, TECH_AREAS, WANT_LABEL } from '../questions'

const LOOK: Record<TechBlock, { icon: typeof Code; tone: Tone }> = {
  Language: { icon: Code, tone: 'indigo' },
  Database: { icon: Storage, tone: 'cyan' },
  Platform: { icon: CloudQueue, tone: 'emerald' },
  Webframe: { icon: Web, tone: 'rose' },
  DevEnvs: { icon: Terminal, tone: 'amber' },
  AIModels: { icon: Psychology, tone: 'violet' },
  SOTags: { icon: NewReleases, tone: 'indigo' },
}

/** How many of the area's most used technologies are offered as one-tap additions. */
const QUICK = 5

interface Props {
  block: TechBlock
  value: TechState
  choices: string[] // most popular first
  error?: string
  onChange: (value: TechState) => void
}

export default function TechArea({ block, value, choices, error, onChange }: Props) {
  const area = TECH_AREAS[block]
  const answered = value.none || value.have.length > 0 || value.want.length > 0
  const { icon: Icon, tone } = LOOK[block]
  // the check settles in when the visitor answers here, not every time the step opens
  const [touched, setTouched] = useState(false)
  const change = (v: TechState) => {
    setTouched(true)
    onChange(v)
  }
  // the most used technologies of the area that are not chosen yet, one tap from "used"
  const popular = value.none ? [] : choices.filter((c) => !value.have.includes(c) && !value.want.includes(c)).slice(0, QUICK)

  const picker = (kind: 'have' | 'want', label: string) => (
    <Autocomplete
      multiple
      size="small"
      disableCloseOnSelect
      filterSelectedOptions
      options={choices}
      value={value[kind]}
      disabled={value.none}
      onChange={(_, list) => change({ ...value, [kind]: list })}
      renderInput={(params) => <TextField {...params} label={label} placeholder={value[kind].length ? '' : 'Type to search'} error={!!error && kind === 'have'} />}
    />
  )

  return (
    // an inset surface inside the workspace glass; it takes on its tone once the area is answered
    <Box
      component="section"
      aria-label={area.title}
      sx={(t) => ({
        p: { xs: 1.75, sm: 2.25 },
        height: '100%',
        borderRadius: `${RADIUS.inset + 2}px`,
        border: '1px solid',
        borderColor: error ? t.palette.error.main : answered ? alpha(TONES[tone].light, 0.32) : t.palette.divider,
        ...insetFill(t, 'quiet'),
        backgroundImage: answered ? `linear-gradient(160deg, ${alpha(TONES[tone].light, 0.07)}, transparent 60%)` : 'none',
        boxShadow: answered ? `0 10px 30px -18px ${alpha(TONES[tone].light, 0.5)}` : 'none',
        transition: `border-color ${DURATION.hover}ms ease, box-shadow ${DURATION.medium}ms ease`,
        ...t.applyStyles('dark', {
          borderColor: error ? t.palette.error.main : answered ? alpha(TONES[tone].dark, 0.3) : t.palette.divider,
          backgroundImage: answered ? `linear-gradient(160deg, ${alpha(TONES[tone].dark, 0.08)}, transparent 60%)` : 'none',
          boxShadow: 'none',
        }),
      })}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1.5 }}>
          <IconTile tone={tone} size={38} glow={answered}>
            <Icon />
          </IconTile>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle1" component="h3" sx={{ lineHeight: 1.35 }}>
              {area.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {area.hint}
            </Typography>
            {/* under the hint, so the title keeps the card's full width on any screen */}
            <Pill
              tone={answered ? 'emerald' : 'neutral'}
              icon={answered ? <Check className={touched ? 'sp-pop' : undefined} /> : undefined}
              sx={{ fontVariantNumeric: 'tabular-nums', mt: 0.75 }}
            >
              {value.none ? 'None' : answered ? `${value.have.length} used · ${value.want.length} wanted` : 'Skipped'}
            </Pill>
          </Box>
        </Stack>
        {picker('have', HAVE_LABEL)}
        {/* one-tap additions from the area's most used technologies */}
        {popular.length > 0 && (
          // phones offer the top three (the label is the first span), so the area stays short
          <Stack
            direction="row"
            component="div"
            role="group"
            aria-label={`Popular ${area.title.toLowerCase()}`}
            sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: '-4px !important', '& > span:nth-of-type(n+5)': { display: { xs: 'none', sm: 'inline-flex' } } }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.25 }}>
              Popular:
            </Typography>
            <AnimatePresence initial={false} mode="popLayout">
              {popular.map((c) => (
                <m.span key={c} layout="position" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={TRANSITION.small} style={{ display: 'inline-flex' }}>
                  <ButtonBase
                    onClick={() => change({ ...value, have: [...value.have, c] })}
                    aria-label={`Add ${c} to used`}
                    sx={(t) => ({
                      gap: 0.25,
                      pl: 0.75,
                      pr: 1.125,
                      height: 28,
                      borderRadius: 999,
                      fontSize: '0.8125rem',
                      fontWeight: 550,
                      color: 'text.primary',
                      border: `1px dashed ${ink(0.2)}`,
                      bgcolor: white(0.5),
                      transition: 'background-color 150ms ease, border-color 150ms ease, transform 140ms ease',
                      '&:active': { transform: 'scale(0.95)' },
                      '& svg': { fontSize: 15, color: TONES[tone].light },
                      [HOVER]: { '&:hover': { borderStyle: 'solid', borderColor: alpha(TONES[tone].light, 0.5), bgcolor: alpha(TONES[tone].light, 0.08) } },
                      ...t.applyStyles('dark', {
                        border: `1px dashed ${white(0.2)}`,
                        bgcolor: white(0.03),
                        '& svg': { fontSize: 15, color: TONES[tone].dark },
                        [HOVER]: { '&:hover': { borderStyle: 'solid', borderColor: alpha(TONES[tone].dark, 0.5), bgcolor: alpha(TONES[tone].dark, 0.1) } },
                      }),
                      [FORCED_COLORS]: { border: '1px solid ButtonText' },
                    })}
                  >
                    <Add aria-hidden="true" />
                    {c}
                  </ButtonBase>
                </m.span>
              ))}
            </AnimatePresence>
          </Stack>
        )}
        {picker('want', WANT_LABEL)}
        {area.hasNone && (
          <FormControlLabel
            control={<Checkbox size="small" checked={value.none} onChange={(e) => change(e.target.checked ? { have: [], want: [], none: true } : { ...value, none: false })} />}
            label={<Typography variant="body2">I don’t use any of these</Typography>}
          />
        )}
        {error && (
          <FormHelperText error className="sp-fade">
            {error}
          </FormHelperText>
        )}
      </Stack>
    </Box>
  )
}
