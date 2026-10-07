# SkillPath

**An AI-aware developer job role and career path recommendation system.**

**Prediction target:** the specific job role (20 classes, e.g. Data Engineer, DevOps Engineer,
AI / ML Engineer). Each job role belongs to one of 12 role families; a family's probability is the
sum of its job roles' probabilities (`skillpath.targets`), so one model gives the top-3 job roles
and the top families.

Status: **Stages 3-4 (EDA, preprocessing), Stages 6-7 (modelling, optimisation), Stage 9
(backend API), Stage 10 (web app) and Stage 11 (testing) complete.** Next: report and presentation.

## Result

**Final model:** Logistic Regression (`C=0.218`, **no class weighting**) inside the Stage 4
preprocessing pipeline, saved as `artifacts/model.joblib` (108 KB).

| On the 4,615 held-out respondents | |
|---|---|
| Correct job role in the **top 3 shown** | **83.9%** |
| Correct career family in the top 3 | **87.8%** |
| macro-F1 (20 classes) | 0.285 |
| Top-1 accuracy | 54.9% |

Top-1 macro-F1 is the metric used to *select* the model, because it penalises ignoring rare
roles. It is not the user-facing claim: the app never shows one answer, it shows three roles
plus the career family.

**Evaluation 2 walkthrough:** `notebooks/06_evaluation2_showcase.ipynb` (or `reports/html/06_evaluation2_showcase.html`
in a browser). It opens the processed data, then walks Stages 6-8 end to end. Running it writes an
Excel copy of the processed data to `data/processed/excel/` (git-ignored, about 35 MB).

**Read next:** `reports/modelling_decisions.md` (decisions, evidence and viva Q&A) or
`reports/SkillPath_Stage6-8_Report.pdf` (20-page technical report).

---

## What is in this repository

```
skillpath/
├── src/skillpath/            installable package, used by notebooks AND the web backend
│   ├── config.py             every threshold, mapping and column list in one place
│   ├── data.py               loading the survey files, country -> region lookup
│   ├── cleaning.py           deterministic row cleaning (near-empty, duplicates,
│   │                         straight-lining, experience fixes, salary outlier rules)
│   ├── cohorts.py            recommender / salary / persona cohorts, AI Exposure Index
│   ├── split.py              stratified 80/20 split frozen by ResponseId
│   ├── features.py           custom sklearn transformers (TechBlockEncoder, ...)
│   ├── pipeline.py           build_preprocessor(): the shared preprocessing pipeline
│   ├── targets.py            job role -> family probabilities, top-3 recommendation helpers
│   ├── modelling.py          Stage 6-7: candidates, metrics, resampling, experiment runner
│   ├── profile.py            web API contract: JSON profile <-> survey-format row
│   ├── insights.py           AI outlook, salary benchmark and skill-gap lookups for the web app
│   ├── viz.py                chart style
│   └── resources/country_region.csv
├── scripts/
│   ├── build_dataset.py      runs the whole preprocessing and writes all outputs (~15 s)
│   ├── run_models.py         Stage 6: compares the 7 candidates (~29 min)
│   ├── tune_models.py        Stage 7: experiment phases A-D (~41 min)
│   ├── finalise_model.py     fits the chosen model, opens the test split ONCE
│   ├── build_app_tables.py   writes artifacts/insights.json for the web app (~1 s)
│   ├── build_report_pdf.py   rebuilds the technical report PDF from the result files
│   └── run_notebooks.sh      executes the notebooks and exports HTML copies
├── app/                      Stage 9 web API (FastAPI): main.py, schemas.py, service.py
├── frontend/                 Stage 10 web app (React + TypeScript + Vite + MUI);
│                             unit tests in src/*.test.ts, browser test in e2e/run.mjs
├── notebooks/                01 data understanding, 02 EDA, 03 preprocessing,
│                             04 modelling + optimisation (Stage 6 and 7 in one),
│                             06 Evaluation 2 walkthrough (Stages 6-8)
│                             (.py = source, .ipynb = executed with outputs)
├── data/
│   ├── raw/                  put the Stack Overflow files here (not committed, 140 MB)
│   ├── processed/            train/test rows, split IDs, transformed feature matrices
│   └── reference/            AI exposure, persona and salary datasets
├── artifacts/
│   ├── model.joblib          THE final fitted Pipeline (preprocessor + classifier)
│   ├── model_card.json       what it is, how it scores, what it must not be used for
│   ├── preprocessor_core.joblib, feature_names_core.json
│   ├── options.json          every valid form value, for building the web form
│   └── insights.json         AI outlook, salary peer groups, role reliability, skill gap (summaries only)
├── reports/
│   ├── modelling_decisions.md       Stages 6-7: results, experiments + viva Q&A  <- start here
│   ├── testing.md                   Stage 11: test strategy, every test case, results, defects
│   ├── preprocessing_decisions.md   Stages 3-4: every decision with evidence + viva Q&A
│   ├── SkillPath_Stage6-8_Report.pdf  20-page technical report (regenerate with the script)
│   ├── model_experiments.csv        every cross-validation run in the project, timestamped
│   ├── stage6_*.csv / .json         comparison, per-class report, confusion matrix
│   ├── stage7_*.csv / .json         each phase, search results, final selection, test results
│   ├── feature_dictionary.csv       all 479 model features, source and transformation
│   ├── build_report.json            counts from the last build
│   ├── figures/                     report-ready PNGs (figures/app/: web app screenshots)
│   └── html/                        notebooks as HTML (open in any browser)
└── tests/
    ├── test_preprocessing.py     leakage, split, API parity, missing values, targets
    ├── test_modelling.py         probabilities, family aggregation, resampling, selection
    ├── test_insights.py          skill gap, salary peer groups, AI outlook, insights.json up to date
    └── test_api.py               web API over HTTP: responses, validation, training/serving parity
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install -e .
```

