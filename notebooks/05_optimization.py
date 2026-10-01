# ---
# jupyter:
#   jupytext:
#     text_representation:
#       extension: .py
#       format_name: percent
#   kernelspec:
#     display_name: Python 3
#     language: python
#     name: python3
# ---

# %% [markdown]
# # 05 · Model optimisation and final model selection
#
# **SkillPath** (IT3051 Fundamentals of Data Mining, group KND_12)
#
# Stage 7. Four experiment phases, then the final model is chosen, fitted on the whole
# training split and evaluated **once** on the held-out respondents.
#
# | Phase | Question | Script |
# |---|---|---|
# | A | Does handling the 155:1 imbalance help, and how? | `tune_models.py --only A` |
# | B | Do the Stage 4 preprocessing and feature choices earn their place? | `--only B` |
# | C | What do the hyper-parameters buy? | `--only C` |
# | D | Tuned vs baseline — which model ships? | `--only D` |
# | — | Fit it, open the test split once | `finalise_model.py` |
#
# ```
# python scripts/tune_models.py        # phases A-D, appends to reports/model_experiments.csv
# python scripts/finalise_model.py     # final fit + the one test evaluation
# ```
#
# Phases A–C never touch `test.parquet`. Only `finalise_model.py` opens it, and only after
# the model has been chosen.

# %%
import json

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from skillpath import config as C
from skillpath import modelling as M
from skillpath import viz

viz.setup()
pd.set_option("display.width", 220, "display.max_columns", 60)


def read(name):
    p = C.REPORTS_DIR / name
    return pd.read_csv(p) if p.exists() else None


stage6 = read("stage6_model_comparison.csv")
phase_a = read("stage7_a_imbalance.csv")
phase_b = read("stage7_b_features.csv")
phase_c = read("stage7_c_tuned.csv")
phase_d = read("stage7_d_tuned_vs_baseline.csv")
best_params = json.loads((C.REPORTS_DIR / "stage7_best_params.json").read_text())
decision = json.loads((C.REPORTS_DIR / "stage7_final_selection.json").read_text())

# %% [markdown]
# ## Phase A · Imbalance handling
#
# Stage 6 showed per-class F1 tracking class size almost monotonically, so this is the
# first thing to attack. Three treatments, tested on two different algorithms so the answer
# is not an artefact of one of them:
#
# 1. **Nothing** — the untouched 155:1 distribution.
# 2. **`class_weight`** — re-weight the loss so an error on a rare role costs as much as an
#    error on Full-stack. Free: no extra rows.
# 3. **Random oversampling to 10%** — duplicate real respondents until every role reaches at
#    least 10% of Full-stack's size.
#
# **SMOTE was considered and rejected.** It builds synthetic rows by interpolating between
# neighbours; 403 of the 479 features are 0/1 skill flags, so an interpolated row says a
# respondent "0.4 knows React", which is not a skill profile anybody could have. Duplicating
# real respondents keeps every training row valid.
#
# **Full balancing was rejected on cost**, not on principle: it copies the 47 UX/UI
# respondents 155 times each and grows the training set to 145,580 rows, over an hour per
# fit here.
#
# The resampling lives *inside* the estimator (`modelling.OversampledClassifier`), so it
# runs on each fold's training part only. Oversampling before the split is a classic leak —
# copies of the same respondent land in both training and validation, and the score rises
# for no real reason.

# %%
phase_a[["model", "f1_macro", "f1_macro_std", "balanced_accuracy", "accuracy",
         "top3_accuracy", "family_f1_macro", "fit_seconds"]].round(4)

# %% [markdown]
# ## Phase B · Feature set and feature selection
#
# Each row changes exactly one Stage 4 decision and keeps everything else fixed, run on
# Logistic Regression because a linear model reacts most visibly to the feature set.
#
# * **want lists removed** — are "technologies I want to learn" worth their 223 columns, or
#   are they just a noisy copy of what people already use? (EDA found phi 0.18–0.76 between
#   the pairs, so they are related but not duplicates.)
# * **rare pooling at 0.25% / 1%** — the Stage 4 threshold was 0.5%.
# * **SelectKBest chi² k ∈ {100, 200, 300, all}** — selection sits inside the pipeline, so
#   the k best features are chosen from each fold's training part. Selecting once on the
#   full training set is the single most common way to leak in a project like this: the
#   features are chosen using labels the validation fold is meant to be testing.
# * **core+context** — adds OrgSize, Industry, RemoteWork and ICorPM. Stage 4 kept these out
#   by default because students, the main users, have no current employer to describe.

# %%
phase_b[["model", "note", "f1_macro", "f1_macro_std", "top3_accuracy",
         "family_f1_macro", "fit_seconds"]].round(4)

# %%
if phase_b is not None:
    ref = phase_b.loc[phase_b["model"] == "core (reference)", "f1_macro"].iloc[0]
    sd = phase_b.loc[phase_b["model"] == "core (reference)", "f1_macro_std"].iloc[0]
    d = phase_b.assign(delta=lambda x: x["f1_macro"] - ref)
    d = d[["model", "f1_macro", "delta"]].sort_values("delta", ascending=False).round(4)
    print(f"Reference: core, macro-F1 {ref:.4f} (fold SD {sd:.4f})\n")
    print(d.to_string(index=False))
    print(f"\nChanges smaller than the fold SD ({sd:.4f}) are noise, not improvements.")

