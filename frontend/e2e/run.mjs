// End-to-end browser test of the SkillPath web app (system testing).
//
// Drives a real Chrome through the wizard against the real API, the way a user
// would, and saves a screenshot of every screen. Each case reloads the page so
// the cases do not depend on each other. Case IDs match reports/testing.md.
//
//   1. start the API:      uvicorn app.main:app            (port 8000)
//   2. start the web app:  npm run dev                     (port 5173)
//   3. run:                npm run e2e
//
// Settings (environment variables):
//   E2E_APP      web app address        default http://localhost:5173/
//   CHROME_PATH  Chrome/Chromium binary default: the usual install location
//   E2E_SHOTS    screenshot folder      default e2e/shots/
//   E2E_HEADFUL  set to 1 to watch the browser
//
// Exit code 0 when every case passes, 1 otherwise.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const APP = process.env.E2E_APP ?? 'http://localhost:5173/'
const SHOTS = process.env.E2E_SHOTS ?? fileURLToPath(new URL('./shots/', import.meta.url))
const CHROME =
  process.env.CHROME_PATH ??
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find(existsSync)
if (!CHROME) {
  console.error('Chrome not found. Set CHROME_PATH to a Chrome or Chromium binary.')
  process.exit(2)
}
mkdirSync(SHOTS, { recursive: true })

const DESKTOP = { width: 1400, height: 900 }
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: process.env.E2E_HEADFUL !== '1',
  args: ['--no-first-run'],
})
const page = await browser.newPage()

// Console errors fail the run, except while a case provokes them on purpose
// (the browser logs every failed request, e.g. the deliberate 422 and 502).
let expectingErrors = false
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error' && !expectingErrors) consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(`page error: ${e.message}`))

// --- helpers ---------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = (name, fullPage = true) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage })
const text = () => page.evaluate(() => document.body.innerText)
const hasText = async (t) => (await text()).includes(t)

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

async function waitText(t, ms = 10000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await hasText(t)) return
    await sleep(100)
  }
  throw new Error(`timed out waiting for "${t}"`)
}

/** Click the enabled button whose text is exactly `label` (falls back to "starts with"). */
async function click(label) {
  const ok = await page.evaluate((label) => {
    const all = [...document.querySelectorAll('button, [role=button]')].filter((e) => !e.disabled)
    const el = all.find((e) => e.textContent.trim() === label) ?? all.find((e) => e.textContent.trim().startsWith(label))
    if (!el) return false
    el.click()
    return true
  }, label)
  assert(ok, `no enabled button "${label}"`)
  await sleep(300)
}

async function typeInto(selector, value) {
  await page.click(selector, { count: 1 })
  await page.$eval(selector, (el) => el.select?.())
  await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control')
  await page.keyboard.press('a')
  await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control')
  await page.keyboard.press('Backspace')
  if (value) await page.keyboard.type(value)
}

const YEARS_CODE = 'input[type=number]' // first number field on "About you"

async function fresh({ colorScheme = 'light', viewport = DESKTOP } = {}) {
  await page.setViewport(viewport)
  await page.emulateMediaType('screen')
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: colorScheme }])
  await page.goto(APP, { waitUntil: 'networkidle0' })
  // the theme choice (light/dark/system) is remembered; start every case from "system"
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle0' })
  await waitText('Which developer role fits you?')
}

async function runSample(name) {
  await click(name)
  await click('Get recommendations')
  await waitText('Your top job role matches')
  await sleep(300)
}

/** Labels of the three role cards, in rank order. */
const roleCards = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[aria-label^="Match "]')].map((bar) => {
      let el = bar
      while (el && !el.querySelector('h3')) el = el.parentElement
      return el?.querySelector('h3')?.textContent ?? '?'
    }),
  )

const bodyBackground = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const isDark = async () => {
  const [r, g, b] = (await bodyBackground()).match(/\d+/g).map(Number)
  return r + g + b < 200
}
const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

// --- cases -----------------------------------------------------------------
const results = []
async function testCase(id, title, fn) {
  const started = Date.now()
  try {
    await fn()
    results.push({ id, title, pass: true, ms: Date.now() - started })
    console.log(`PASS  ${id}  ${title}`)
  } catch (e) {
    results.push({ id, title, pass: false, ms: Date.now() - started, error: e.message })
    console.log(`FAIL  ${id}  ${title}\n      ${e.message}`)
    await shot(`FAIL-${id}`).catch(() => {})
  }
}

await testCase('E2E-01', 'Start page loads the form options and the example profiles', async () => {
  await fresh()
  for (const s of ['Sri Lankan CS undergrad', 'Data / ML-leaning graduate', 'Mobile developer', 'Career switcher']) {
    assert(await hasText(s), `example "${s}" missing`)
  }
  const resultsNav = await page.evaluate(() => document.querySelector('nav [data-nav="results"]')?.disabled)
  assert(resultsNav === true, 'Results should be disabled in the nav before a prediction')
  await shot('01-start', false)
})

