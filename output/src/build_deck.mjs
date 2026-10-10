// Builds the SkillPath final presentation (IT3051 mini project, group KND_12).
//
//   cd output/src && npm install && node build_deck.mjs
//
// Writes, next to this folder:
//   ../SkillPath_Final_Presentation.pptx   13 slides, editable text, shapes and native charts
//   ../slide_outline.md                    titles, key messages, member allocation
//   ../speaker_notes.md                    the same notes that are inside the .pptx
//
// Images come from ../assets (see capture_screens.mjs and prepare_assets.py).
// Every number on the slides is from the final report and the result files in reports/.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pptxgenModule from 'pptxgenjs'
import { MEMBERS, SLIDES } from './notes.mjs'

const PptxGenJS = pptxgenModule.default ?? pptxgenModule
const OUT = fileURLToPath(new URL('../', import.meta.url))
const asset = (name) => fileURLToPath(new URL(`../assets/${name}`, import.meta.url))

// --- design tokens ---------------------------------------------------------
const NAVY = '0B1B3A'
const NAVY2 = '13294F'
const BLUE = '2563EB'
const BLUE_SOFT = '9DC1FF'
const TINT = 'EFF5FF'
const TINT_LINE = 'D2E2FD'
const INK = '0F172A'
const SLATE = '334155'
const MUTED = '64748B'
const LINE = 'DCE3EC'
const SOFT = 'F6F8FB'
const WHITE = 'FFFFFF'
const AMBER = 'C2410C'
const AMBER_TINT = 'FFF4EC'
const AMBER_LINE = 'FBD5B8'
const GREEN = '047857'
const GREEN_TINT = 'ECFDF5'
const GREEN_LINE = 'B7E9D2'
const FONT = 'Calibri'

const W = 13.333
const LEFT = 0.6
const CW = W - 2 * LEFT // content width

const pptx = new PptxGenJS()
pptx.layout = 'LAYOUT_WIDE'
pptx.author = 'Group KND_12'
pptx.company = 'Sri Lanka Institute of Information Technology (SLIIT)'
pptx.title = 'SkillPath: AI-Aware Developer Career Recommendation System'
pptx.subject = 'IT3051 – Fundamentals of Data Mining, Mini Project'
pptx.theme = { headFontFace: FONT, bodyFontFace: FONT }

pptx.defineSlideMaster({
  title: 'CONTENT',
  background: { color: WHITE },
  objects: [
    { rect: { x: LEFT, y: 7.0, w: CW, h: 0.012, fill: { color: LINE } } },
    { rect: { x: LEFT, y: 7.13, w: 0.14, h: 0.14, fill: { color: BLUE } } },
    {
      text: {
        text: 'SkillPath',
        options: { x: LEFT + 0.22, y: 7.07, w: 0.9, h: 0.26, fontFace: FONT, fontSize: 10.5, bold: true, color: NAVY, margin: 0, valign: 'middle' },
      },
    },
    {
      text: {
        text: 'IT3051 – Fundamentals of Data Mining  ·  Group KND_12',
        options: { x: LEFT + 1.0, y: 7.07, w: 6, h: 0.26, fontFace: FONT, fontSize: 10, color: MUTED, margin: 0, valign: 'middle' },
      },
    },
  ],
  slideNumber: { x: W - LEFT - 0.6, y: 7.07, w: 0.6, h: 0.26, fontFace: FONT, fontSize: 10.5, color: MUTED, align: 'right', bold: true },
})

// --- helpers ---------------------------------------------------------------
const shadow = () => ({ type: 'outer', color: '0F172A', opacity: 0.1, blur: 9, offset: 2, angle: 90 })

/** Plain text box with the deck's defaults. `text` is a string or an array of runs. */
function T(slide, text, o) {
  slide.addText(text, { fontFace: FONT, color: INK, margin: 0, valign: 'top', ...o })
}

/** A run inside a text box. */
const run = (text, options = {}) => ({ text, options })

function card(slide, x, y, w, h, o = {}) {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x,
    y,
    w,
    h,
    fill: { color: o.fill ?? WHITE },
    line: { color: o.line ?? LINE, width: 0.75 },
    rectRadius: o.r ?? 0.09,
    ...(o.shadow ? { shadow: shadow() } : {}),
  })
}

function bullets(slide, items, o) {
  const { gap = 5, bulletColor = BLUE, ...rest } = o
  T(
    slide,
    items.map((t, i) => ({
      text: t,
      options: { bullet: { code: '2022', indent: 11, color: bulletColor }, breakLine: i < items.length - 1, paraSpaceAfter: gap },
    })),
    { fontSize: 11.5, color: SLATE, ...rest },
  )
}

function badge(slide, label, x, y, d = 0.38, o = {}) {
  T(slide, label, {
    shape: pptx.shapes.OVAL,
    x,
    y,
    w: d,
    h: d,
    fill: { color: o.fill ?? BLUE },
    color: o.color ?? WHITE,
    bold: true,
    fontSize: o.fontSize ?? 12,
    align: 'center',
    valign: 'middle',
  })
}

function arrow(slide, x, y, w, o = {}) {
  slide.addShape(pptx.shapes.LINE, { x, y, w, h: 0, line: { color: o.color ?? MUTED, width: o.width ?? 1.5, endArrowType: 'triangle' } })
}

/** Screenshot or figure in a thin frame. */
function framed(slide, name, x, y, w, h, o = {}) {
  slide.addShape(pptx.shapes.RECTANGLE, { x, y, w, h, fill: { color: WHITE }, line: { color: o.line ?? LINE, width: 0.75 }, shadow: shadow() })
  slide.addImage({ path: asset(name), x: x + 0.03, y: y + 0.03, w: w - 0.06, h: h - 0.06 })
}

/** Section kicker, slide title and the presenter tag. */
function header(slide, n) {
  const s = SLIDES[n - 1]
  const m = MEMBERS[s.member]
  slide.addShape(pptx.shapes.RECTANGLE, { x: LEFT, y: 0.5, w: 0.07, h: 0.78, fill: { color: BLUE } })
  T(slide, m.part.toUpperCase(), { x: LEFT + 0.22, y: 0.47, w: 8, h: 0.28, fontSize: 11, bold: true, color: BLUE, charSpacing: 2 })
  T(slide, s.title, { x: LEFT + 0.22, y: 0.74, w: 9.0, h: 0.56, fontSize: 28, bold: true, color: NAVY, valign: 'middle' })
  T(slide, [run(`Member ${s.member + 1}`, { bold: true, color: BLUE }), run(`   ${m.name}`, { color: SLATE, bold: true })], {
    shape: pptx.shapes.ROUNDED_RECTANGLE,
    x: W - LEFT - 2.95,
    y: 0.6,
    w: 2.95,
    h: 0.4,
    rectRadius: 0.2,
    fill: { color: TINT },
    line: { color: TINT_LINE, width: 0.75 },
    fontSize: 11,
    align: 'center',
    valign: 'middle',
  })
  slide.addNotes(s.notes.join('\n\n'))
}

const content = (n) => {
  const slide = pptx.addSlide({ masterName: 'CONTENT' })
  header(slide, n)
  return slide
}

const label = (slide, text, x, y, w, o = {}) =>
  T(slide, text.toUpperCase(), { x, y, w, h: 0.26, fontSize: 10.5, bold: true, color: o.color ?? MUTED, charSpacing: 1.5, valign: 'middle' })

// =============================================================================
// Slide 1: title
// =============================================================================
{
  const s = pptx.addSlide()
  s.background = { color: NAVY }
  s.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 0.16, h: 7.5, fill: { color: BLUE } })

  T(s, 'IT3051 – Fundamentals of Data Mining   ·   Mini Project   ·   Group KND_12', {
    x: 0.75, y: 0.7, w: 6.3, h: 0.3, fontSize: 12, bold: true, color: BLUE_SOFT, charSpacing: 0.5, valign: 'middle',
  })
  T(s, 'SkillPath', { x: 0.75, y: 1.2, w: 6.3, h: 1.15, fontSize: 68, bold: true, color: WHITE, valign: 'middle' })
  T(s, 'AI-Aware Developer Career Recommendation System', {
    x: 0.75, y: 2.42, w: 6.2, h: 0.9, fontSize: 24, bold: true, color: BLUE_SOFT, lineSpacingMultiple: 0.95,
  })
  T(
    s,
    'Recommends developer job roles from a person’s skills, experience and AI usage, and explains each one with evidence on AI exposure, typical pay and skill gaps.',
    { x: 0.75, y: 3.45, w: 5.9, h: 0.75, fontSize: 13.5, color: 'CBD5E1', lineSpacingMultiple: 1.1 },
  )

  T(s, 'PRESENTED BY', { x: 0.75, y: 4.42, w: 3, h: 0.25, fontSize: 10.5, bold: true, color: BLUE_SOFT, charSpacing: 2 })
  MEMBERS.forEach((m, i) => {
    const x = 0.75 + (i % 2) * 3.05
    const y = 4.76 + Math.floor(i / 2) * 0.76
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.9, h: 0.64, rectRadius: 0.08, fill: { color: NAVY2 }, line: { color: '24427A', width: 0.75 } })
    T(s, m.name, { x: x + 0.18, y: y + 0.08, w: 2.6, h: 0.27, fontSize: 13.5, bold: true, color: WHITE, valign: 'middle' })
    T(s, m.reg, { x: x + 0.18, y: y + 0.35, w: 2.6, h: 0.22, fontSize: 10.5, color: BLUE_SOFT, valign: 'middle' })
  })
  T(s, 'Sri Lanka Institute of Information Technology (SLIIT)', {
    x: 0.75, y: 6.55, w: 6.2, h: 0.3, fontSize: 12.5, color: 'CBD5E1', valign: 'middle',
  })

  // the real start page of the application
  const ix = 7.35, iy = 1.05, iw = 5.4, ih = iw / (1800 / 1157)
  s.addShape(pptx.shapes.RECTANGLE, { x: ix - 0.05, y: iy - 0.05, w: iw + 0.1, h: ih + 0.1, fill: { color: WHITE }, line: { color: '24427A', width: 0.75 } })
  s.addImage({ path: asset('shot-start.jpg'), x: ix, y: iy, w: iw, h: ih })
  T(s, 'The SkillPath web application (start page)', { x: ix, y: iy + ih + 0.1, w: iw, h: 0.24, fontSize: 10.5, italic: true, color: BLUE_SOFT })

  const stats = [
    ['49,123', 'survey responses'],
    ['20 / 12', 'job roles / families'],
    ['479', 'model features'],
    ['83.9%', 'top-3 role accuracy'],
  ]
  const tw = (iw - 3 * 0.12) / 4
  stats.forEach(([big, small], i) => {
    const x = ix + i * (tw + 0.12)
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x, y: 5.28, w: tw, h: 1.0, rectRadius: 0.08, fill: { color: NAVY2 }, line: { color: '24427A', width: 0.75 } })
    T(s, big, { x, y: 5.38, w: tw, h: 0.45, fontSize: 21, bold: true, color: WHITE, align: 'center', valign: 'middle' })
    T(s, small, { x: x + 0.05, y: 5.84, w: tw - 0.1, h: 0.34, fontSize: 10, color: BLUE_SOFT, align: 'center' })
  })
  T(s, 'Stack Overflow Annual Developer Survey 2025 (ODbL v1.0)', { x: ix, y: 6.55, w: iw, h: 0.3, fontSize: 10.5, color: '94A3B8', align: 'right', valign: 'middle' })
  s.addNotes(SLIDES[0].notes.join('\n\n'))
}

