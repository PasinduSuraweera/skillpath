import Box from '@mui/material/Box'
import { useCountUp } from '../motion'

/**
 * A number that counts up to `value` when it first appears and moves to each new
 * value after that (see useCountUp). While it moves, its box is sized by the final
 * text so nothing beside it shifts, and screen readers get only the final value.
 * Once settled it is plain text again. `from` starts the first count somewhere other than 0.
 */
export default function CountUp({ value, format, from }: { value: number; format: (v: number) => string; from?: number }) {
  const { value: shown, moving } = useCountUp(value, from)
  if (!moving) return <>{format(value)}</>
  return (
    <Box component="span" sx={{ display: 'inline-grid', '& > span': { gridArea: '1 / 1', justifySelf: 'end' } }}>
      <span aria-hidden="true" style={{ visibility: 'hidden' }}>
        {format(value)}
      </span>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sp-sr-only">{format(value)}</span>
    </Box>
  )
}