Download the 2025 survey from https://survey.stackoverflow.co/2025/ (or unzip the archive the
group already has) and place `survey_results_public.csv` and `survey_results_schema.csv`
in `data/raw/`.

```bash
python scripts/build_dataset.py      # all preprocessing outputs (~15 s)
pytest -q                            # 107 checks (data, model, insights, web API)
bash scripts/run_notebooks.sh        # re-execute notebooks and refresh HTML + figures
```

The processed data and the trained model are committed, so nothing above is needed just to
use the model.

One check, `test_every_survey_country_maps_to_a_region`, needs the raw survey CSV and is
skipped until you download it into `data/raw/`. The other 106 pass from a clean clone.

## Reproducing the modelling

```bash
python scripts/run_models.py         # Stage 6: 7 candidates, 5-fold CV      (~29 min)
python scripts/tune_models.py        # Stage 7: experiment phases A-D        (~41 min)
python scripts/finalise_model.py     # final fit + the ONE test evaluation   (~12 s)
python scripts/build_report_pdf.py   # rebuild the report PDF from the results
```

Each script is independent and re-runnable. `tune_models.py --only A B` re-runs single
phases. Every run appends to `reports/model_experiments.csv` with a timestamp, so the
experiment record grows rather than being overwritten.

`finalise_model.py` is the only script that opens `data/processed/test.parquet`, and it runs
once, after the model has been chosen. Running it repeatedly while changing the model would
turn the test split into a second validation set and the final numbers would stop being an
honest estimate.

## How the models compare

5-fold cross-validation on the training split; the last column is the one model that was
then evaluated on the held-out split.

| Model | Baseline macro-F1 | Tuned | Test |
|---|---:|---:|---:|
| **Logistic Regression** | 0.2547 | **0.3030** | **0.2845** |
| Hist Gradient Boosting | 0.2724 | 0.2860 | — |
| Random Forest | 0.2537 | 0.2820 | — |
| Linear SVM (calibrated) | 0.1911 | 0.2536 | — |
| Complement Naive Bayes | 0.1786 | not tuned | — |
| k-Nearest Neighbours | 0.1676 | not tuned | — |
| Dummy (majority class) | 0.0283 | — | — |

Three findings worth knowing before you touch this code:

1. **`class_weight="balanced"` hurts Logistic Regression here.** Removing it gained 0.047
   macro-F1, more than any hyper-parameter. It *helps* Random Forest. Do not add it back
   without re-running Phase A.
2. **Tuning changed the winner.** Boosting led before optimisation, Logistic Regression
   after. Tuning only the leading baseline would have shipped the wrong model.
3. **The dominant error is imbalance, not role overlap.** All eight largest confusions cross
   family boundaries and point at Full-stack, which is 39% of the training data.

## Key numbers

| | |
|---|---|
| Raw file | 49,123 responses x 170 columns |
| Usable after cleaning | 43,242 (5,794 near-empty, 87 straight-lined removed; all 1,535 duplicates were near-empty) |
| Recommender cohort | 23,072 respondents, 20 job roles, 12 role families |
| Train / test | 18,457 / 4,615, stratified on job role (max proportion gap 0.02 points) |
| Model features | 479 (core set), 506 with optional job-context features |
| Salary reference | 15,545 respondents after the two-stage outlier rule |
| Class imbalance | Full-stack 7,279 vs UX/UI 47 — about 155:1 |
| Experiments recorded | 26 cross-validation runs in `reports/model_experiments.csv` |
| Validation | `StratifiedKFold(5, shuffle=True, random_state=42)` throughout |