// =============================================================================
// Slide 2: problem statement and motivation
// =============================================================================
{
  const s = content(2)
  const lw = 5.95
  label(s, 'Why choosing a path is hard', LEFT, 1.55, lw)
  const pains = [
    ['Many specialised roles', 'Back-end, front-end, mobile, data, ML, DevOps, cloud, security, QA: each has its own technology stack.'],
    ['Guidance is generic', 'Articles, role descriptions and job adverts are not matched to a person’s actual skill profile.'],
    ['AI is changing every role', 'Students ask how much of a role’s everyday work AI already does. Advice that ignores this is incomplete.'],
  ]
  pains.forEach(([title, body], i) => {
    const y = 1.9 + i * 1.16
    card(s, LEFT, y, lw, 1.04, { fill: SOFT })
    badge(s, String(i + 1), LEFT + 0.2, y + 0.2, 0.42, { fill: NAVY })
    T(s, title, { x: LEFT + 0.8, y: y + 0.14, w: lw - 1.0, h: 0.3, fontSize: 15, bold: true, color: NAVY, valign: 'middle' })
    T(s, body, { x: LEFT + 0.8, y: y + 0.47, w: lw - 1.0, h: 0.5, fontSize: 11.5, color: SLATE, lineSpacingMultiple: 1.05 })
  })

  const rx = LEFT + lw + 0.28, rw = CW - lw - 0.28
  label(s, 'What a useful answer must show', rx, 1.55, rw, { color: BLUE })
  const needs = [
    ['AI', 'AI exposure', 'The share of a role’s everyday tasks already done with AI, and whether people in the role see AI as a threat.'],
    ['$', 'Salary evidence', 'What people in the role earn in comparable circumstances: same country or region, same experience band.'],
    ['+', 'Skill gaps', 'The specific technologies that separate a person’s current skills from a target role.'],
  ]
  needs.forEach(([icon, title, body], i) => {
    const y = 1.9 + i * 1.16
    card(s, rx, y, rw, 1.04, { fill: TINT, line: TINT_LINE })
    badge(s, icon, rx + 0.2, y + 0.2, 0.42, { fill: BLUE, fontSize: icon.length > 1 ? 11 : 15 })
    T(s, title, { x: rx + 0.8, y: y + 0.14, w: rw - 1.0, h: 0.3, fontSize: 15, bold: true, color: BLUE, valign: 'middle' })
    T(s, body, { x: rx + 0.8, y: y + 0.47, w: rw - 1.0, h: 0.5, fontSize: 11.5, color: SLATE, lineSpacingMultiple: 1.05 })
  })

  const by = 5.5
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: LEFT, y: by, w: CW, h: 1.28, rectRadius: 0.09, fill: { color: NAVY } })
  T(s, 'THE DATA MINING PROBLEM', { x: LEFT + 0.3, y: by + 0.16, w: 5, h: 0.25, fontSize: 10.5, bold: true, color: BLUE_SOFT, charSpacing: 2 })
  T(
    s,
    [
      run('Given a person’s self-reported technologies, experience, education, location and AI usage, '),
      run('predict which developer job roles their profile most resembles', { bold: true, color: WHITE }),
      run(', and support each suggestion with evidence on AI exposure, salary and skill gaps from the same survey.'),
    ],
    { x: LEFT + 0.3, y: by + 0.45, w: CW - 0.6, h: 0.72, fontSize: 14.5, color: 'DBE7FB', lineSpacingMultiple: 1.08 },
  )
}

// =============================================================================
// Slide 3: aim, objectives and scope
// =============================================================================
{
  const s = content(3)
  card(s, LEFT, 1.52, CW, 0.82, { fill: TINT, line: TINT_LINE })
  T(s, 'AIM', { x: LEFT + 0.25, y: 1.52, w: 0.7, h: 0.82, fontSize: 12, bold: true, color: BLUE, charSpacing: 2, valign: 'middle' })
  T(
    s,
    'Design, build and evaluate an AI-aware developer job role and career path recommendation system by mining the Stack Overflow Developer Survey 2025.',
    { x: LEFT + 1.0, y: 1.52, w: CW - 1.25, h: 0.82, fontSize: 14.5, bold: true, color: NAVY, valign: 'middle', lineSpacingMultiple: 1.05 },
  )

  const lw = 5.75
  label(s, 'Six objectives', LEFT, 2.55, lw)
  const objectives = [
    ['Understand the data', 'Explore the survey, assess its quality, find the relevant attributes'],
    ['Prepare it without leakage', 'A reproducible pipeline that is reused unchanged at prediction time'],
    ['Compare algorithms', 'At least four classifiers, with validation and metrics fit for imbalance'],
    ['Optimise, select, evaluate', 'A selection rule fixed in advance; one evaluation on held-out data'],
    ['Derive role insights', 'AI Exposure Index, perceived AI threat, salary benchmarks, skill gap'],
    ['Deploy and test', 'A web API and an easy-to-use web app, verified by systematic testing'],
  ]
  objectives.forEach(([title, body], i) => {
    const y = 2.9 + i * 0.65
    badge(s, String(i + 1), LEFT, y + 0.06, 0.4, { fill: i < 2 ? NAVY : i < 4 ? '1D4FB8' : BLUE })
    T(s, title, { x: LEFT + 0.55, y, w: lw - 0.55, h: 0.27, fontSize: 13.5, bold: true, color: NAVY, valign: 'middle' })
    T(s, body, { x: LEFT + 0.55, y: y + 0.27, w: lw - 0.55, h: 0.25, fontSize: 11, color: MUTED, valign: 'middle' })
  })

  const rx = LEFT + lw + 0.3, rw = CW - lw - 0.3
  label(s, 'Scope and intended use', rx, 2.55, rw)
  const tiles = [
    ['20', 'skill-defined job roles'],
    ['12', 'role families'],
  ]
  tiles.forEach(([big, small], i) => {
    const x = rx + i * 1.62
    card(s, x, 2.9, 1.5, 0.92, { fill: NAVY, line: NAVY })
    T(s, big, { x, y: 2.94, w: 1.5, h: 0.48, fontSize: 26, bold: true, color: WHITE, align: 'center', valign: 'middle' })
    T(s, small, { x: x + 0.05, y: 3.42, w: 1.4, h: 0.32, fontSize: 9.5, color: BLUE_SOFT, align: 'center' })
  })
  card(s, rx + 3.24, 2.9, rw - 3.24, 0.92, { fill: SOFT })
  T(s, 'TARGET USERS', { x: rx + 3.4, y: 2.98, w: rw - 3.5, h: 0.24, fontSize: 9.5, bold: true, color: BLUE, charSpacing: 1.5, valign: 'middle' })
  T(s, 'Students and early-career developers', { x: rx + 3.4, y: 3.22, w: rw - 3.55, h: 0.52, fontSize: 13, bold: true, color: NAVY, lineSpacingMultiple: 0.98 })

  const cw = (rw - 0.14) / 2
  const scope = [
    {
      title: 'In scope', fill: GREEN_TINT, line: GREEN_LINE, color: GREEN,
      items: ['Top-3 roles and families, with probabilities', 'AI exposure, AI threat, salary and skill gap per role', 'Web API and web app for a single user', 'Unit, integration and system testing'],
    },
    {
      title: 'Out of scope', fill: AMBER_TINT, line: AMBER_LINE, color: AMBER,
      items: ['Management, executive and non-technical roles', 'Age, gender or other sensitive attributes as inputs', 'Hiring, screening or salary-setting decisions', 'Storing or logging user input; large-scale hosting'],
    },
  ]
  scope.forEach((c, i) => {
    const x = rx + i * (cw + 0.14)
    card(s, x, 3.98, cw, 2.0, { fill: c.fill, line: c.line })
    T(s, c.title.toUpperCase(), { x: x + 0.2, y: 4.05, w: cw - 0.4, h: 0.28, fontSize: 11, bold: true, color: c.color, charSpacing: 1.5, valign: 'middle' })
    bullets(s, c.items, { x: x + 0.2, y: 4.36, w: cw - 0.36, h: 1.58, fontSize: 10.5, bulletColor: c.color, gap: 3 })
  })
  card(s, rx, 6.12, rw, 0.72, { fill: SOFT })
  T(
    s,
    [
      run('Intended use:  ', { bold: true, color: NAVY }),
      run('suggestions for learning and career planning. A low score means a profile is unlike that role’s survey respondents, not that the person cannot do the job.'),
    ],
    { x: rx + 0.2, y: 6.12, w: rw - 0.4, h: 0.72, fontSize: 10.5, color: SLATE, valign: 'middle', lineSpacingMultiple: 1.03 },
  )
}