await testCase('E2E-02', 'An example profile fills every wizard step', async () => {
  await fresh()
  await click('Sri Lankan CS undergrad')
  assert(await hasText('Loaded “Sri Lankan CS undergrad”'), 'no confirmation message')
  const country = await page.$eval('input[role=combobox]', (e) => e.value)
  assert(country === 'Sri Lanka', `country is "${country}"`)
  assert((await page.$eval(YEARS_CODE, (e) => e.value)) === '4', 'years coding not filled')
  await shot('02-about', false)
  await click('Next')
  await waitText('Programming languages')
  for (const t of ['Java', 'Spring Boot', 'MongoDB']) assert(await hasText(t), `${t} not selected`)
  await shot('03-technologies')
  await click('Next')
  await waitText('Yes, I use AI tools daily')
  await shot('04-ai-usage')
})

await testCase('E2E-03', 'Get recommendations shows three roles with every insight', async () => {
  await fresh()
  await runSample('Sri Lankan CS undergrad')
  const roles = await roleCards()
  assert(roles.length === 3, `${roles.length} role cards`)
  assert(roles[0] === 'Full-stack Developer', `top role is ${roles[0]}`)
  for (const t of ['AI outlook', 'Typical pay', 'median / year', 'Skills to grow', 'Career families', 'Please keep in mind']) {
    assert(await hasText(t), `"${t}" missing`)
  }
  await shot('05-results')
})

await testCase('E2E-04', 'Each example profile gives its expected top role', async () => {
  const expected = {
    'Sri Lankan CS undergrad': 'Full-stack Developer',
    'Data / ML-leaning graduate': 'Data Scientist',
    'Mobile developer': 'Mobile Developer',
    'Career switcher': 'Data Scientist',
  }
  for (const [sample, role] of Object.entries(expected)) {
    await fresh()
    await runSample(sample)
    const top = (await roleCards())[0]
    assert(top === role, `${sample}: top role ${top}, expected ${role}`)
  }
})

await testCase('E2E-05', 'What if: adding a suggested skill re-runs and compares', async () => {
  await fresh()
  await runSample('Sri Lankan CS undergrad')
  const label = await page.$eval('button[aria-label^="What if I add"]', (b) => b.getAttribute('aria-label'))
  await page.click('button[aria-label^="What if I add"]')
  await waitText('Before and after')
  const tech = label.replace('What if I add ', '').replace(/\?$/, '')
  assert(await hasText(`used: + ${tech}`), `change chip for ${tech} missing`)
  const rows = await page.$$eval('table[aria-label="Before and after comparison"] tbody tr', (r) => r.length)
  assert(rows >= 3, `${rows} comparison rows`)
  await shot('06-what-if-skill')
})

await testCase('E2E-06', 'What if: changing an answer shows the change and the new ranking', async () => {
  await fresh()
  await runSample('Sri Lankan CS undergrad')
  await click('Change answers')
  await waitText('Years coding')
  await typeInto(YEARS_CODE, '8')
  await click('Get recommendations')
  await waitText('Years coding: 4 → 8')
  await click('Hide comparison')
  assert(!(await hasText('Before and after')), 'comparison not hidden')
})

await testCase('E2E-07', 'All 20 job roles can be listed', async () => {
  await fresh()
  await runSample('Mobile developer')
  await click('See all 20 job roles')
  await sleep(300)
  assert(await hasText('20. '), 'role 20 not listed')
})

await testCase('E2E-08', 'Dark mode toggle switches the theme', async () => {
  await fresh()
  await runSample('Data / ML-leaning graduate')
  assert(!(await isDark()), 'should start light')
  await page.click('button[aria-label="Toggle dark mode"]')
  await sleep(300)
  assert(await isDark(), `still light (${await bodyBackground()})`)
  await shot('07-results-dark')
})

await testCase('E2E-09', 'Printing from dark mode prints in light colours without buttons', async () => {
  await fresh({ colorScheme: 'dark' })
  await runSample('Mobile developer')
  assert(await isDark(), 'system dark mode not applied')
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  await page.emulateMediaType('print')
  await page.setViewport({ width: 794, height: 1123 }) // A4 at 96 dpi
  await sleep(300)
  assert(!(await isDark()), 'still dark while printing')
  const hidden = await page.evaluate(() =>
    ['Start over', 'Print / PDF'].every((t) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t)
      return b && b.offsetParent === null
    }),
  )
  assert(hidden, 'buttons visible in print')
  // PDF output ignores CSS masks (a masked layer prints whole, covering what is under it) and
  // backdrop blur, so nothing printed may rely on them
  const unprintable = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => el.getClientRects().length)
      .flatMap((el) =>
        [null, '::before', '::after']
          .filter((pseudo) => {
            const s = getComputedStyle(el, pseudo)
            return s.display !== 'none' && ((s.maskImage || 'none') !== 'none' || s.backdropFilter !== 'none')
          })
          .map((pseudo) => `${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('css-')).join('.')}${pseudo ?? ''}`),
      ),
  )
  assert(unprintable.length === 0, `masked or blurred in print: ${unprintable.slice(0, 3).join(', ')}`)
  await shot('08-print')
  await page.pdf({ path: `${SHOTS}results.pdf`, format: 'A4', printBackground: true })
  await page.emulateMediaType('screen')
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await sleep(300)
  assert(await isDark(), 'dark mode not restored after printing')
})