# %% [markdown]
# ### How to read Phase B
#
# The honest reading is that a difference smaller than the cross-validation standard
# deviation is not a difference. Where a variant ties with the reference, the Stage 4
# decision stands — and that is a result worth reporting, because it says the preprocessing
# was already at a sensible point rather than that the experiment failed.
#
# `core+context` is a special case: even if it scores higher, it is **not** adopted, because
# the app's main users are students who cannot answer OrgSize or Industry. A model that
# needs inputs the user does not have is worse in production than a slightly weaker model
# that works. This is the train/serve mismatch the Stage 4 decision log flagged as risk 21.

# %% [markdown]
# ## Phase C · Hyper-parameter search
#
# **Randomised search, not grid search.** A grid over five hyper-parameters with four values
# each is 1,024 fits per model; at 6–25 seconds a fit that is days of compute. Random search
# over the same ranges finds a near-best setting in a few dozen fits, because typically only
# two or three parameters matter and random sampling tries many distinct values of each
# instead of a few repeated ones.
#
# The search optimises **macro-F1**, the primary metric, with the same `StratifiedKFold`.
# Boosting is searched over 3 folds instead of 5 purely for cost; the winning setting is
# then re-scored over the standard 5 folds so every number in the final table is comparable.

# %%
for model, params in best_params.items():
    print(f"{model}\n    {params}")

# %%
phase_c[["model", "f1_macro", "f1_macro_std", "balanced_accuracy", "top3_accuracy",
         "log_loss", "family_f1_macro", "family_top3_accuracy", "fit_seconds"]].round(4)

# %% [markdown]
# ## Phase D · Tuned vs baseline, and the final decision

# %%
phase_d.round(4)

# %% [markdown]
# ![tuned vs baseline](../reports/figures/05_tuned_vs_baseline.png)

# %%
print("Selection rule:\n ", decision["selection_rule"], "\n")
print("Best by macro-F1 :", decision["best_by_f1_macro"])
print("Tied within 1 SD :", ", ".join(decision["tied_within_1sd"]))
print("FINAL MODEL      :", decision["final_model"])
print("\nCross-validated scores of the final model:")
for k, v in decision["final_cv_scores"].items():
    print(f"  {k:<28}{v:>8.4f}")

# %% [markdown]
# ### Why the final model is the final model
#
# The selection rule is written down before the numbers are read, so it cannot be bent to
# fit a favourite:
#
# > Highest 5-fold macro-F1 on the training split. Models **within one standard deviation**
# > of the best are treated as tied, and the cheapest to fit wins.
#
# The tie-break exists because of what Stage 6 found: the gap between the strong models is
# about the size of the fold-to-fold noise. Claiming the top model is "better" when it is
# inside the noise band would be reading randomness. When two models are statistically
# indistinguishable, the one that retrains in seconds and loads quickly in the backend is
# the better engineering choice — and that reasoning, not a third decimal place, is what
# justifies the pick.
#
# Tuning gains in this project are small for every model. That is consistent with the Stage
# 6 finding that the ceiling is set by **overlapping roles**, not by hyper-parameters: no
# setting of `C` separates Cloud Infrastructure from DevOps engineers when their technology
# profiles have a cosine similarity of 0.99.

# %% [markdown]
# ## The one test evaluation
#
# `scripts/finalise_model.py` refits the chosen configuration on all 18,457 training rows
# and scores it on the 4,615 held-out respondents — once. Running it repeatedly while
# changing the model would turn the test split into a second validation set and the number
# would stop meaning anything.

# %%
tp = C.REPORTS_DIR / "stage7_test_results.json"
if tp.exists():
    t = json.loads(tp.read_text())
    rows = [{"metric": k, "cross-validated": t["cv_scores"].get(k), "held-out test": v}
            for k, v in t["test_scores"].items()]
    display(pd.DataFrame(rows).round(4))
    print(f"\nmacro-F1 gap CV -> test: {t['cv_to_test_gap_f1_macro']:+.4f}")
    print(f"API parity: {t['api_parity']['rows_checked']} profiles through the web format, "
          f"max probability difference {t['api_parity']['max_probability_difference']:.2e}")
else:
    print("Run: python scripts/finalise_model.py")

# %% [markdown]
# ![test confusion](../reports/figures/05_test_confusion.png)

# %% [markdown]
# A small gap between the cross-validated estimate and the test score is the thing to look
# for. It means the validation procedure was honest — no leak quietly inflated the CV
# numbers — and that the model generalises to respondents it has never seen.
#
# The **API parity check** is the bridge to Stages 9–10: it takes real training rows,
# converts them into the JSON profile the web form will send, converts them back through
# `profile_to_frame()`, and confirms the predictions are identical to the ones made
# directly. That is what proves the deployed backend preprocesses exactly like the model
# that was validated here.
#
# Outputs for the next stages:
#
# * `artifacts/model.joblib` — the fitted Pipeline the backend loads
# * `artifacts/model_card.json` — what it is, how it scores, and what it must not be used for
# * `reports/model_experiments.csv` — every run in the project, timestamped