// =============================================================================
// Slide 4: dataset and EDA
// =============================================================================
{
  const s = content(4)
  // dataset
  const aw = 3.6
  card(s, LEFT, 1.52, aw, 4.14, { fill: SOFT })
  T(s, 'Stack Overflow Annual Developer Survey 2025', { x: LEFT + 0.2, y: 1.62, w: aw - 0.4, h: 0.5, fontSize: 13, bold: true, color: NAVY, lineSpacingMultiple: 0.98 })
  ;[
    ['49,123', 'responses'],
    ['170', 'attributes'],
  ].forEach(([big, small], i) => {
    const x = LEFT + 0.2 + i * 1.65
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x, y: 2.2, w: 1.55, h: 0.82, rectRadius: 0.07, fill: { color: NAVY } })
    T(s, big, { x, y: 2.23, w: 1.55, h: 0.46, fontSize: 22, bold: true, color: WHITE, align: 'center', valign: 'middle' })
    T(s, small, { x, y: 2.68, w: 1.55, h: 0.26, fontSize: 10, color: BLUE_SOFT, align: 'center', valign: 'middle' })
  })
  T(s, 'ATTRIBUTES USED', { x: LEFT + 0.2, y: 3.14, w: aw - 0.4, h: 0.24, fontSize: 9.5, bold: true, color: BLUE, charSpacing: 1.5, valign: 'middle' })
  const attrs = [
    ['Job role', 'class label (20 roles kept)'],
    ['Technologies', '7 areas, used and wanted'],
    ['Experience, education', 'years coding / working'],
    ['Location', '177 countries → 13 regions'],
    ['AI usage', 'attitudes + 13-task matrix'],
    ['Pay', 'benchmark only, never an input'],
  ]
  T(
    s,
    attrs.flatMap(([a, b], i) => [run(`${a}: `, { bold: true, color: NAVY }), run(b, { color: SLATE, breakLine: i < attrs.length - 1 })]),
    { x: LEFT + 0.2, y: 3.4, w: aw - 0.35, h: 1.62, fontSize: 10.5, paraSpaceAfter: 5.5 },
  )
  s.addShape(pptx.shapes.LINE, { x: LEFT + 0.2, y: 5.08, w: aw - 0.4, h: 0, line: { color: LINE, width: 0.75 } })
  T(s, [run('Licence: ', { bold: true, color: NAVY }), run('ODbL v1.0. The app shows the attribution on every result.')], {
    x: LEFT + 0.2, y: 5.12, w: aw - 0.35, h: 0.46, fontSize: 10, color: SLATE, valign: 'middle', lineSpacingMultiple: 1.0,
  })

  // class imbalance chart (training split, data/processed/train.parquet)
  const bx = LEFT + aw + 0.18, bw = 4.75
  card(s, bx, 1.52, bw, 4.14)
  T(s, 'Class imbalance: 20 job roles, training split', { x: bx + 0.2, y: 1.6, w: bw - 0.4, h: 0.28, fontSize: 12.5, bold: true, color: NAVY, valign: 'middle' })
  const roles = [
    ['Full-stack Developer', 7279], ['Back-end Developer', 3750], ['Desktop / Enterprise Developer', 1187], ['Front-end Developer', 1120],
    ['Embedded Developer', 771], ['Mobile Developer', 739], ['DevOps Engineer', 645], ['Data Engineer', 451], ['AI / ML Engineer', 349],
    ['Data Scientist', 349], ['System Administrator', 272], ['Game / Graphics Developer', 262], ['Cloud Infrastructure Engineer', 238],
    ['Cybersecurity Specialist', 220], ['QA / Test Engineer', 199], ['Data / Business Analyst', 186], ['Applied Scientist', 179],
    ['AI Application Developer', 116], ['Database Administrator / Engineer', 98], ['UX / UI Designer', 47],
  ]
  s.addChart(pptx.charts.BAR, [{ name: 'Training respondents', labels: roles.map((r) => r[0]), values: roles.map((r) => r[1]) }], {
    x: bx + 0.08, y: 1.88, w: bw - 0.16, h: 3.46,
    barDir: 'bar', catAxisOrientation: 'maxMin', barGapWidthPct: 28, chartColors: [BLUE],
    catAxisLabelFontFace: FONT, catAxisLabelFontSize: 8, catAxisLabelColor: SLATE, catAxisLineShow: false,
    valAxisHidden: true, valAxisLineShow: false, valGridLine: { style: 'none' }, valAxisMaxVal: 8600,
    showValue: true, dataLabelFontFace: FONT, dataLabelFontSize: 8, dataLabelColor: SLATE, dataLabelFormatCode: '#,##0', dataLabelPosition: 'outEnd',
    showLegend: false,
  })
  T(s, [run('Full-stack is 39.4%', { bold: true, color: NAVY }), run(' of 18,457; UX / UI Designer has 47. Ratio about '), run('155:1', { bold: true, color: AMBER })], {
    x: bx + 0.2, y: 5.32, w: bw - 0.4, h: 0.28, fontSize: 10.5, color: SLATE, valign: 'middle',
  })

  // role similarity heatmap (reports/figures/02_jobrole_similarity.png)
  const cx = bx + bw + 0.18, cw = CW - aw - bw - 0.36
  card(s, cx, 1.52, cw, 4.14)
  T(s, 'Similarity of role technology profiles', { x: cx + 0.15, y: 1.6, w: cw - 0.3, h: 0.28, fontSize: 12.5, bold: true, color: NAVY, valign: 'middle' })
  const iw = cw - 0.3, ih = iw / (1500 / 1163)
  s.addImage({ path: asset('fig-similarity.png'), x: cx + 0.15, y: 1.93, w: iw, h: ih })
  T(
    s,
    [
      run('Cosine similarity: ', { color: SLATE }),
      run('0.99', { bold: true, color: AMBER }),
      run(' Cloud Infrastructure vs DevOps; ', { color: SLATE }),
      run('0.97', { bold: true, color: AMBER }),
      run(' Data Engineer vs Data Scientist', { color: SLATE }),
    ],
    { x: cx + 0.15, y: 1.93 + ih + 0.06, w: cw - 0.3, h: 0.56, fontSize: 10.5, lineSpacingMultiple: 1.02 },
  )
  T(s, 'No algorithm can fully separate roles that use the same tools.', { x: cx + 0.15, y: 1.93 + ih + 0.66, w: cw - 0.3, h: 0.42, fontSize: 10, italic: true, color: MUTED, lineSpacingMultiple: 1.0 })

  // finding -> consequence
  const findings = [
    ['155:1 imbalance', 'Macro-F1 as the primary metric; stratified split and folds'],
    ['Near-identical roles', 'Recommend three roles plus family totals, not one answer'],
    ['Distinctive technologies', 'Swift is 9.7× as common in Mobile: multi-hot flags, lift for skill gap'],
    ['AI use differs by role', '19.1 of 100 tasks now, 39.0 expected; 14.4% feel threatened'],
  ]
  const fw = (CW - 3 * 0.14) / 4
  findings.forEach(([title, body], i) => {
    const x = LEFT + i * (fw + 0.14)
    card(s, x, 5.82, fw, 1.02, { fill: TINT, line: TINT_LINE })
    T(s, [run('FINDING  ', { color: BLUE, bold: true, fontSize: 9, charSpacing: 1 }), run(title, { bold: true, color: NAVY })], {
      x: x + 0.16, y: 5.88, w: fw - 0.3, h: 0.3, fontSize: 12, valign: 'middle',
    })
    T(s, [run('→ ', { bold: true, color: BLUE }), run(body)], { x: x + 0.16, y: 6.2, w: fw - 0.3, h: 0.58, fontSize: 10.5, color: SLATE, lineSpacingMultiple: 1.03 })
  })
}

// =============================================================================
// Slide 5: CRISP-DM
// =============================================================================
{
  const s = content(5)
  const gap = 0.12
  const cw = (CW - 5 * gap) / 6
  const shades = [NAVY, '12306B', '18429A', '1D4FB8', BLUE, '3B82F6']
  const phases = [
    {
      name: 'Business\nunderstanding',
      does: ['Problem, aim and six objectives', 'Approved project proposal', 'Users: students, early-career developers'],
      art: 'Proposal · report chapter 1',
    },
    {
      name: 'Data\nunderstanding',
      does: ['Quality audit of 49,123 × 170', 'EDA on the training split only', 'Imbalance, similarity, lift, AI, salary'],
      art: 'notebooks 01, 02',
    },
    {
      name: 'Data\npreparation',
      does: ['Deterministic cleaning and cohort', 'Frozen stratified 80/20 split', 'Shared 479-feature pipeline'],
      art: 'src/skillpath · build_dataset.py',
    },
    {
      name: 'Modelling',
      does: ['Six algorithms and a baseline', 'Stratified 5-fold cross-validation', 'Four optimisation phases'],
      art: 'run_models.py · tune_models.py',
    },
    {
      name: 'Evaluation',
      does: ['Selection rule fixed in advance', 'One test on 4,615 held-out people', 'Model card with limitations'],
      art: 'finalise_model.py · model_card.json',
    },
    {
      name: 'Deployment',
      does: ['FastAPI web API', 'React web application', 'Verified by 178 automated tests'],
      art: 'app/ · frontend/ · tests/',
    },
  ]
  phases.forEach((p, i) => {
    const x = LEFT + i * (cw + gap)
    // the label is its own text box: a chevron's built-in text area differs between renderers
    s.addShape(i === 0 ? pptx.shapes.PENTAGON : pptx.shapes.CHEVRON, {
      x: x - (i === 0 ? 0 : 0.1), y: 1.55, w: cw + (i === 0 ? 0.12 : 0.22), h: 0.82, fill: { color: shades[i] },
    })
    const [first, second] = p.name.split('\n')
    T(s, [run(`${i + 1}  `, { color: BLUE_SOFT }), run(first, { breakLine: Boolean(second) }), ...(second ? [run(second)] : [])], {
      x: x + (i === 0 ? 0.1 : 0.34), y: 1.55, w: cw - (i === 0 ? 0.4 : 0.52), h: 0.82,
      color: WHITE, bold: true, fontSize: 12, align: 'center', valign: 'middle', lineSpacingMultiple: 0.95,
    })
    card(s, x, 2.55, cw, 2.62, { fill: SOFT })
    T(s, 'IN SKILLPATH', { x: x + 0.15, y: 2.63, w: cw - 0.3, h: 0.24, fontSize: 9, bold: true, color: BLUE, charSpacing: 1.5, valign: 'middle' })
    bullets(s, p.does, { x: x + 0.15, y: 2.92, w: cw - 0.25, h: 1.55, fontSize: 10.5, gap: 5 })
    s.addShape(pptx.shapes.LINE, { x: x + 0.15, y: 4.52, w: cw - 0.3, h: 0, line: { color: LINE, width: 0.75 } })
    T(s, p.art, { x: x + 0.15, y: 4.57, w: cw - 0.25, h: 0.52, fontSize: 9.5, color: MUTED, fontFace: 'Consolas', valign: 'middle' })
  })

  card(s, LEFT, 5.32, CW, 0.5, { fill: AMBER_TINT, line: AMBER_LINE })
  T(
    s,
    [
      run('Iterative, not a waterfall:  ', { bold: true, color: AMBER }),
      run('modelling fed back into preparation: scaling binary flags cost 0.025 macro-F1, and class weighting was dropped for Logistic Regression.'),
    ],
    { x: LEFT + 0.2, y: 5.32, w: CW - 0.4, h: 0.5, fontSize: 11, color: SLATE, valign: 'middle' },
  )

  const principles = [
    ['One shared package', 'Notebooks, scripts and the web backend use the same skillpath code'],
    ['Split first, learn later', 'Only fixed rules run before the split; the rest is fitted on training rows'],
    ['Preprocessing inside the model', 'Refitted on every fold; the API applies the identical transformation'],
    ['Test split opened once', 'Read by one script, after the model is chosen; seed 42 throughout'],
  ]
  const pw = (CW - 3 * 0.14) / 4
  principles.forEach(([title, body], i) => {
    const x = LEFT + i * (pw + 0.14)
    card(s, x, 5.96, pw, 0.88, { fill: TINT, line: TINT_LINE })
    T(s, title, { x: x + 0.16, y: 6.0, w: pw - 0.3, h: 0.28, fontSize: 12, bold: true, color: NAVY, valign: 'middle' })
    T(s, body, { x: x + 0.16, y: 6.28, w: pw - 0.3, h: 0.5, fontSize: 10, color: SLATE, lineSpacingMultiple: 1.0 })
  })
}