## Adding a new model

`skillpath.modelling` already wires up the preprocessing, the validation strategy and the
ten metrics, so a new candidate is a few lines:

```python
from sklearn.ensemble import ExtraTreesClassifier
from skillpath import modelling as M

X, y = M.load_train()                      # training split only; never load_test() here

pipe = M.make_pipeline(ExtraTreesClassifier(n_estimators=400, random_state=42))
row = M.run_cv("Extra Trees", pipe, X, y)  # 5-fold CV, all ten metrics
M.append_results([row])                    # record it in reports/model_experiments.csv

print(row["f1_macro"], row["top3_accuracy"], row["family_f1_macro"])
```

Two rules the helpers exist to enforce:

* **The preprocessor goes inside the estimator.** `make_pipeline()` does this for you, so
  every CV fold refits the vocabulary, rare pooling, imputation medians and scaler on its own
  training part. Fitting the preprocessor once on all training data leaks every validation
  fold into its own features.
* **Anything that resamples or selects features also goes inside the estimator**, for the
  same reason — see `M.OversampledClassifier` and `M.select_kbest_pipeline`.

Your candidate must support `predict_proba`: the app ranks three roles and sums them into
families, so a model without probabilities cannot be deployed whatever it scores.

Do not touch `data/processed/test.parquet`. `features_core_train.parquet` is only for quick
exploration, not for cross-validation.

## Web API (Stage 9)

```bash
python scripts/build_app_tables.py   # artifacts/insights.json (only after build_dataset.py or finalise_model.py)
uvicorn app.main:app --reload        # then open http://127.0.0.1:8000/docs to try it
```

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | the service is up and the model is loaded |
| `GET /api/options` | every valid answer (`artifacts/options.json`); the form is built from it |
| `POST /api/predict` | profile in; top-3 job roles with AI outlook, salary and skill gap, top-3 families, all 20 roles ranked |

```
app/main.py      FastAPI app: loads the model once at startup, 3 endpoints, readable 422 errors
app/schemas.py   request validation against options.json, response models (shown in /docs)
app/service.py   profile -> profile_to_frame() -> model.joblib -> top-3 + insights + caveats
src/skillpath/insights.py   AI outlook per job role, salary peer-group fallback, skill gap, low-confidence flag
```

Request (every field optional; a skipped field is "unknown", `"none": true` is "I don't use any"):

```json
{"country": "Sri Lanka", "years_code": 5, "work_exp": 1,
 "tech": {"Language": {"have": ["Python", "SQL"], "want": ["Rust"]}, "Webframe": {"none": true}},
 "ai": {"AISelect": "Yes, I use AI tools daily"}}
```

Each of the three roles in the response carries its probability, family, description, a
`low_confidence` flag, the role's **AI outlook** (AI Exposure Index now and expected, % who see AI
as a threat, with the all-roles average), a **salary benchmark** (median and interquartile
range of the most specific peer group with 30+ people, and which group that was) and a **skill
gap**: up to five of the role's distinctive technologies the user has not used yet. Distinctive
means used by at least 20% of the role (and 10+ people) and at least 1.1 times as often as across
all roles, ranked by share x log2(lift), from the training split only; AI models and Stack
Overflow tags are left out because they are not skills to learn. `ranking` lists all 20 roles so
the web app can compare two sets of answers.

How the backend stays faithful to training:

* **No preprocessing is reimplemented.** The validated profile goes through `profile_to_frame()`
  into the saved Pipeline. 990 real training rows sent through HTTP give the same probabilities as
  the direct model call; the only exception is a row whose work experience was blanked in cleaning
  (see the next point).
* **Blank work experience means 0** when years coding is given, the survey's own instruction and
  the rule `clean_experience()` applied in training.
* **Validation mirrors the cleaning rules:** values must be in `options.json`, years 0-60 (the
  cleaning ceiling when age is unknown; the app does not ask for age), and ticking 90%+ of a
  technology list is rejected, as straight-lined survey answers were.
* **Low confidence:** seven roles the model picks first for under 1 in 10 of their real members on
  the test split (recall < 0.10), including the two never predicted (`AI apps`, `UX/UI`; 116 and
  47 training examples) are flagged rather than hidden.
* **Insights exclude test respondents** and contain group summaries only; the deployed app needs
  `artifacts/` and the package, not `data/`. No user input is stored or logged.
* Pin the scikit-learn version the model was saved with; the service logs a warning if it differs.

## Web app (Stage 10)

