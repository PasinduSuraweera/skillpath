import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import { m, useMotionValueEvent, useScroll } from 'motion/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FORCED_COLORS, HOVER, RADIUS, glass, glassEdge, ink, mergeStyles, shadow, white } from '../../design/tokens'
import { TRANSITION } from '../../motion'
import { scrollToElement } from '../../scroll'

/** The dashboard's sections, in page order (ids set in Dashboard). */
const SECTIONS = [
  { id: 'overview', label: 'Best match' },
  { id: 'compare', label: 'Compare' },
  { id: 'role-insights', label: 'In detail' },
  { id: 'landscape', label: 'Landscape' },
  { id: 'behind', label: 'Behind the result' },
  { id: 'explorations', label: 'Explorations' },
]

/**
 * Where you are on the results page, on wide screens: a slim glass rail at the right edge with
 * one mark per section. The mark of the section under the reading line (40% down the window)
 * stretches and takes the accent, sliding from section to section as the page scrolls; at the
 * very bottom it is the last section. Hovering or focusing the rail shows the section names,
 * and a press glides there. Hidden below 1360 px, where it would sit on the content, and in print.
 *
 * Rendered into <body>: the dashboard's transformed ancestors would otherwise pin it to them
 * instead of to the window.
 */
export default function SectionRail() {
  const [active, setActive] = useState(SECTIONS[0].id)

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting)
        if (hit) setActive(hit.target.id)
      },
      // a thin band around the reading line: whichever section crosses it is "here"
      { rootMargin: '-40% 0px -58% 0px' },
    )
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [])

  // the last section is often too short to reach the reading line: the bottom of the page is it
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', (y) => {
    if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) setActive(SECTIONS[SECTIONS.length - 1].id)
  })

  return createPortal(
    <Box
      component="nav"
      aria-label="Sections of your results"
      className="no-print"
      sx={(t) => ({
        position: 'fixed',
        right: 20,
        top: '50%',
        mt: '-120px',
        zIndex: t.zIndex.appBar - 1,
        display: 'none',
        '@media (min-width: 1360px)': { display: 'block' },
        // names appear beside the marks while the rail is hovered or has focus
        '&:hover .sp-rail-label, &:focus-within .sp-rail-label': { opacity: 1, transform: 'none' },
      })}
    >
      {/* glass: it fades in itself (a fading wrapper would switch its blur off, see SurfaceMotion) */}
      <Box
        component={m.ol}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0, transition: { ...TRANSITION.enter, delay: 0.6 } }}
        sx={(t) =>
          mergeStyles(glass(t, 'chrome'), glassEdge(t), shadow(t, 'low'), {
            listStyle: 'none',
            m: 0,
            p: 0.75,
            borderRadius: `${RADIUS.pill}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
          })
        }
      >
        {SECTIONS.map((s) => {
          const on = s.id === active
          return (
            <li key={s.id} style={{ position: 'relative' }}>
              <ButtonBase
                aria-current={on ? 'true' : undefined}
                onClick={() => {
                  const el = document.getElementById(s.id)
                  if (el) scrollToElement(el, true)
                }}
                sx={(t) => ({
                  width: 22,
                  height: 26,
                  borderRadius: `${RADIUS.pill}px`,
                  display: 'grid',
                  placeItems: 'center',
                  [HOVER]: { '&:hover .sp-rail-dot': { bgcolor: ink(0.4), ...t.applyStyles('dark', { bgcolor: white(0.5) }) } },
                })}
              >
                {/* the mark: a dot; the current section's mark is a longer bar that slides between them */}
                <Box
                  className="sp-rail-dot"
                  aria-hidden="true"
                  sx={(t) => ({
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    bgcolor: ink(0.2),
                    transition: 'background-color 150ms ease',
                    ...t.applyStyles('dark', { bgcolor: white(0.25) }),
                    [FORCED_COLORS]: { bgcolor: 'CanvasText' },
                  })}
                />
                {on && (
                  <Box
                    component={m.span}
                    layoutId="section-rail-active"
                    transition={{ layout: TRANSITION.spring }}
                    aria-hidden="true"
                    sx={(t) => ({
                      position: 'absolute',
                      left: '50%',
                      top: 3,
                      bottom: 3,
                      width: 6,
                      ml: '-3px',
                      borderRadius: 999,
                      backgroundImage: 'linear-gradient(180deg, #4f46e5, #7c3aed)',
                      ...t.applyStyles('dark', { backgroundImage: 'linear-gradient(180deg, #a5b4fc, #c4b5fd)' }),
                      [FORCED_COLORS]: { backgroundImage: 'none', bgcolor: 'Highlight' },
                    })}
                  />
                )}
                {/* the section's name, to the left of the rail: nearly opaque rather than blurred,
                    since glass inside the rail's glass could only blur the rail itself */}
                <Box
                  component="span"
                  className="sp-rail-label"
                  sx={(t) =>
                    mergeStyles(glassEdge(t), shadow(t, 'low'), {
                      bgcolor: white(0.94),
                      ...t.applyStyles('dark', { bgcolor: 'rgba(24, 28, 48, 0.94)' }),
                      position: 'absolute',
                      right: 'calc(100% + 14px)',
                      top: '50%',
                      mt: '-13px',
                      height: 26,
                      px: 1.25,
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: `${RADIUS.pill}px`,
                      whiteSpace: 'nowrap',
                      fontSize: '0.75rem',
                      fontWeight: on ? 650 : 500,
                      color: on ? 'text.primary' : 'text.secondary',
                      opacity: 0,
                      transform: 'translateX(6px)',
                      transition: 'opacity 180ms ease, transform 220ms cubic-bezier(0.23, 1, 0.32, 1)',
                      pointerEvents: 'none',
                    })
                  }
                >
                  {s.label}
                </Box>
              </ButtonBase>
            </li>
          )
        })}
      </Box>
    </Box>,
    document.body,
  )
}