// =============================================================================
// Slide 6: cleaning and preprocessing
// =============================================================================
{
  const s = content(6)
  const lw = 6.6
  label(s, 'From the raw file to the modelling cohort', LEFT, 1.55, lw)
  const RAW = 49123
  const steps = [
    ['Raw public results file', 49123, null],
    ['Near-empty removed (10 or fewer answered fields)', 43329, 5794],
    ['Straight-liners removed (90%+ of a list ticked)', 43242, 87],
    ['Kept: a specific developer role', 38036, 5206],
    ['Kept: skill-defined technical roles', 31406, 6630],
    ['Kept: answered the technology question', 23072, 8334],
  ]
  const lx = LEFT, bx = LEFT + 3.05, bmax = 2.35
  steps.forEach(([name, n, removed], i) => {
    const y = 1.92 + i * 0.52
    const last = i === steps.length - 1
    T(s, name, { x: lx, y, w: 2.95, h: 0.4, fontSize: 10.5, color: last ? NAVY : SLATE, bold: last, valign: 'middle', align: 'right', lineSpacingMultiple: 0.95 })
    const w = (bmax * n) / RAW
    s.addShape(pptx.shapes.RECTANGLE, { x: bx, y: y + 0.05, w, h: 0.3, fill: { color: last ? NAVY : i === 0 ? '93B4F2' : BLUE } })
    T(s, n.toLocaleString('en-US'), { x: bx + w + 0.07, y, w: 0.7, h: 0.4, fontSize: 11.5, bold: true, color: NAVY, valign: 'middle' })
    if (removed) T(s, `−${removed.toLocaleString('en-US')}`, { x: LEFT + lw - 0.62, y, w: 0.62, h: 0.4, fontSize: 10.5, bold: true, color: AMBER, valign: 'middle', align: 'right' })
  })
  T(s, 'removed', { x: LEFT + lw - 0.75, y: 1.62, w: 0.75, h: 0.24, fontSize: 9, color: AMBER, align: 'right', valign: 'middle', bold: true })

  // split
  const sy = 5.18
  T(s, 'STRATIFIED 80 / 20 SPLIT OF THE 23,072 (BEFORE ANYTHING IS LEARNED)', { x: LEFT, y: sy, w: lw, h: 0.24, fontSize: 9.5, bold: true, color: MUTED, charSpacing: 1, valign: 'middle' })
  const trainW = lw * 0.8
  T(s, [run('Train  ', { color: BLUE_SOFT }), run('18,457', { bold: true }), run('   cross-validation, tuning, insight tables', { color: BLUE_SOFT, fontSize: 10 })], {
    shape: pptx.shapes.RECTANGLE, x: LEFT, y: sy + 0.3, w: trainW - 0.03, h: 0.5, fill: { color: NAVY }, color: WHITE, fontSize: 13, align: 'center', valign: 'middle',
  })
  T(s, [run('Test  ', { color: 'DBE7FB' }), run('4,615', { bold: true })], {
    shape: pptx.shapes.RECTANGLE, x: LEFT + trainW + 0.03, y: sy + 0.3, w: lw - trainW - 0.03, h: 0.5, fill: { color: BLUE }, color: WHITE, fontSize: 13, align: 'center', valign: 'middle',
  })
  T(s, 'Stratified on JobRole, seed 42, response IDs frozen. Largest class-share gap between the two sides: 0.02 points. The smallest role keeps 12 test examples.', {
    x: LEFT, y: sy + 0.88, w: lw, h: 0.5, fontSize: 10.5, color: SLATE, lineSpacingMultiple: 1.03,
  })

  const rx = LEFT + lw + 0.3, rw = CW - lw - 0.3
  const cards = [
    {
      tag: 'Before the split', title: 'Deterministic cleaning', fill: SOFT, line: LINE, color: NAVY,
      items: [
        'Rules use questionnaire facts (38 of 42 languages), not data statistics, so they cannot leak',
        'Blank work experience → 0 when years coding is given (2,919 rows, per the survey’s instruction)',
        'Experience impossible for the age band → missing (73 + 100 values)',
      ],
    },
    {
      tag: 'Fitted on training rows', title: 'Missing values and encoding', fill: TINT, line: TINT_LINE, color: BLUE,
      items: [
        'Technology lists: 0/1 flags plus an “unknown” indicator; technologies are never imputed',
        'Years and ordinal scales: training median plus a missing-indicator column',
        'Rare technologies (< 0.5%) pooled into OTHER; 177 countries → 13 regions',
      ],
    },
    {
      tag: 'Checked by unit tests', title: 'Leakage prevention', fill: GREEN_TINT, line: GREEN_LINE, color: GREEN,
      items: [
        'Target, pay source columns and Age are never model inputs',
        'The preprocessor sits inside the model, so every cross-validation fold refits it',
        'Salary, AI and skill tables exclude the 4,615 test respondents',
      ],
    },
  ]
  cards.forEach((c, i) => {
    const y = 1.52 + i * 1.8
    card(s, rx, y, rw, 1.68, { fill: c.fill, line: c.line })
    T(s, c.title, { x: rx + 0.2, y: y + 0.1, w: 3.0, h: 0.3, fontSize: 13.5, bold: true, color: c.color, valign: 'middle' })
    T(s, c.tag.toUpperCase(), { x: rx + rw - 2.3, y: y + 0.1, w: 2.1, h: 0.3, fontSize: 9, bold: true, color: MUTED, charSpacing: 1, align: 'right', valign: 'middle' })
    bullets(s, c.items, { x: rx + 0.2, y: y + 0.46, w: rw - 0.36, h: 1.16, fontSize: 10.5, bulletColor: c.color, gap: 3 })
  })
}

// =============================================================================
// Slide 7: feature engineering and supporting insights
// =============================================================================
{
  const s = content(7)
  label(s, 'One scikit-learn pipeline, fitted on training rows and reused unchanged by the web API', LEFT, 1.5, CW)
  const py = 1.86, ph = 2.0
  // input
  card(s, LEFT, py, 2.05, ph, { fill: SOFT })
  T(s, 'One survey-format row', { x: LEFT + 0.15, y: py + 0.12, w: 1.75, h: 0.5, fontSize: 12.5, bold: true, color: NAVY, lineSpacingMultiple: 0.98 })
  T(s, 'Technologies used and wanted, years, education, country, AI answers', { x: LEFT + 0.15, y: py + 0.7, w: 1.78, h: 1.1, fontSize: 10.5, color: SLATE, lineSpacingMultiple: 1.05 })
  arrow(s, LEFT + 2.1, py + ph / 2, 0.28)

  // transformers
  const gx = LEFT + 2.45, gw = 1.95, gh = 0.95, gg = 0.1
  const steps = [
    ['Technology flags', '403 binary columns: 7 areas × used / wanted'],
    ['Rare pooling', 'Chosen by < 0.5% → OTHER; absorbs unseen values'],
    ['Unknown + counts', '“Unknown” indicator per list; log1p of counts'],
    ['Experience', 'log1p of years, median impute, standardised'],
    ['Ordinal scales', 'Education, AI use, agents, trust, sentiment'],
    ['Region', '177 countries → 13 regions, one-hot'],
  ]
  steps.forEach(([title, body], i) => {
    const x = gx + (i % 3) * (gw + gg)
    const y = py + Math.floor(i / 3) * (gh + gg)
    card(s, x, y, gw, gh, { fill: TINT, line: TINT_LINE })
    T(s, title, { x: x + 0.14, y: y + 0.08, w: gw - 0.24, h: 0.26, fontSize: 11.5, bold: true, color: BLUE, valign: 'middle' })
    T(s, body, { x: x + 0.14, y: y + 0.36, w: gw - 0.22, h: 0.54, fontSize: 9.5, color: SLATE, lineSpacingMultiple: 1.0 })
  })
  const gEnd = gx + 3 * gw + 2 * gg
  arrow(s, gEnd + 0.05, py + ph / 2, 0.28)

  // output
  const ox = gEnd + 0.4, ow = 1.5
  card(s, ox, py, ow, ph, { fill: NAVY, line: NAVY })
  T(s, '479', { x: ox, y: py + 0.28, w: ow, h: 0.7, fontSize: 40, bold: true, color: WHITE, align: 'center', valign: 'middle' })
  T(s, 'features', { x: ox, y: py + 0.98, w: ow, h: 0.3, fontSize: 13, color: BLUE_SOFT, align: 'center', valign: 'middle' })
  T(s, 'saved with the model', { x: ox + 0.1, y: py + 1.4, w: ow - 0.2, h: 0.4, fontSize: 9.5, color: 'CBD5E1', align: 'center' })
  arrow(s, ox + ow + 0.05, py + ph / 2, 0.28)
  const mx = ox + ow + 0.4, mw = LEFT + CW - mx
  card(s, mx, py, mw, ph, { fill: SOFT })
  T(s, 'Logistic Regression', { x: mx + 0.1, y: py + 0.25, w: mw - 0.2, h: 0.6, fontSize: 12.5, bold: true, color: NAVY, align: 'center', lineSpacingMultiple: 0.98 })
  T(s, '20 role probabilities, summed into 12 families', { x: mx + 0.1, y: py + 0.95, w: mw - 0.2, h: 0.85, fontSize: 10, color: SLATE, align: 'center', lineSpacingMultiple: 1.03 })

  // none vs not answered
  const ny = 4.04
  card(s, LEFT, ny, CW, 0.78, { fill: AMBER_TINT, line: AMBER_LINE })
  T(s, '“None” is not “not answered”', { x: LEFT + 0.2, y: ny, w: 2.75, h: 0.78, fontSize: 13, bold: true, color: AMBER, valign: 'middle' })
  const cases = [
    ['Empty list after answering “No” to the area', 'true zero: every flag 0, unknown = 0'],
    ['Empty list because the question was skipped', 'unknown = 1, technologies never imputed'],
  ]
  cases.forEach(([a, b], i) => {
    const x = LEFT + 3.0 + i * 4.62
    T(s, [run(a, { bold: true, color: NAVY, breakLine: true }), run('→ ', { bold: true, color: AMBER }), run(b, { color: SLATE })], {
      x, y: ny, w: 4.5, h: 0.78, fontSize: 10.5, valign: 'middle', lineSpacingMultiple: 1.05,
    })
  })

  // supporting insight datasets
  label(s, 'Supporting insights shown with each role (never model inputs)', LEFT, 4.94, CW)
  const iw = (CW - 2 * 0.14) / 3
  const insights = [
    {
      title: 'AI Exposure Index',
      items: ['100 × mean over 13 development tasks: mostly with AI = 1, partly = 0.5', 'All roles: 19.1 now, 39.0 with planned use; 14.4% see AI as a threat'],
    },
    {
      title: 'Salary peer-group benchmark',
      items: ['Unit errors removed with a robust z-score of log pay within country (|z| > 3.5)', 'Median and middle half for the most specific peer group of 30 or more people'],
    },
    {
      title: 'Lift-based skill gap',
      items: ['Lift = share of the role using a technology ÷ share across all roles', 'Distinctive: 20%+ of the role and lift ≥ 1.1; shows up to five not yet used'],
    },
  ]
  insights.forEach((c, i) => {
    const x = LEFT + i * (iw + 0.14)
    card(s, x, 5.26, iw, 1.58)
    s.addShape(pptx.shapes.RECTANGLE, { x: x + 0.18, y: 5.42, w: 0.06, h: 0.24, fill: { color: BLUE } })
    T(s, c.title, { x: x + 0.32, y: 5.38, w: iw - 0.5, h: 0.32, fontSize: 13, bold: true, color: NAVY, valign: 'middle' })
    bullets(s, c.items, { x: x + 0.18, y: 5.76, w: iw - 0.32, h: 1.02, fontSize: 10.5, gap: 3 })
  })
}

