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

**Final model:** Logistic Regression (`C=0.218`, no class weighting) inside the Stage 4
preprocessing pipeline, saved as `artifacts/model.joblib`. On the 4,615 held-out
respondents: **top-3 accuracy 0.839** at job-role level and **0.878** at family level
(macro-F1 0.285, accuracy 0.549). Start at `reports/modelling_decisions.md`.

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
│   └── run_notebooks.sh      executes the notebooks and exports HTML copies
├── notebooks/                01 data understanding, 02 EDA, 03 preprocessing,
│                             04 modelling, 05 optimisation
│                             (.py = source, .ipynb = executed with outputs)
├── data/
│   ├── raw/                  put the Stack Overflow files here (not committed, 140 MB)
│   ├── processed/            train/test rows, split IDs, transformed feature matrices
│   └── reference/            AI exposure, persona and salary datasets
├── artifacts/                fitted preprocessor, feature names, options.json for the web form
├── reports/
│   ├── preprocessing_decisions.md   Stages 3-4: every decision with evidence + viva Q&A
│   ├── modelling_decisions.md       Stages 6-7: results, experiments + viva Q&A  <- start here
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
python scripts/build_dataset.py      # all preprocessing outputs
pytest -q                            # 17 checks should pass
bash scripts/run_notebooks.sh        # re-execute notebooks and refresh HTML + figures
```

The processed data and artifacts are already committed, so modelling can start without
running the build.

## Key numbers

| | |
|---|---|
| Raw file | 49,123 responses x 170 columns |
| Usable after cleaning | 43,242 (5,794 near-empty, 87 straight-lined removed; all 1,535 duplicates were near-empty) |
| Recommender cohort | 23,072 respondents, 20 job roles, 12 role families |
| Train / test | 18,457 / 4,615, stratified on job role (max proportion gap 0.02 points) |
| Model features | 479 (core set), 506 with optional job-context features |
| Salary reference | 15,545 respondents after the two-stage outlier rule |

## Using the preprocessing in Stage 6-7

Always put the **unfitted** preprocessor inside the model pipeline and fit on the raw
training rows. Cross-validation then refits the preprocessing in every fold (no leakage).

```python
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_validate
from skillpath.pipeline import build_preprocessor, model_input_columns

train = pd.read_parquet("data/processed/train.parquet")
X, y = train[model_input_columns()], train["JobRole"]

pipe = Pipeline([
    ("prep", build_preprocessor()),                       # "core" feature set
    ("clf", LogisticRegression(max_iter=2000, class_weight="balanced")),
])
scores = cross_validate(pipe, X, y, cv=StratifiedKFold(5, shuffle=True, random_state=42),
                        scoring=["f1_macro", "balanced_accuracy"])
```

Do not touch `data/processed/test.parquet` until the final model is chosen.
`features_core_train.parquet` is only for quick exploration, not for cross-validation.

## Using it in the web backend

```python
import joblib
from skillpath import targets
from skillpath.profile import profile_to_frame
from skillpath.pipeline import model_input_columns

model = joblib.load("artifacts/model.joblib")   # final Pipeline(prep + classifier), Stage 7

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

## Data licence and attribution

Stack Overflow. (2025). *Stack Overflow Annual Developer Survey 2025* [Data set].
Stack Exchange, Inc. https://survey.stackoverflow.co/2025/

The survey data is made available under the Open Database License (ODbL) v1.0
(https://opendatacommons.org/licenses/odbl/1-0/); individual contents under the Database
Contents License. Derived datasets in `data/processed` and `data/reference` are shared under
the same licence, and the web app must show the attribution line from `options.json`.