await testCase('E2E-10', 'Client validation stops an out-of-range answer before calling the API', async () => {
  await fresh()
  let calls = 0
  const count = (r) => r.url().endsWith('/api/predict') && calls++
  page.on('request', count)
  await typeInto(YEARS_CODE, '99')
  await click('Next')
  await click('Get recommendations')
  page.off('request', count)
  await waitText('Enter a number from 0 to 60.')
  assert(await hasText('Please fix the highlighted answer'), 'no summary message')
  assert(await hasText('About you'), 'did not return to the step with the error')
  assert(calls === 0, `API was called ${calls} times`)
  await shot('09-validation-client', false)
})

await testCase('E2E-11', 'A 422 from the API is shown on the field it names', async () => {
  await fresh()
  // Simulate a request the client checks let through: change the body on its way to the API.
  await page.setRequestInterception(true)
  const tamper = (req) => {
    if (req.isInterceptResolutionHandled()) return
    if (new URL(req.url()).pathname === '/api/predict') {
      const body = JSON.parse(req.postData())
      req.continue({ postData: JSON.stringify({ ...body, years_code: -1, tech: { Language: { have: ['Cobol++'] } } }) })
    } else req.continue()
  }
  page.on('request', tamper)
  expectingErrors = true
  try {
    await click('Get recommendations')
    await waitText('Some answers are not valid')
    assert(await hasText('Input should be greater than or equal to 0'), 'years error not on the field')
    await shot('10-validation-server', false)
    await click('Next')
    await waitText("Language.have: unknown technologies ['Cobol++']")
  } finally {
    expectingErrors = false
    page.off('request', tamper)
    await page.setRequestInterception(false)
  }
})

await testCase('E2E-12', 'Clear answers empties the form', async () => {
  await fresh()
  await click('Mobile developer')
  await click('Clear answers')
  assert((await page.$eval(YEARS_CODE, (e) => e.value)) === '', 'years coding not cleared')
  assert((await page.$eval('input[role=combobox]', (e) => e.value)) === '', 'country not cleared')
})

await testCase('E2E-13', 'A clear message and a retry button when the API is not running', async () => {
  await page.setRequestInterception(true)
  let down = true
  const block = (req) => {
    if (req.isInterceptResolutionHandled()) return
    // only API calls: the app's own modules live under /src/api/ in development
    if (down && new URL(req.url()).pathname.startsWith('/api/')) req.respond({ status: 502, body: '' })
    else req.continue()
  }
  page.on('request', block)
  expectingErrors = true
  try {
    await page.setViewport(DESKTOP)
    await page.goto(APP, { waitUntil: 'networkidle0' })
    await waitText('Cannot reach the SkillPath API')
    assert(await hasText('uvicorn app.main:app'), 'message does not say how to start the API')
    await shot('11-api-down', false)
    down = false
    await click('Try again')
    await waitText('Which developer role fits you?')
  } finally {
    expectingErrors = false
    page.off('request', block)
    await page.setRequestInterception(false)
  }
})

await testCase('E2E-14', 'Phone-sized screen: no sideways scrolling on any step', async () => {
  const phone = { width: 390, height: 844, deviceScaleFactor: 2 }
  await fresh({ viewport: phone })
  assert(await noHorizontalScroll(), 'start page scrolls sideways')
  await shot('12-phone-start')
  await click('Sri Lankan CS undergrad')
  await click('Next')
  await waitText('Programming languages')
  assert(await noHorizontalScroll(), 'technologies step scrolls sideways')
  await shot('13-phone-technologies')
  await click('Get recommendations')
  await waitText('Your top job role matches')
  await sleep(300)
  assert(await noHorizontalScroll(), 'results scroll sideways')
  await shot('14-phone-results')
})

await testCase('E2E-15', 'No unexpected errors in the browser console', async () => {
  assert(consoleErrors.length === 0, consoleErrors.join(' | '))
})

await browser.close()

const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} passed. Screenshots: ${SHOTS}`)
writeFileSync(`${SHOTS}results.json`, JSON.stringify({ app: APP, ranAt: new Date().toISOString(), results }, null, 2))
process.exit(passed === results.length ? 0 : 1)