// =============================================================================
// Slide 8: algorithms and validation
// =============================================================================
{
  const s = content(8)
  const lw = 5.45
  // problem
  card(s, LEFT, 1.52, lw, 1.2, { fill: NAVY, line: NAVY })
  T(s, 'Supervised multi-class classification', { x: LEFT + 0.2, y: 1.58, w: lw - 0.4, h: 0.32, fontSize: 14, bold: true, color: WHITE, valign: 'middle' })
  const facts = [
    ['20', 'job-role classes'],
    ['479', 'features'],
    ['18,457', 'training rows'],
    ['155:1', 'class imbalance'],
  ]
  facts.forEach(([big, small], i) => {
    const x = LEFT + 0.2 + i * ((lw - 0.4) / 4)
    T(s, big, { x, y: 1.94, w: (lw - 0.4) / 4, h: 0.4, fontSize: 19, bold: true, color: i === 3 ? 'FDBA74' : WHITE, valign: 'middle' })
    T(s, small, { x, y: 2.34, w: (lw - 0.4) / 4, h: 0.26, fontSize: 10, color: BLUE_SOFT, valign: 'middle' })
  })

  label(s, 'Six algorithms and a baseline', LEFT, 2.86, lw)
  const algos = [
    ['Hist Gradient Boosting', 'boosted trees; each round corrects earlier errors'],
    ['Logistic Regression', 'linear boundaries; good probabilities'],
    ['Random Forest', 'bagged trees; captures skill combinations'],
    ['Linear SVM (calibrated)', 'maximum margin; calibrated for probabilities'],
    ['Complement Naive Bayes', 'assumes independent features'],
    ['k-Nearest Neighbours', 'cosine similarity: “similar skills, similar job”'],
    ['Dummy (most frequent)', 'baseline: always answers Full-stack'],
  ]
  algos.forEach(([name, bias], i) => {
    const y = 3.16 + i * 0.335
    const dummy = i === algos.length - 1
    s.addShape(pptx.shapes.OVAL, { x: LEFT + 0.04, y: y + 0.1, w: 0.11, h: 0.11, fill: { color: dummy ? '94A3B8' : BLUE } })
    T(s, [run(name, { bold: true, color: dummy ? MUTED : NAVY }), run(`   ${bias}`, { color: MUTED, fontSize: 10 })], {
      x: LEFT + 0.26, y, w: lw - 0.26, h: 0.31, fontSize: 11.5, valign: 'middle',
    })
  })

  const vy = 5.62, vw = (lw - 0.14) / 2
  ;[
    ['Stratified 5-fold cross-validation', 'Same folds for every run (seed 42). The preprocessor is refitted in each fold. About 9 examples of the smallest role per validation fold.'],
    ['Macro-F1 is the primary metric', 'The plain mean of the 20 per-role F1 scores: every role counts equally, so ignoring rare roles is penalised.'],
  ].forEach(([title, body], i) => {
    const x = LEFT + i * (vw + 0.14)
    card(s, x, vy, vw, 1.22, { fill: TINT, line: TINT_LINE })
    T(s, title, { x: x + 0.15, y: vy + 0.07, w: vw - 0.28, h: 0.28, fontSize: 11.5, bold: true, color: BLUE, valign: 'middle' })
    T(s, body, { x: x + 0.15, y: vy + 0.36, w: vw - 0.26, h: 0.82, fontSize: 9.5, color: SLATE, lineSpacingMultiple: 1.0 })
  })

  // Stage 6 results (reports/stage6_model_comparison.csv)
  const rx = LEFT + lw + 0.25, rw = CW - lw - 0.25
  card(s, rx, 1.52, rw, 5.32)
  T(s, 'Stage 6 results: macro-F1 against accuracy (5-fold mean)', { x: rx + 0.2, y: 1.6, w: rw - 0.4, h: 0.3, fontSize: 13, bold: true, color: NAVY, valign: 'middle' })
  const models = ['Hist Gradient Boosting', 'Logistic Regression', 'Random Forest', 'Linear SVM (calibrated)', 'Complement Naive Bayes', 'k-Nearest Neighbours', 'Dummy (most frequent)']
  s.addChart(
    pptx.charts.BAR,
    [
      { name: 'Macro-F1', labels: models, values: [0.2724, 0.2547, 0.2537, 0.1911, 0.1786, 0.1676, 0.0283] },
      { name: 'Accuracy', labels: models, values: [0.5602, 0.3657, 0.5541, 0.5368, 0.4917, 0.4997, 0.3944] },
    ],
    {
      x: rx + 0.1, y: 1.92, w: rw - 0.2, h: 3.92,
      barDir: 'bar', barGrouping: 'clustered', catAxisOrientation: 'maxMin', barGapWidthPct: 45, chartColors: [BLUE, 'A3AEBF'],
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: 10, catAxisLabelColor: SLATE, catAxisLineShow: false,
      valAxisHidden: true, valAxisLineShow: false, valGridLine: { style: 'none' }, valAxisMinVal: 0, valAxisMaxVal: 0.66,
      showValue: true, dataLabelFontFace: FONT, dataLabelFontSize: 9, dataLabelColor: SLATE, dataLabelFormatCode: '0.000', dataLabelPosition: 'outEnd',
      showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: 10, legendColor: SLATE,
    },
  )
  card(s, rx + 0.2, 5.92, rw - 0.4, 0.76, { fill: AMBER_TINT, line: AMBER_LINE })
  T(
    s,
    [
      run('Accuracy hides what macro-F1 shows. ', { bold: true, color: AMBER }),
      run('The Dummy model reaches 39.4% accuracy with no skill at all, yet its macro-F1 is 0.028. The top three models are within 0.019 of each other.'),
    ],
    { x: rx + 0.36, y: 5.92, w: rw - 0.72, h: 0.76, fontSize: 10.5, color: SLATE, valign: 'middle', lineSpacingMultiple: 1.03 },
  )
}