A step-by-step form (About you, Technologies, AI usage) and a results page, in React +
TypeScript with Material UI. It runs as a second server next to the API; Vite forwards `/api`
calls to uvicorn, so the backend needs no CORS setup. Node.js 20 or newer is needed once, for
`npm install`.

```bash
# terminal 1, project root
source venv/bin/activate
uvicorn app.main:app --reload

# terminal 2
cd frontend
npm install                          # first time only
npm run dev                          # then open http://localhost:5173
```

`npm run build` type-checks and builds to `frontend/dist/` (git-ignored); `npm run preview`
serves that build on the same port with the same `/api` forwarding. To point the app at an API
on another address, set `SKILLPATH_API`, e.g. `SKILLPATH_API=http://127.0.0.1:8001 npm run dev`.

What the app does:

* **Form built from `GET /api/options`**, so it only offers values the model was trained on.
  Every question is optional, as in the survey. Each technology area has "used in the past
  year", "want to work with next year" and "I don't use any" (none for Stack Overflow tags,
  which had no such question).
* **Validation in two layers.** The browser checks the same rules as the API (years 0-60,
  country from the list, no ticking 90%+ of a list) before sending. Any 422 from the API is
  shown on the field it names and the form jumps to that step.
* **Results:** three role cards (match %, description, low-confidence badge, AI outlook against
  the all-roles average, salary median and middle half with the peer group it came from, and the
  skill gap); career families; the API's caveat notes; all 20 roles; model accuracy and the ODbL
  attribution.
* **What if...?** Press + next to a suggested skill, or "Change answers", and the app re-runs and
  shows a before/after table of the job roles with the changes listed.
* **Print / save as PDF** prints only the results, always in light colours (also for Ctrl/Cmd+P
  in dark mode). **Dark mode** follows the system setting; the header button switches it.
* **Try an example:** four sample profiles for the demo (Sri Lankan CS undergrad, Data/ML-leaning
  graduate, Mobile developer, Career switcher), defined in `frontend/src/samples.ts`.
* **Motion and feedback:** one set of easing curves and durations (`frontend/src/motion.ts`)
  drives both MUI's own transitions and the app's CSS animations, all under 300 ms and only on
  `transform`/`opacity`. Wizard steps slide in the direction of travel, the role cards stagger
  in, and the what-if panel expands instead of pushing the cards. Busy indicators wait 200 ms,
  so a normal ~15 ms prediction never flickers. With "reduce motion" turned on, movement
  becomes a plain fade.

```
frontend/src/api/        types mirroring app/schemas.py, fetch client (422 -> field errors)
frontend/src/form.ts     form state <-> API profile, client validation, what-if differences
frontend/src/questions.ts  question wording from the 2025 questionnaire
frontend/src/components/   wizard steps, role card, what-if panel, results page
frontend/src/theme.ts      colours, type, surfaces and component styles (light and dark)
frontend/src/motion.ts     easing and duration tokens, delayed busy flag, view transition
frontend/src/index.css     entrance keyframes, reduced motion, print rules
```

## Testing (Stage 11)

Five levels, 178 automated tests, all passing. The full write-up, with every test case, the
results, performance figures and the defects found and fixed, is in
[`reports/testing.md`](reports/testing.md).

| Level | Where | Run | Tests |
|---|---|---|---:|
| Data and model (unit) | `tests/test_preprocessing.py`, `tests/test_modelling.py` | `pytest -q` | 36 |
| Insights (unit) | `tests/test_insights.py` | `pytest -q` | 30 |
| Web API (integration) | `tests/test_api.py` | `pytest -q` | 41 |
| Web app (unit) | `frontend/src/*.test.ts` | `cd frontend && npm test` | 56 |
| Whole app in Chrome (system) | `frontend/e2e/run.mjs` | `cd frontend && npm run e2e` | 15 |

The browser test needs both servers running (`uvicorn app.main:app` and `npm run dev`) and
Google Chrome (set `CHROME_PATH` if it is not in the usual place). It saves a screenshot of every
screen to `frontend/e2e/shots/`; the copies used in the report are in `reports/figures/app/`.

`test_committed_insights_json_is_up_to_date` fails when code that feeds `artifacts/insights.json`
changed without rebuilding it. Run `python scripts/build_app_tables.py` and restart uvicorn.

## Data licence and attribution

Stack Overflow. (2025). *Stack Overflow Annual Developer Survey 2025* [Data set].
Stack Exchange, Inc. https://survey.stackoverflow.co/2025/

The survey data is made available under the Open Database License (ODbL) v1.0
(https://opendatacommons.org/licenses/odbl/1-0/); individual contents under the Database
Contents License. Derived datasets in `data/processed` and `data/reference` are shared under
the same licence, and the web app must show the attribution line from `options.json`.
