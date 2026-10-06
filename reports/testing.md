# SkillPath: testing (Stage 11)

How SkillPath was tested, what each test protects, and the results. Every
number below comes from the runs recorded at the end of this page; re-run the
commands in [How to run the tests](#how-to-run-the-tests) to reproduce them.

## Summary

| Level | What is tested | Tool | Tests | Result |
|---|---|---|---:|---|
| Unit: data and model | preprocessing, splits, leakage, modelling helpers, final model | pytest | 36 | 35 passed, 1 skipped¹ |
| Unit: insights | skill gap, salary peer groups, AI outlook, committed `insights.json` | pytest | 30 | 30 passed |
| Integration: web API | the three endpoints over HTTP, validation, training/serving parity | pytest + FastAPI TestClient | 41 | 41 passed |
| Unit: web app | form conversion, client validation, error mapping, what-if text, formatting, API client | Vitest | 56 | 56 passed |
| System: whole app in a browser | the wizard end to end against the real API, in Chrome | Puppeteer | 15 | 15 passed |
| Performance | API response time | Python script | 2 | within target |
| **Total automated** | | | **178** | **177 passed, 1 skipped, 0 failed** |

¹ `test_every_survey_country_maps_to_a_region` needs the raw survey CSV, which
is not in git (140 MB, ODbL download). It runs whenever `data/raw/` holds the
file and is skipped otherwise. The countries the app offers are still checked on
every run by `test_every_country_offered_has_a_region` in the API tests.

## Test strategy

Testing follows the path a recommendation takes, from the bottom up:

1. **Data and model (unit).** The preprocessing and modelling decisions the
   reports rely on: no target leakage, a disjoint stratified split, a
   vocabulary learned from training rows only, preprocessing inside every
   cross-validated pipeline, valid probabilities from the final model.
2. **Insights (unit).** The figures shown next to each role are computed from
   group summaries; tests use small hand-made tables where the right answer is
   known, plus checks on the committed artifact.
3. **Web API (integration).** Real HTTP requests through FastAPI, including the
   startup that loads the saved model. The key check is **training/serving
   parity**: 150 held-out survey respondents sent as JSON must get exactly the
   probabilities the saved model gives for the same rows.
4. **Web app (unit).** The TypeScript logic that turns answers into a request,
   checks them before sending, and explains changes, without a browser.
5. **System.** A real Chrome drives the finished app against the real API, the
   way a user would, and saves a screenshot of each screen.

Test data: the held-out test split (4,615 respondents the model never saw),
four example profiles that are also the demo profiles in the app, and invalid
inputs chosen to hit every validation rule (boundary values 0/60 and -1/61,
unknown values, wrong types, extra fields, malformed JSON).

## Unit and integration tests (pytest)

### Data and model: `tests/test_preprocessing.py`, `tests/test_modelling.py`

Written in Stages 4, 6 and 7. They protect the claims in
`preprocessing_decisions.md` and `modelling_decisions.md`:

| Area | Tests |
|---|---|
| Parsing and encoding | multi-select parsing, "I don't use any" as a true zero vs. skipped as unknown, unseen technologies go to an "other" column, no missing values or constant columns after preprocessing |
| Leakage and splits | target and leaky columns are never inputs, the split is disjoint and stratified, the vocabulary is learned from training rows only, reference tables exclude test respondents, straight-liners removed |
| Serving path | a profile round-trips to identical features, an empty profile does not crash, the final model serves the web API contract identically |
| Modelling | at least four algorithms compared, every candidate has `predict_proba` and keeps preprocessing inside the pipeline, oversampling and feature selection happen inside the estimator, the metric set behaves as documented, family probabilities partition the job-role probabilities, the model card records its limitations |

### Insights: `tests/test_insights.py` (30 tests)

| ID | Test | Why it matters |
|---|---|---|
| INS-01 | `insights.json` equals a fresh rebuild from the committed inputs | A stale file once made the running API return HTTP 500 (defect D4) |
| INS-02 | every one of the 20 roles has AI, reliability and skill tables | no role can crash the result page |
| INS-03 | stored skills respect the thresholds (share ≥ 20%, lift ≥ 1.1, top 15, skill areas only) | the "Skills to grow" rule is what the report says |
| INS-04 | skill tables use the training split only | no test respondents leak into the app |
| INS-05 | no salary group under 30 people; p25 ≤ median ≤ p75 | privacy and stability rule |
| INS-06 | signature technologies make sense (Jupyter for data scientists, Kotlin and Swift for mobile, no Python for front-end) | a sanity check a reader can verify |
| INS-07 | on a toy table, a technology common everywhere (Python) is dropped, a characteristic one (R) is kept with the right share and lift, and one used by fewer than 10 people is dropped; skipped answers do not dilute shares | the selection rule itself |
| INS-08…10 | the gap lists missing skills in rank order, marks wanted ones, never lists one the user has, shows the top 5 when nothing is answered, and is empty for a role with no table | what the card shows |
| INS-11…16 | the salary benchmark picks the most specific group in the documented order (role in country → role in region → family in country → family in region → role worldwide → family worldwide) | one case per level |
| INS-17…18 | without a country only worldwide groups are used; without experience or any group the benchmark says why | honest "not available" messages |
| INS-19…28 | experience bands at every edge (0, 2, 3, 5, 6, 10, 11, 20, 21, 60 years) | the upper edge of each band is inclusive |
| INS-29 | region lookup, including unknown and missing countries | |
| INS-30 | AI outlook falls back to the role family when a role has fewer than 30 people | |

### Web API: `tests/test_api.py` (41 tests)

| ID | Test | Input | Expected |
|---|---|---|---|
| API-01 | health | `GET /api/health` | 200, `status: ok`, model "Logistic Regression" |
| API-02 | options | `GET /api/options` | all 7 technology areas without duplicates, 4 AI questions, 20 roles, years limit 60, ODbL attribution |
| API-03 | every offered country has a region | options | only "Nomadic" has none, by design |
| API-04 | "Other (please specify):" education is not offered | options | absent (it has no place on the education scale) |
| API-05…07 | clear-cut profiles | mobile, full-stack and data/ML profiles | top family Mobile, Full-stack, Data Sci/ML with probability > 50%; top role Mobile and Full-stack Developer |
| API-08 | response structure | full-stack profile | ranks 1-3 in descending probability; every card has label, family, description, AI outlook with all-roles average, reliability flag, skill gap; 3 families; 20 classes; notes; attribution |
| API-09 | full ranking | data profile | 20 distinct roles, each 0-1, sorted, summing to 1; the three cards are the top of it |
| API-10 | families add up | mobile profile | each family = sum of its roles |
| API-11 | skill gap excludes owned skills | data profile | no suggestion the user has; ≤ 5 suggestions |
| API-12 | skill gap marks wanted skills | Jupyter under "want" | suggestion has `wanted: true` |
| API-13 | local salary | full-stack, USA, 8 years | country group (317 people), band 6-10, "Full-stack Developers in United States of America…" |
| API-14 | worldwide salary fallback | mobile, USA, 8 years | worldwide role group used, "worldwide" caveat in the notes |
| API-15 | salary needs experience | no experience | not available, with the reason |
| API-16 | profile echo | data profile | region South Asia, band 0-2, the three answered areas |
| API-17 | **training/serving parity** | 150 held-out respondents as JSON | probabilities identical to the saved model (tolerance 1e-9) |
| API-18 | empty profile | `{}` | 200, three roles, first note says the result is not personal |
| API-19 | blank text = skipped | `"country": "  "` etc. | same ranking as `{}` |
| API-20 | blank work experience = 0 | years coding 5 only | same ranking as work experience 0 (survey rule) |
| API-21 | "I don't use any" ≠ skipped | Webframe none | counted as answered; ranking differs from skipping |
| API-22 | duplicates ignored | Python twice | same ranking as once |
| API-23…37 | each invalid answer is rejected, naming the field | years -1, 61, 2.5, "five"; unknown country, education, learning answer, AI answer; extra AI field; extra top-level field; unknown technology area; unknown "have" and "want" technology; "none" with technologies; misspelled key | 422 with the field and a readable message |
| API-38 | straight-lining rule | 37 vs. 38 of 42 languages | 37 accepted; 38 rejected ("38 of 42 options selected") |
| API-39 | every problem reported at once | three bad fields | all three listed |
| API-40 | malformed JSON | `{not json` | 422, field "body", "JSON decode error" |
| API-41 | wrong method / unknown path | `GET /api/predict`, `/api/nothing` | 405 / 404 |

## Web app unit tests (Vitest)

`frontend/src/form.test.ts`, `format.test.ts`, `api/client.test.ts` (56 tests).

| ID | Area | Checks |
|---|---|---|
| FE-01…07 | answers → request | an untouched form sends an all-unknown profile; untouched technology areas are left out; "I don't use any" is sent on its own; year text becomes numbers, blank text becomes null; all four example profiles round-trip |
| FE-08…20 | client validation (mirrors the API) | empty form valid; years -1, 61, 2.5, "abc" rejected with the right message; 0, 60 and blank accepted; same for work experience; unknown country rejected; 37 of 42 languages accepted, 38 rejected; all example profiles valid |
| FE-21…22 | example profiles | every value is one the API offers (checked against `artifacts/options.json`); unique ids |
| FE-23…32 | server errors → fields | technology errors land on their area; unknown area stays general; two errors for one field are joined; each field opens the right wizard step |
| FE-33…37 | what-if | no change → nothing reported; country, years, technology added/removed, "I don't use any" and AI answers described in plain words; adding a suggested skill moves it from "want" to "used", clears "I don't use any", never duplicates, never mutates the original |
| FE-38…49 | formatting | percentages (<1%, >99%), changes in points with one decimal so 65% → 66% never reads ±0 (defect D1), US dollars, dash for missing |
| FE-50…56 | API client | posts JSON; 422 → `ValidationError` with the field list; proxy 502/503/504 and network failure → "Cannot reach the SkillPath API… uvicorn app.main:app"; other errors show the HTTP status |

## System test cases (browser)

Run automatically by `frontend/e2e/run.mjs` in Chrome against the real API and
model. Each case reloads the page, so the cases are independent. Screenshots
are in [`figures/app/`](figures/app/).

| ID | Scenario | Steps and test data | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| E2E-01 | Start page | Open the app | Form loads from `/api/options`; four example buttons; Results step disabled | As expected ([01](figures/app/01-start.png)) | Pass |
| E2E-02 | Example fills the wizard | Click "Sri Lankan CS undergrad"; Next; Next | Confirmation message; country Sri Lanka, 4 years; Java, Spring Boot, MongoDB selected; AI answers filled | As expected ([02](figures/app/02-about.png), [03](figures/app/03-technologies.png), [04](figures/app/04-ai-usage.png)) | Pass |
| E2E-03 | Get recommendations | Same profile; Get recommendations | Three role cards, first Full-stack Developer; AI outlook, typical pay, skills to grow, career families and caveats shown | Full-stack 64%, Back-end 23% ([05](figures/app/05-results.png)) | Pass |
| E2E-04 | Expected role for each example | Run all four examples | Full-stack, Data Scientist, Mobile, Data Scientist | All four as expected | Pass |
| E2E-05 | What if: add a suggested skill | Results; press + next to the first suggestion | Re-run; before/after table with at least three roles; change chip "used: + ‹skill›" | As expected ([06](figures/app/06-what-if-skill.png)) | Pass |
| E2E-06 | What if: change an answer | Results; Change answers; years coding 4 → 8; Get recommendations; Hide comparison | Chip "Years coding: 4 → 8"; comparison hides | As expected | Pass |
| E2E-07 | All 20 roles | Results; "See all 20 job roles" | 20 roles listed | As expected | Pass |
| E2E-08 | Dark mode | Results; moon button | Dark background | As expected ([07](figures/app/07-results-dark.png)) | Pass |
| E2E-09 | Print / save as PDF from dark mode | System dark mode; results; print (beforeprint + print media, A4) | Prints light, buttons hidden; dark restored after printing | As expected ([08](figures/app/08-print.png), [PDF](figures/app/15-results-print.pdf)) | Pass |
| E2E-10 | Client validation | Years coding 99; Next; Get recommendations | "Enter a number from 0 to 60." on the field; back on "About you"; summary message; **no API call** | As expected, 0 API calls ([09](figures/app/09-validation-client.png)) | Pass |
| E2E-11 | Server validation shown on fields | Request changed in flight to years -1 and language "Cobol++" | API 422; banner; years error on the years field; language error on the Technologies step | As expected ([10](figures/app/10-validation-server.png)) | Pass |
| E2E-12 | Clear answers | Load an example; Clear answers | Country and years empty | As expected | Pass |
| E2E-13 | API not running | API answers 502 (as the Vite proxy does when uvicorn is down); then Try again with the API back | Message saying how to start the API, Try again button; form loads after retry | As expected ([11](figures/app/11-api-down.png)) | Pass |
| E2E-14 | Phone screen | 390 × 844 viewport: start, technologies, results | No sideways scrolling on any screen | As expected ([12](figures/app/12-phone-start.png), [13](figures/app/13-phone-technologies.png), [14](figures/app/14-phone-results.png)) | Pass |
| E2E-15 | No browser errors | Whole run | No console errors other than the deliberate 422 and 502 | None | Pass |

## Performance

Measured against `uvicorn app.main:app` on an Apple M1 (one worker, after 10
warm-up calls), with the full-stack profile:

| Endpoint | Calls | Median | 95th percentile | Max |
|---|---:|---:|---:|---:|
| `POST /api/predict` | 300 | 15.4 ms | 16.5 ms | 19.7 ms |
| `GET /api/options` | 100 | 0.5 ms | 0.7 ms | n/a |

A prediction response is about 7.6 KB. Well under the 1 second a form submit
should take; the model is loaded once at startup, not per request.

## Defects found and fixed

Found while testing the web app (Stage 10) and fixed before release. Each one
now has a test so it cannot return.

| ID | Defect | Fix | Regression test |
|---|---|---|---|
| D1 | What-if showed "±0" when a role moved from 65% to 66% (whole-point rounding) | changes shown to one decimal ("+0.6 pts") | FE `points` tests |
| D2 | Printing from dark mode gave white text on white paper | the page switches to light colours for printing and back afterwards | E2E-09 |
| D3 | No way to empty the form after loading an example | "Clear answers" button | E2E-12 |
| D4 | A running API returned HTTP 500 after the insights code changed but `insights.json` was not rebuilt | rebuilt the file; a test now fails whenever the committed file differs from a fresh build | INS-01 |
| D5 | Two example profiles used technologies the API does not offer ("Julia", "RStudio"), so they were rejected | replaced with offered values | FE-21 |

Testing in Stage 11 found no further defects in the app. Two failures in the
first browser run were mistakes in the test script itself (a too-broad URL
match and an exact-text match on a step button) and were corrected in the script.

## Not covered

- **Browsers:** only Chrome was automated. The app uses standard MUI components
  and no browser-specific code, but Firefox and Safari were not tested.
- **Accessibility:** buttons, charts and fields have labels, but no screen
  reader or full keyboard-only test was done.
- **Load:** single-user response times only; the app is meant to run locally
  for one user.
- **Usability with real users:** not yet done.
- **Model quality:** measured in Stage 7 on the held-out test split (top-3
  accuracy 83.9%, family top-3 87.8%), not repeated here; see
  `modelling_decisions.md`.

## How to run the tests

From the project root, with the virtual environment active:

```bash
pytest -q                          # data, model, insights and API tests (~15 s)
```

Web app unit tests:

```bash
cd frontend
npm test                           # Vitest, < 1 s
```

Browser test (needs both servers and Google Chrome):

```bash
uvicorn app.main:app               # terminal 1, project root
cd frontend && npm run dev         # terminal 2
cd frontend && npm run e2e         # terminal 3: 15 cases, under a minute
```

`npm run e2e` writes screenshots, an A4 PDF and `results.json` to
`frontend/e2e/shots/` (not committed). Settings: `E2E_APP` (default
`http://localhost:5173/`), `CHROME_PATH`, `E2E_SHOTS`, and `E2E_HEADFUL=1` to
watch the browser.

## Test run recorded here

6 October 2026 on macOS 26.3 (Apple M1): Python 3.13.9, scikit-learn 1.8.0,
FastAPI 0.142.2, Node 24.2.0, Vitest 5.0.3, Google Chrome 154.