// =============================================================================
// Slide 9: optimisation and final model selection
// =============================================================================
{
  const s = content(9)
  const pw = (CW - 3 * 0.14) / 4
  const phases = [
    ['A', 'Imbalance handling', 'None, class weights or oversampling?', ['Weighting harms Logistic Regression: 0.2535 → 0.3003 without it', 'It helps Random Forest: 0.1869 → 0.2548']],
    ['B', 'Feature set and selection', 'Which inputs earn their place?', ['“Want to learn” lists matter: −0.009 without them', 'Feature selection does not help; scaling binary flags costs 0.025']],
    ['C', 'Hyper-parameter search', 'Randomised search, same folds', ['Stronger regularisation wins: C = 0.218', 'The search was free to pick class weighting and rejected it']],
    ['D', 'Tuned against baseline', 'Did the ranking survive tuning?', ['All four tuned models improve', 'Logistic Regression overtakes Gradient Boosting']],
  ]
  phases.forEach(([letter, title, q, items], i) => {
    const x = LEFT + i * (pw + 0.14)
    card(s, x, 1.52, pw, 1.5, { fill: SOFT })
    badge(s, letter, x + 0.16, 1.63, 0.38, { fill: i === 3 ? NAVY : BLUE, fontSize: 13 })
    T(s, title, { x: x + 0.64, y: 1.6, w: pw - 0.74, h: 0.26, fontSize: 12.5, bold: true, color: NAVY, valign: 'middle' })
    T(s, q, { x: x + 0.64, y: 1.85, w: pw - 0.74, h: 0.22, fontSize: 9.5, italic: true, color: MUTED, valign: 'middle' })
    bullets(s, items, { x: x + 0.16, y: 2.18, w: pw - 0.28, h: 0.8, fontSize: 10.5, gap: 3 })
  })

  // tuned vs baseline (reports/stage7_d_tuned_vs_baseline.csv)
  const cw = 7.25
  card(s, LEFT, 3.16, cw, 2.62)
  T(s, 'Macro-F1 before and after optimisation (5-fold mean, training split)', { x: LEFT + 0.2, y: 3.22, w: cw - 0.4, h: 0.28, fontSize: 12, bold: true, color: NAVY, valign: 'middle' })
  const tuned = ['Logistic Regression', 'Hist Gradient Boosting', 'Random Forest', 'Linear SVM (calibrated)']
  s.addChart(
    pptx.charts.BAR,
    [
      { name: 'Stage 6 baseline', labels: tuned, values: [0.2547, 0.2724, 0.2537, 0.1911] },
      { name: 'Stage 7 tuned', labels: tuned, values: [0.303, 0.286, 0.282, 0.2536] },
    ],
    {
      x: LEFT + 0.1, y: 3.5, w: cw - 0.2, h: 2.26,
      barDir: 'bar', barGrouping: 'clustered', catAxisOrientation: 'maxMin', barGapWidthPct: 40, chartColors: ['A3AEBF', BLUE],
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: 10, catAxisLabelColor: SLATE, catAxisLineShow: false,
      valAxisHidden: true, valAxisLineShow: false, valGridLine: { style: 'none' }, valAxisMinVal: 0, valAxisMaxVal: 0.36,
      showValue: true, dataLabelFontFace: FONT, dataLabelFontSize: 9, dataLabelColor: SLATE, dataLabelFormatCode: '0.000', dataLabelPosition: 'outEnd',
      showLegend: true, legendPos: 'r', legendFontFace: FONT, legendFontSize: 10, legendColor: SLATE,
    },
  )

  const rx = LEFT + cw + 0.14, rw = CW - cw - 0.14
  card(s, rx, 3.16, rw, 1.26, { fill: AMBER_TINT, line: AMBER_LINE })
  T(s, 'Why class weighting hurt Logistic Regression', { x: rx + 0.18, y: 3.23, w: rw - 0.36, h: 0.3, fontSize: 12.5, bold: true, color: AMBER, valign: 'middle' })
  T(s, 'Re-weighting inflates rare-role probabilities everywhere: a little recall gained, far more precision lost. Removing it adds +0.047 macro-F1.', {
    x: rx + 0.18, y: 3.56, w: rw - 0.34, h: 0.82, fontSize: 11, color: SLATE, lineSpacingMultiple: 1.04,
  })
  card(s, rx, 4.54, rw, 1.24, { fill: TINT, line: TINT_LINE })
  T(s, 'Tuning changed the winner', { x: rx + 0.18, y: 4.61, w: rw - 0.36, h: 0.3, fontSize: 12.5, bold: true, color: BLUE, valign: 'middle' })
  T(s, 'Gradient Boosting led Stage 6 (0.2724). After tuning, Logistic Regression leads 0.3030 to 0.2860 and fits in 3.3 s.', {
    x: rx + 0.18, y: 4.94, w: rw - 0.34, h: 0.8, fontSize: 11, color: SLATE, lineSpacingMultiple: 1.04,
  })

  const by = 5.92
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: LEFT, y: by, w: CW, h: 0.92, rectRadius: 0.09, fill: { color: NAVY } })
  T(s, 'SELECTION RULE, WRITTEN BEFORE THE RESULTS WERE READ', { x: LEFT + 0.25, y: by + 0.08, w: 7.6, h: 0.24, fontSize: 9.5, bold: true, color: BLUE_SOFT, charSpacing: 1.5, valign: 'middle' })
  T(s, 'Highest 5-fold macro-F1 on the training split. Models within one standard deviation of the best are tied, and the cheapest to fit wins.', {
    x: LEFT + 0.25, y: by + 0.33, w: 7.7, h: 0.54, fontSize: 12, color: WHITE, lineSpacingMultiple: 1.03,
  })
  s.addShape(pptx.shapes.LINE, { x: LEFT + 8.2, y: by + 0.14, w: 0, h: 0.64, line: { color: '35507F', width: 1 } })
  T(s, 'FINAL MODEL', { x: LEFT + 8.42, y: by + 0.08, w: 3.5, h: 0.24, fontSize: 9.5, bold: true, color: BLUE_SOFT, charSpacing: 1.5, valign: 'middle' })
  T(s, [run('Logistic Regression', { bold: true, breakLine: true }), run('C = 0.218, no class weighting; the only model within one SD of the best', { fontSize: 9.5, color: 'CBD5E1' })], {
    x: LEFT + 8.42, y: by + 0.31, w: 3.55, h: 0.58, fontSize: 13, color: WHITE, lineSpacingMultiple: 0.98,
  })
}

// =============================================================================
// Slide 10: final model evaluation
// =============================================================================
{
  const s = content(10)
  T(s, [run('Logistic Regression', { bold: true, color: NAVY }), run(', refitted on 18,457 training rows and evaluated '), run('once', { bold: true, color: NAVY }), run(' on 4,615 held-out respondents')], {
    x: LEFT, y: 1.46, w: CW, h: 0.28, fontSize: 12, color: SLATE, valign: 'middle',
  })
  const ty = 1.84, th = 1.24, hw = 3.4, sw = (CW - hw - 4 * 0.14) / 4
  card(s, LEFT, ty, hw, th, { fill: NAVY, line: NAVY, shadow: true })
  T(s, '83.92%', { x: LEFT + 0.2, y: ty + 0.08, w: hw - 0.4, h: 0.68, fontSize: 40, bold: true, color: WHITE, valign: 'middle' })
  T(s, 'Top-3 job-role accuracy: the true role is among the three shown', { x: LEFT + 0.2, y: ty + 0.76, w: hw - 0.35, h: 0.42, fontSize: 10.5, color: BLUE_SOFT, lineSpacingMultiple: 0.98 })
  const tiles = [
    ['87.78%', 'Career-family top-3 accuracy', BLUE],
    ['54.93%', 'Top-1 accuracy', NAVY],
    ['0.2845', 'Macro-F1 (20 roles)', NAVY],
    ['0.4149', 'Family macro-F1 (12 families)', NAVY],
  ]
  tiles.forEach(([big, small, color], i) => {
    const x = LEFT + hw + 0.14 + i * (sw + 0.14)
    card(s, x, ty, sw, th, { fill: i === 0 ? TINT : SOFT, line: i === 0 ? TINT_LINE : LINE })
    T(s, big, { x: x + 0.15, y: ty + 0.12, w: sw - 0.3, h: 0.6, fontSize: 28, bold: true, color, valign: 'middle' })
    T(s, small, { x: x + 0.15, y: ty + 0.74, w: sw - 0.25, h: 0.42, fontSize: 10.5, color: SLATE, lineSpacingMultiple: 0.98 })
  })

  const ly = 3.24, lw = 5.6
  card(s, LEFT, ly, lw, 1.18, { fill: TINT, line: TINT_LINE })
  T(s, 'What this means in practice', { x: LEFT + 0.18, y: ly + 0.06, w: lw - 0.36, h: 0.28, fontSize: 12, bold: true, color: BLUE, valign: 'middle' })
  bullets(
    s,
    ['For about 84 of every 100 held-out people, their real role is on the screen', 'Roughly double the majority-class baseline (top-3 of 0.41 in cross-validation)', 'The right career family is in the top three 87.8% of the time'],
    { x: LEFT + 0.18, y: ly + 0.36, w: lw - 0.32, h: 0.78, fontSize: 10.5, gap: 2 },
  )

  // cross-validated estimate against the test result (reports/stage7_test_results.json)
  const vy = ly + 1.3
  card(s, LEFT, vy, lw, 1.12)
  T(s, 'Honest validation: cross-validated estimate against the test result', { x: LEFT + 0.18, y: vy + 0.04, w: lw - 0.36, h: 0.26, fontSize: 11, bold: true, color: NAVY, valign: 'middle' })
  const rows = [
    ['', '5-fold CV (train)', 'Held-out test', 'Gap'],
    ['Macro-F1', '0.3030', '0.2845', '−0.0185'],
    ['Top-3 accuracy', '0.8387', '0.8392', '+0.0005'],
    ['Log loss', '1.4146', '1.4146', '0.0000'],
  ]
  const colX = [LEFT + 0.18, LEFT + 2.0, LEFT + 3.3, LEFT + 4.5]
  const colW = [1.8, 1.25, 1.15, 0.92]
  rows.forEach((r, i) =>
    r.forEach((cell, j) =>
      T(s, cell, {
        x: colX[j], y: vy + 0.3 + i * 0.185, w: colW[j], h: 0.185, fontSize: i === 0 ? 9 : 10.5,
        color: i === 0 ? MUTED : j === 0 ? SLATE : NAVY, bold: i === 0 || j === 2, align: j === 0 ? 'left' : 'right', valign: 'middle',
      }),
    ),
  )

  const my = vy + 1.22
  card(s, LEFT, my, lw, 1.04, { fill: AMBER_TINT, line: AMBER_LINE })
  T(s, 'Limits we report, not hide', { x: LEFT + 0.18, y: my + 0.05, w: lw - 0.36, h: 0.26, fontSize: 11.5, bold: true, color: AMBER, valign: 'middle' })
  bullets(
    s,
    ['Top-1 is modest: Full-stack (39% of the data) absorbs uncertain profiles', '7 of 20 roles have recall below 0.10 and carry a “low confidence” badge; two are never predicted first'],
    { x: LEFT + 0.18, y: my + 0.33, w: lw - 0.32, h: 0.68, fontSize: 10, bulletColor: AMBER, gap: 1 },
  )

  // per-role F1 (reports/stage7_test_per_class.csv)
  const rx = LEFT + lw + 0.2, rw = CW - lw - 0.2
  card(s, rx, ly, rw, 3.56)
  T(s, 'F1 per job role on the held-out test set', { x: rx + 0.2, y: ly + 0.06, w: 3.6, h: 0.28, fontSize: 12, bold: true, color: NAVY, valign: 'middle' })
  T(s, '* low confidence (recall < 0.10)', { x: rx + rw - 2.6, y: ly + 0.06, w: 2.4, h: 0.28, fontSize: 9.5, color: AMBER, bold: true, align: 'right', valign: 'middle' })
  const perRole = [
    ['Mobile Developer', 0.699], ['Full-stack Developer', 0.693], ['Embedded Developer', 0.543], ['Back-end Developer', 0.517], ['Front-end Developer', 0.498],
    ['Data Engineer', 0.39], ['DevOps Engineer', 0.355], ['Data Scientist', 0.335], ['AI / ML Engineer', 0.306], ['Desktop / Enterprise Developer', 0.287],
    ['Applied Scientist', 0.262], ['Game / Graphics Developer', 0.248], ['Data / Business Analyst', 0.154], ['QA / Test Engineer *', 0.102],
    ['System Administrator *', 0.098], ['Cloud Infrastructure Engineer *', 0.076], ['Database Administrator / Engineer *', 0.074],
    ['Cybersecurity Specialist *', 0.053], ['AI Application Developer *', 0.0], ['UX / UI Designer *', 0.0],
  ]
  s.addChart(pptx.charts.BAR, [{ name: 'F1 (held-out test)', labels: perRole.map((r) => r[0]), values: perRole.map((r) => r[1]) }], {
    x: rx + 0.08, y: ly + 0.34, w: rw - 0.16, h: 3.18,
    barDir: 'bar', catAxisOrientation: 'maxMin', barGapWidthPct: 28, chartColors: [BLUE],
    catAxisLabelFontFace: FONT, catAxisLabelFontSize: 8, catAxisLabelColor: SLATE, catAxisLineShow: false,
    valAxisHidden: true, valAxisLineShow: false, valGridLine: { style: 'none' }, valAxisMinVal: 0, valAxisMaxVal: 0.82,
    showValue: true, dataLabelFontFace: FONT, dataLabelFontSize: 8, dataLabelColor: SLATE, dataLabelFormatCode: '0.00', dataLabelPosition: 'outEnd',
    showLegend: false,
  })
}

