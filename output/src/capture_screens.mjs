// Captures the application screenshots used in the presentation from the real,
// running SkillPath web app (the same app and API the browser test drives).
//
//   1. start the API:      uvicorn app.main:app                       (port 8000)
//   2. start the web app:  cd frontend && npx vite --port 5199
//   3. run:                node capture_screens.mjs
//
// Settings: APP (web app address), CHROME_PATH (Chrome binary).
// Screens are saved to ../assets/raw/app-*.png at 2x resolution; prepare_assets.py crops them.
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// puppeteer-core is already a dev dependency of the web app; reuse it
const require = createRequire(new URL('../../frontend/package.json', import.meta.url))
const puppeteer = require('puppeteer-core')

const APP = process.env.APP ?? 'http://localhost:5199/'
const OUT = fileURLToPath(new URL('../assets/raw/', import.meta.url))
const CHROME =
  process.env.CHROME_PATH ??
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(
    existsSync,
  )
if (!CHROME) {
  console.error('Chrome not found. Set CHROME_PATH.')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] })
const page = await browser.newPage()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const hasText = (t) => page.evaluate((t) => document.body.innerText.includes(t), t)

async function waitText(t, ms = 15000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await hasText(t)) return
    await sleep(100)
  }
  throw new Error(`timed out waiting for "${t}"`)
}

async function click(label) {
  const ok = await page.evaluate((label) => {
    const all = [...document.querySelectorAll('button, [role=button]')].filter((e) => !e.disabled)
    const el = all.find((e) => e.textContent.trim() === label) ?? all.find((e) => e.textContent.trim().startsWith(label))
    if (!el) return false
    el.click()
    return true
  }, label)
  if (!ok) throw new Error(`no enabled button "${label}"`)
  await sleep(300)
}

async function fresh(height = 900) {
  await page.setViewport({ width: 1400, height, deviceScaleFactor: 2 })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await page.goto(APP, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle0' })
  await waitText('Which developer role fits you?')
}

/** Scroll so the smallest element containing `text` sits `offset` px below the top, let animations settle, capture. */
async function shotAt(name, text, offset = 110, settle = 1800) {
  if (text) {
    await page.evaluate(
      (text, offset) => {
        const all = [...document.querySelectorAll('body *')].filter(
          (e) => e.children.length === 0 && e.textContent.trim().startsWith(text),
        )
        const el = all[0]
        if (!el) throw new Error(`no element with text "${text}"`)
        const y = el.getBoundingClientRect().top + window.scrollY - offset
        window.scrollTo({ top: Math.max(0, y), behavior: 'instant' })
      },
      text,
      offset,
    )
  }
  await sleep(settle)
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: false })
  console.log(`saved ${name}.png`)
}

try {
  // start page
  await fresh()
  await shotAt('app-start', null)

  // questionnaire: technologies step, filled by the "Sri Lankan CS undergrad" example
  await click('Sri Lankan CS undergrad')
  await click('Next')
  await waitText('Programming languages')
  await shotAt('app-technologies', 'Programming languages', 190)

  // results: best match and the three closest roles
  await fresh(1060)
  await click('Sri Lankan CS undergrad')
  await click('Get recommendations')
  await waitText('Your top job role matches')
  await shotAt('app-results', null, 0, 2500)

  // role detail: AI outlook, typical pay, skills to grow
  await shotAt('app-role-detail', 'AI outlook', 150, 2500)

  // career families
  await shotAt('app-families', 'Career families', 150, 2500)

  // what if: add the suggested skill and compare
  await fresh(900)
  await click('Sri Lankan CS undergrad')
  await click('Get recommendations')
  await waitText('Your top job role matches')
  await sleep(1200)
  await page.click('button[aria-label^="What if I add"]')
  await waitText('Before and after')
  await shotAt('app-what-if', 'What if', 150, 3500)
} finally {
  await browser.close()
}
