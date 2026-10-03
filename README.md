# SkillPath

**An AI-aware developer job role and career path recommendation system.**
IT3051 Fundamentals of Data Mining, Mini Project 2026, group KND_12, SLIIT Kandy Uni.

| Member | Registration number |
|---|---|
| S S P S Bandara | IT23602250 |
| Yoosuf A.A | IT23645202 |
| M G S D Wijesinghe | IT23564640 |
| K M H S Bandara | IT23792418 |

**Prediction target:** the specific job role (20 classes, e.g. Data Engineer, DevOps Engineer,
AI / ML Engineer). Each job role belongs to one of 12 role families; a family's probability is the
sum of its job roles' probabilities (`skillpath.targets`), so one model gives the top-3 job roles
and the top families.

Status: **Stages 3-4 (EDA, preprocessing) and Stages 6-7 (modelling, optimisation) complete.**
Next: the web app (Stages 9-10).

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
│   ├── viz.py                chart style
│   └── resources/country_region.csv
├── scripts/
│   ├── build_dataset.py      runs the whole preprocessing and writes all outputs (~15 s)
│   ├── run_models.py         Stage 6: compares the 7 candidates (~29 min)
│   ├── tune_models.py        Stage 7: experiment phases A-D (~41 min)
│   ├── finalise_model.py     fits the chosen model, opens the test split ONCE
│   ├── build_report_pdf.py   rebuilds the technical report PDF from the result files
│   └── run_notebooks.sh      executes the notebooks and exports HTML copies
├── notebooks/                01 data understanding, 02 EDA, 03 preprocessing,
│                             04 modelling + optimisation (Stage 6 and 7 in one)
│                             (.py = source, .ipynb = executed with outputs)
├── data/
│   ├── raw/                  put the Stack Overflow files here (not committed, 140 MB)
│   ├── processed/            train/test rows, split IDs, transformed feature matrices
│   └── reference/            AI exposure, persona and salary datasets
├── artifacts/
│   ├── model.joblib          THE final fitted Pipeline (preprocessor + classifier)
│   ├── model_card.json       what it is, how it scores, what it must not be used for
│   ├── preprocessor_core.joblib, feature_names_core.json
│   └── options.json          every valid form value, for building the web form
├── reports/
│   ├── modelling_decisions.md       Stages 6-7: results, experiments + viva Q&A  <- start here
│   ├── preprocessing_decisions.md   Stages 3-4: every decision with evidence + viva Q&A
│   ├── SkillPath_Stage6-8_Report.pdf  20-page technical report (regenerate with the script)
│   ├── model_experiments.csv        every cross-validation run in the project, timestamped
│   ├── stage6_*.csv / .json         comparison, per-class report, confusion matrix
│   ├── stage7_*.csv / .json         each phase, search results, final selection, test results
│   ├── feature_dictionary.csv       all 479 model features, source and transformation
│   ├── build_report.json            counts from the last build
│   ├── figures/                     report-ready PNGs
│   └── html/                        notebooks as HTML (open in any browser)
└── tests/
    ├── test_preprocessing.py     leakage, split, API parity, missing values, targets
    └── test_modelling.py         probabilities, family aggregation, resampling, selection
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
pytest -q                            # 36 checks
bash scripts/run_notebooks.sh        # re-execute notebooks and refresh HTML + figures
```

The processed data and the trained model are committed, so nothing above is needed just to
use the model.

One of the 36 checks, `test_every_survey_country_maps_to_a_region`, needs the raw survey CSV
and fails until you download it into `data/raw/`. The other 35 pass from a clean clone.

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

## Using it in the web backend

```python
import joblib
from skillpath import targets
from skillpath.profile import profile_to_frame
from skillpath.pipeline import model_input_columns

model = joblib.load("artifacts/model.joblib")   # final Pipeline(prep + classifier)

row = profile_to_frame(request_json)[model_input_columns()]
probs = model.predict_proba(row)[0]
job_roles = targets.top_k(probs, model.classes_, k=3)          # label, family, description
families = targets.top_k_families(probs, model.classes_, k=3)  # summed job-role probabilities
```

* `artifacts/options.json` holds every valid form value; build the form from it.
* A section the user skips is treated as "unknown"; ticking "I don't use any" is a true zero,
  exactly like the survey's gate questions in training.
* Deploy the package and the artifacts only, never the raw survey file. Store no user input.
* Pin the same scikit-learn version the model was saved with (see `requirements.txt`).
* `profile_to_frame()` is the API contract and is verified: 300 real rows sent through the
  web request format give predictions identical to the training path (max probability
  difference exactly 0.0). Do not reimplement any preprocessing in the backend.

**Two roles are never predicted.** `Developer, AI apps or physical AI` and
`UX, Research Ops or UI design` score F1 0.000 on the held-out split — there are only 116 and
47 training examples. The UI should either drop them from the possible outputs or mark them
as low confidence. Full limitations are in `artifacts/model_card.json`.

## Data licence and attribution

Stack Overflow. (2025). *Stack Overflow Annual Developer Survey 2025* [Data set].
Stack Exchange, Inc. https://survey.stackoverflow.co/2025/

The survey data is made available under the Open Database License (ODbL) v1.0
(https://opendatacommons.org/licenses/odbl/1-0/); individual contents under the Database
Contents License. Derived datasets in `data/processed` and `data/reference` are shared under
the same licence, and the web app must show the attribution line from `options.json`.