// =============================================================================
// Slide 11: architecture and technology stack
// =============================================================================
{
  const s = content(11)
  label(s, 'Online: one recommendation', LEFT, 1.48, 6, { color: BLUE })
  const bw = 2.48, bg = (CW - 4 * bw) / 3, by = 1.8, bh = 1.62
  const boxes = [
    { title: 'Web application', stack: 'React 19 · TypeScript · Vite · Material UI', body: 'Questionnaire built from the API’s valid options; results, what-if, print, dark mode', fill: SOFT, line: LINE },
    { title: 'Web API', stack: 'FastAPI · Pydantic · Uvicorn', body: 'GET /api/health, GET /api/options, POST /api/predict; readable 422 errors', fill: SOFT, line: LINE },
    { title: 'skillpath package', stack: 'Shared Python package · scikit-learn', body: 'profile_to_frame() makes a survey-format row; the same code the training scripts use', fill: TINT, line: TINT_LINE },
    { title: 'Model artifacts', stack: 'model.joblib · insights.json', body: 'Fitted preprocessor + Logistic Regression; pre-computed role insights; options.json; model card', fill: NAVY, line: NAVY, dark: true },
  ]
  boxes.forEach((b, i) => {
    const x = LEFT + i * (bw + bg)
    card(s, x, by, bw, bh, { fill: b.fill, line: b.line, shadow: true })
    T(s, b.title, { x: x + 0.16, y: by + 0.1, w: bw - 0.3, h: 0.3, fontSize: 14, bold: true, color: b.dark ? WHITE : NAVY, valign: 'middle' })
    T(s, b.stack, { x: x + 0.16, y: by + 0.42, w: bw - 0.3, h: 0.26, fontSize: 9.5, bold: true, color: b.dark ? BLUE_SOFT : BLUE, valign: 'middle' })
    T(s, b.body, { x: x + 0.16, y: by + 0.72, w: bw - 0.28, h: 0.84, fontSize: 10, color: b.dark ? 'DBE7FB' : SLATE, lineSpacingMultiple: 1.02 })
    if (i < 3) {
      arrow(s, x + bw + 0.06, by + 0.95, bg - 0.12, { color: BLUE, width: 1.75 })
      T(s, ['JSON\nprofile', 'validated\nprofile', 'loaded at\nstart-up'][i], { x: x + bw + 0.02, y: by + 0.5, w: bg - 0.04, h: 0.4, fontSize: 9, color: MUTED, align: 'center', valign: 'bottom', lineSpacingMultiple: 0.92 })
    }
  })

  // offline workflow
  const oy = 3.68
  label(s, 'Offline: the data mining workflow that produces the artifacts', LEFT, oy, 8)
  const off = ['Survey CSV\n49,123 responses', 'build_dataset.py\nclean, cohort, split', 'run_models.py\n6 algorithms, 5-fold', 'tune_models.py\nphases A to D', 'finalise_model.py\nfit, single test', 'build_app_tables.py\nrole insights']
  const ow = 1.82, og = (CW - 6 * ow) / 5
  off.forEach((t, i) => {
    const x = LEFT + i * (ow + og)
    const [a, b] = t.split('\n')
    card(s, x, oy + 0.32, ow, 0.66, { fill: i === 0 ? WHITE : SOFT })
    T(s, [run(a, { bold: true, color: NAVY, fontFace: i === 0 ? FONT : 'Consolas', fontSize: i === 0 ? 11 : 9.5, breakLine: true }), run(b, { color: MUTED, fontSize: 9.5 })], {
      x: x + 0.05, y: oy + 0.32, w: ow - 0.1, h: 0.66, align: 'center', valign: 'middle', lineSpacingMultiple: 1.0,
    })
    if (i < off.length - 1) arrow(s, x + ow + 0.03, oy + 0.65, og - 0.06, { width: 1.25 })
  })
  // the offline chain feeds the artifacts box
  s.addShape(pptx.shapes.LINE, { x: LEFT + CW - 1.0, y: by + bh + 0.05, w: 0, h: oy + 0.27 - (by + bh + 0.05), line: { color: MUTED, width: 1.25, beginArrowType: 'triangle', dashType: 'dash' } })
  T(s, 'produces', { x: LEFT + CW - 0.94, y: by + bh + 0.14, w: 0.9, h: 0.22, fontSize: 9, italic: true, color: MUTED, valign: 'middle' })

  // prediction flow
  const fy = 4.88
  label(s, 'Prediction flow of POST /api/predict', LEFT, fy, 8, { color: BLUE })
  const flow = [
    'Questionnaire answers sent as a JSON profile',
    'Pydantic validates every answer (HTTP 422 if invalid)',
    'profile_to_frame() builds a one-row survey frame',
    'Saved pipeline returns 20 role probabilities',
    'Top-3 roles picked; probabilities summed into families',
    'insights.json adds AI outlook, pay, skill gap, confidence flag',
    'Response rendered as the results page',
  ]
  const fw = (CW - 6 * 0.1) / 7
  flow.forEach((t, i) => {
    const x = LEFT + i * (fw + 0.1)
    card(s, x, fy + 0.32, fw, 1.2, { fill: i === 3 ? TINT : WHITE, line: i === 3 ? TINT_LINE : LINE })
    badge(s, String(i + 1), x + 0.12, fy + 0.4, 0.3, { fill: i === 3 ? BLUE : NAVY, fontSize: 10.5 })
    T(s, t, { x: x + 0.12, y: fy + 0.76, w: fw - 0.2, h: 0.72, fontSize: 9.5, color: SLATE, lineSpacingMultiple: 1.0 })
  })
  T(
    s,
    [
      run('No preprocessing is re-implemented in the backend', { bold: true, color: NAVY }),
      run('   ·   nothing the user sends is stored or logged   ·   about 15 ms per prediction, including insights'),
    ],
    { x: LEFT, y: 6.5, w: CW, h: 0.34, fontSize: 10.5, color: SLATE, align: 'center', valign: 'middle' },
  )
}

// =============================================================================
// Slide 12: application demonstration and testing
// =============================================================================
{
  const s = content(12)
  const cw = 4.1, gx = 0.18
  const ax = LEFT, bx = LEFT + cw + gx
  const top = 1.5
  const caption = (n, text, x, y, w) => {
    badge(s, String(n), x, y + 0.03, 0.24, { fill: NAVY, fontSize: 9.5 })
    T(s, text, { x: x + 0.32, y, w: w - 0.32, h: 0.3, fontSize: 10, color: SLATE, valign: 'middle' })
  }
  // column A: questionnaire, role evidence
  const h1 = cw / (1500 / 1200)
  framed(s, 'shot-technologies.jpg', ax, top, cw, h1)
  caption(1, 'Questionnaire: technologies used, wanted, or “none”', ax, top + h1 + 0.03, cw)
  const y3 = top + h1 + 0.44
  const h3 = cw / (1700 / 494)
  framed(s, 'shot-detail.jpg', ax, y3, cw, h3)
  caption(3, 'Evidence per role: AI Exposure Index and salary peer group', ax, y3 + h3 + 0.03, cw)
  // column B: results, what-if
  const h2 = cw / (1700 / 1120)
  framed(s, 'shot-results.jpg', bx, top, cw, h2)
  caption(2, 'Results: best match and the three closest roles', bx, top + h2 + 0.03, cw)
  const y4 = top + h2 + 0.44
  const h4 = cw / (1700 / 763)
  framed(s, 'shot-whatif.jpg', bx, y4, cw, h4)
  caption(4, '“What if…?” Adding a skill re-runs and compares', bx, y4 + h4 + 0.03, cw)

  // testing panel (final report, chapter 11; reports/testing.md)
  const tx = bx + cw + 0.22, tw = LEFT + CW - tx
  card(s, tx, top, tw, 5.34, { fill: SOFT })
  T(s, 'TESTING', { x: tx + 0.2, y: top + 0.1, w: tw - 0.4, h: 0.24, fontSize: 10, bold: true, color: BLUE, charSpacing: 2, valign: 'middle' })
  T(s, [run('178', { fontSize: 34, bold: true, color: NAVY }), run('  automated tests', { fontSize: 13, bold: true, color: NAVY })], {
    x: tx + 0.2, y: top + 0.34, w: tw - 0.4, h: 0.6, valign: 'middle',
  })
  T(s, [run('177 passed', { bold: true, color: GREEN }), run(' · 1 skipped · 0 failed', { color: SLATE })], { x: tx + 0.2, y: top + 0.94, w: tw - 0.4, h: 0.26, fontSize: 11, valign: 'middle' })
  const levels = [
    ['Unit: data and model', 'pytest', 36],
    ['Unit: role insights', 'pytest', 30],
    ['Integration: web API', 'pytest + TestClient', 41],
    ['Unit: web app logic', 'Vitest', 56],
    ['System: whole app', 'Puppeteer, real Chrome', 15],
  ]
  levels.forEach(([name, tool, n], i) => {
    const y = top + 1.32 + i * 0.44
    s.addShape(pptx.shapes.LINE, { x: tx + 0.2, y, w: tw - 0.4, h: 0, line: { color: LINE, width: 0.75 } })
    T(s, [run(name, { bold: true, color: NAVY, breakLine: true }), run(tool, { color: MUTED, fontSize: 9 })], { x: tx + 0.2, y: y + 0.03, w: tw - 1.0, h: 0.4, fontSize: 10.5, valign: 'middle', lineSpacingMultiple: 0.95 })
    T(s, String(n), { x: tx + tw - 0.8, y: y + 0.03, w: 0.6, h: 0.4, fontSize: 15, bold: true, color: BLUE, align: 'right', valign: 'middle' })
  })
  const py = top + 3.62
  card(s, tx + 0.15, py, tw - 0.3, 0.98, { fill: GREEN_TINT, line: GREEN_LINE })
  T(s, 'Training–serving parity', { x: tx + 0.28, y: py + 0.05, w: tw - 0.56, h: 0.26, fontSize: 11, bold: true, color: GREEN, valign: 'middle' })
  T(s, 'Maximum probability difference of exactly 0.0 between the API path and the model (300 rows; repeated over HTTP with 150 held-out respondents).', {
    x: tx + 0.28, y: py + 0.31, w: tw - 0.5, h: 0.64, fontSize: 9.5, color: SLATE, lineSpacingMultiple: 1.0,
  })
  bullets(s, ['End-to-end browser test: 15 scenarios, including phone layout and dark mode', 'Median 15.4 ms per prediction'], {
    x: tx + 0.2, y: py + 1.08, w: tw - 0.36, h: 0.62, fontSize: 9.5, gap: 2,
  })
}

// =============================================================================
// Slide 13: limitations, future work and conclusion
// =============================================================================
{
  const s = content(13)
  const lw = 8.3
  const cw = (lw - 2 * 0.14) / 3
  const cols = [
    {
      title: 'Key achievements', fill: TINT, line: TINT_LINE, color: BLUE,
      items: ['Leakage-free pipeline: 49,123 responses to 479 features', 'Systematic comparison; tuning changed the winner to Logistic Regression', '83.9% top-3 role and 87.8% top-3 family accuracy on held-out data', 'Web API and web app, verified by 178 automated tests'],
    },
    {
      title: 'Limitations', fill: AMBER_TINT, line: AMBER_LINE, color: AMBER,
      items: ['Survey respondents are not a random sample of developers', 'Job roles and skills are self-reported', 'Weak on rare roles; two are never predicted first', 'A 2025 snapshot; worldwide salary benchmarks may not match local pay'],
    },
    {
      title: 'Future work', fill: SOFT, line: LINE, color: NAVY,
      items: ['Retrain annually on each new survey', 'Better support for rare roles (more data, hierarchical models)', 'Personalised explanations from model coefficients', 'Learning resources and local-currency salaries', 'Usability and accessibility testing with students'],
    },
  ]
  cols.forEach((c, i) => {
    const x = LEFT + i * (cw + 0.14)
    card(s, x, 1.52, cw, 3.42, { fill: c.fill, line: c.line })
    T(s, c.title, { x: x + 0.2, y: 1.62, w: cw - 0.4, h: 0.34, fontSize: 15, bold: true, color: c.color, valign: 'middle' })
    s.addShape(pptx.shapes.RECTANGLE, { x: x + 0.2, y: 2.0, w: 0.5, h: 0.035, fill: { color: c.color } })
    bullets(s, c.items, { x: x + 0.2, y: 2.16, w: cw - 0.36, h: 2.72, fontSize: 12, bulletColor: c.color, gap: i === 2 ? 5 : 9 })
  })
  card(s, LEFT, 5.1, lw, 1.74, { fill: WHITE, line: LINE, shadow: true })
  s.addShape(pptx.shapes.RECTANGLE, { x: LEFT, y: 5.24, w: 0.07, h: 1.46, fill: { color: BLUE } })
  T(s, 'CONCLUSION', { x: LEFT + 0.28, y: 5.2, w: 4, h: 0.26, fontSize: 10.5, bold: true, color: BLUE, charSpacing: 2, valign: 'middle' })
  T(
    s,
    'SkillPath applies the full data mining process, from data understanding to a tested deployment, to turn a developer’s skills and AI usage into three explained, evidence-backed role recommendations, with an honest evaluation and transparent limits.',
    { x: LEFT + 0.28, y: 5.52, w: lw - 0.5, h: 1.24, fontSize: 15, color: NAVY, lineSpacingMultiple: 1.1 },
  )

  const rx = LEFT + lw + 0.22, rw = CW - lw - 0.22
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: rx, y: 1.52, w: rw, h: 5.32, rectRadius: 0.1, fill: { color: NAVY } })
  T(s, 'Thank You', { x: rx + 0.3, y: 1.9, w: rw - 0.6, h: 0.75, fontSize: 38, bold: true, color: WHITE, valign: 'middle' })
  T(s, 'Questions?', { x: rx + 0.3, y: 2.68, w: rw - 0.6, h: 0.5, fontSize: 24, bold: true, color: BLUE_SOFT, valign: 'middle' })
  s.addShape(pptx.shapes.RECTANGLE, { x: rx + 0.3, y: 3.4, w: 0.6, h: 0.04, fill: { color: BLUE } })
  T(s, 'GROUP KND_12', { x: rx + 0.3, y: 3.62, w: rw - 0.6, h: 0.26, fontSize: 10, bold: true, color: BLUE_SOFT, charSpacing: 2, valign: 'middle' })
  T(
    s,
    MEMBERS.map((m, i) => run(m.name, { breakLine: i < MEMBERS.length - 1 })),
    { x: rx + 0.3, y: 3.92, w: rw - 0.6, h: 1.4, fontSize: 13.5, color: WHITE, paraSpaceAfter: 5 },
  )
  T(s, 'SOURCE CODE', { x: rx + 0.3, y: 5.5, w: rw - 0.6, h: 0.24, fontSize: 9.5, bold: true, color: BLUE_SOFT, charSpacing: 2, valign: 'middle' })
  T(s, 'github.com/PasinduSuraweera/skillpath', { x: rx + 0.3, y: 5.75, w: rw - 0.5, h: 0.3, fontSize: 11.5, color: WHITE, valign: 'middle' })
  T(s, 'IT3051 – Fundamentals of Data Mining · SLIIT', { x: rx + 0.3, y: 6.3, w: rw - 0.5, h: 0.3, fontSize: 10, color: '94A3B8', valign: 'middle' })
}

// --- write the deck and the two markdown companions ------------------------
await pptx.writeFile({ fileName: `${OUT}SkillPath_Final_Presentation.pptx` })

const presenter = (s) => (s.member === null ? 'Shared (all members)' : MEMBERS[s.member].name)
const VISUALS = [
  'Real start-page screenshot; member cards; four headline figures',
  'Three problem cards, three evidence cards, problem-statement banner',
  'Aim banner, six numbered objectives, in-scope and out-of-scope cards',
  'Native bar chart of the 20 roles; role-similarity heatmap from notebook 02; finding-to-consequence strip',
  'Six-phase chevron flow mapped to project stages and artefacts; four design principles',
  'Cohort attrition bars (49,123 to 23,072); train/test split bar; three rule cards',
  'Pipeline diagram (survey row to 479 features to model); “none” vs “not answered”; three insight cards',
  'Native chart: macro-F1 against accuracy for the seven models',
  'Four phase cards; native chart: baseline against tuned macro-F1; selection-rule banner',
  'Five metric tiles; cross-validation vs test table; native chart of F1 per role',
  'Architecture diagram (online row, offline workflow); seven-step prediction flow',
  'Four real application screenshots; testing panel with the five levels',
  'Achievements, limitations and future work columns; conclusion; thank-you panel',
]

const outline = [
  '# SkillPath final presentation: slide outline',
  '',
  'IT3051 – Fundamentals of Data Mining · Sri Lanka Institute of Information Technology (SLIIT) · Group KND_12',
  '',
  '13 slides: one shared introduction, then three slides per member.',
  '',
  '## Member allocation',
  '',
  '| Member | Name | Registration no. | Section | Slides |',
  '|---|---|---|---|---|',
  ...MEMBERS.map((m, i) => `| ${i + 1} | ${m.name} | ${m.reg} | ${m.part} | ${m.slides} |`),
  '',
  'Slide 1 is shared. The allocation is who presents each section; it does not claim who built which part.',
  '',
  '## Slides',
  '',
  ...SLIDES.flatMap((s) => [
    `### Slide ${s.n}: ${s.title}`,
    '',
    `- **Presenter:** ${presenter(s)}`,
    `- **Key message:** ${s.key}`,
    `- **On the slide:** ${VISUALS[s.n - 1]}`,
    '',
  ]),
]
writeFileSync(`${OUT}slide_outline.md`, outline.join('\n'))

const notes = [
  '# SkillPath final presentation: speaker notes',
  '',
  'The same notes are inside the PowerPoint (View > Notes Page, or Presenter View). Lines that start with "If asked" are answers to likely questions, not part of the talk.',
  '',
  ...SLIDES.flatMap((s) => {
    const first = s.member !== null && SLIDES[s.n - 2]?.member !== s.member
    return [
      ...(s.member === null ? ['## Shared introduction', ''] : first ? [`## Member ${s.member + 1}: ${MEMBERS[s.member].name} (${MEMBERS[s.member].part}, slides ${MEMBERS[s.member].slides})`, ''] : []),
      `### Slide ${s.n}: ${s.title}`,
      '',
      ...s.notes.slice(1).flatMap((p) => [p, '']),
    ]
  }),
]
writeFileSync(`${OUT}speaker_notes.md`, notes.join('\n'))

console.log(`wrote ${SLIDES.length} slides to ${OUT}SkillPath_Final_Presentation.pptx`)
