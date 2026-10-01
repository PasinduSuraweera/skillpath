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
# # 04 · Model development
#
# **SkillPath** (IT3051 Fundamentals of Data Mining, group KND_12)
#
# Stage 6. Seven candidate estimators — one baseline and six learning algorithms — are
# cross-validated on the training split and compared on metrics chosen for an imbalanced
# 20-class problem.
#
# As in Stage 4, the code lives in the `skillpath` package (`src/skillpath/modelling.py`)
# and `scripts/run_models.py` runs the whole comparison in one go. This notebook reads the
# results that script wrote and explains them. That split exists so the web backend, the
# scripts and the notebooks can never drift apart.
#
# ```
# python scripts/run_models.py          # produces everything read below (~8 min)
# ```
#
# **The test split is not opened anywhere in this notebook.** Every number here is a
# 5-fold cross-validated estimate on the 18,457 training respondents.

# %%
import json

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from skillpath import config as C
from skillpath import modelling as M
from skillpath import targets, viz

viz.setup()
pd.set_option("display.width", 200, "display.max_columns", 50)

comparison = pd.read_csv(C.REPORTS_DIR / "stage6_model_comparison.csv")
per_class = pd.read_csv(C.REPORTS_DIR / "stage6_per_class_report.csv")
report = json.loads((C.REPORTS_DIR / "stage6_report.json").read_text())
report["training_rows"], report["job_roles"], report["validation"]

# %% [markdown]
# ## 1 · What is being predicted, and what makes it hard
#
# The target is the specific **JobRole** (20 classes). A role family's probability is the
# sum of the probabilities of the job roles inside it, so one model serves both levels of
# the recommendation (`skillpath.targets.family_proba`).
#
# Two properties of the target drive every modelling decision that follows:
#
# 1. **Severe imbalance.** Full-stack is 39.4% of the training rows; UX/UI Designer is 47
#    rows, a ratio of about 155:1.
# 2. **Genuinely overlapping classes.** Cloud Infrastructure and DevOps engineers had a
#    cosine similarity of 0.99 on their technology profiles in the EDA. No model can
#    separate them reliably, because the underlying respondents are not separable.
#
# Together these mean a single predicted label would be the wrong product. The app shows
# the **top three** roles with probabilities plus the family total, which is why top-3
# accuracy is reported alongside macro-F1 throughout.

# %%
train = pd.read_parquet(C.PROCESSED_DIR / "train.parquet")
counts = train[C.TARGET_JOB].value_counts()
fig, ax = plt.subplots(figsize=(7.5, 5))
viz.barh(ax, [C.JOB_ROLE_LABEL.get(i, i) for i in counts.index], counts.to_numpy())
ax.set_title(f"Training examples per job role (imbalance ratio {counts.max() / counts.min():.0f}:1)")
ax.set_xlabel("respondents in the training split")
plt.show()

# %% [markdown]
# ## 2 · Validation strategy
#
# `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)` on the training split.
#
# * **Stratified**, because with 47 examples in the smallest class an unstratified fold
#   could contain almost none of it and the macro-F1 of that fold would be meaningless.
# * **5 folds**, because the smallest class then still contributes about 9 respondents per
#   fold. Ten folds would leave four, which is too few to estimate a per-class F1; three
#   folds would hold back more training data than the rare roles can spare.
# * **The preprocessor is inside every estimator.** Each candidate is
#   `Pipeline([("prep", build_preprocessor()), ("clf", ...)])`, so each fold refits the
#   technology vocabulary, the rare-category pooling, the imputation medians, the scaler
#   and the variance filter on that fold's training part only. Fitting the preprocessor
#   once on the full training set would let every validation fold influence its own
#   features and would inflate every score below.

# %%
print(M.cv())
print(M.make_pipeline(M.candidates()["Logistic Regression"]["pipeline"].named_steps["clf"]))

# %% [markdown]
# ## 3 · The candidates and why each one is here
#
# At least four algorithms are required; seven are run. They were chosen to span different
# **inductive biases** rather than to be seven variations of one idea, and all of them had
# to satisfy one product constraint:
#
# > The app ranks three roles and sums probabilities into families, so every candidate must
# > produce usable `predict_proba`. This is why `LinearSVC` appears wrapped in
# > `CalibratedClassifierCV` — a bare SVM has no probabilities and could not be deployed
# > whatever it scored.

# %%
for name, spec in M.candidates().items():
    print(f"{name}  [{spec['family']}]\n    {spec['why']}\n")

# %% [markdown]
# ## 4 · Metrics, and why accuracy is not one of them
#
# | Metric | Level | Why it is reported |
# |---|---|---|
# | **macro-F1** | job role | **Primary.** Averages F1 over the 20 roles with equal weight, so ignoring UX/UI is penalised as much as ignoring Full-stack |
# | balanced accuracy | job role | Mean per-class recall: "does it find each role at all" |
# | top-3 accuracy | job role | What the user actually sees — the app shows three roles |
# | log loss | job role | Are the probabilities themselves trustworthy? The app displays them as numbers |
# | family macro-F1 | family | The coarser recommendation, from the same summed probabilities |
# | family top-3 accuracy | family | The career-path shortlist the app shows |
# | accuracy | job role | Reported only to show it is **misleading** |
#
# The Dummy row is the argument. It always predicts Full-stack, knows nothing, and still
# scores about 0.39 accuracy — higher than some real models. Macro-F1 exposes it immediately.

# %%
M.summary(comparison)

# %% [markdown]
# ![model comparison](../reports/figures/04_model_comparison.png)
#
# ![accuracy vs f1](../reports/figures/04_accuracy_vs_f1.png)

# %% [markdown]
# ## 5 · Reading the results
#
# The cells below pull the actual numbers out of the results table so the commentary cannot
# drift away from the experiment.

# %%
c = comparison.set_index("model")
dummy = c.loc["Dummy (most frequent)"]
best = comparison.iloc[0]

print(f"Baseline (always Full-stack): accuracy {dummy['accuracy']:.3f} but macro-F1 {dummy['f1_macro']:.3f}")
print(f"Best model               : {best['model']}")
print(f"  macro-F1   {best['f1_macro']:.4f} +/- {best['f1_macro_std']:.4f}")
print(f"  top-3      {best['top3_accuracy']:.4f}   (family top-3 {best['family_top3_accuracy']:.4f})")
print(f"  accuracy   {best['accuracy']:.4f}")
print(f"\nMacro-F1 improvement over the baseline: {best['f1_macro'] / dummy['f1_macro']:.1f}x")

# %% [markdown]
# ### Why the models rank the way they do
#
# * **Dummy** fixes the floor and proves the metric choice. Any model that cannot beat
#   0.39 accuracy *and* a near-zero macro-F1 has learned nothing.
# * **Complement Naive Bayes** is fast and far better than chance, but its independence
#   assumption is plainly false here: React implies JavaScript, Kubernetes implies Docker.
#   It treats each co-occurring technology as fresh evidence and becomes over-confident.
# * **k-Nearest Neighbours** tests the product's own intuition — similar skill profiles,
#   similar job. It works, but 479 dimensions is a hostile neighbourhood: with mostly 0/1
#   features, distances between all pairs become similar and the neighbourhood stops being
#   local. Cosine distance and distance weighting soften this rather than fix it.
# * **Logistic Regression** does well because the problem genuinely is close to linear in
#   this representation: each technology shifts the odds of each role roughly
#   independently, which is exactly what a softmax over 479 sparse indicators models. Its
#   coefficients are also readable, which matters for the presentation.
# * **Linear SVM** optimises margins instead of likelihood and lands nearby; the Platt
#   calibration costs it some probability quality (visible in log loss).
# * **Random Forest** and **Hist Gradient Boosting** can represent *combinations*
#   (Terraform AND Kubernetes AND Python → AI/ML engineer) that no linear model can.
#   Boosting takes the top macro-F1 because each round focuses on what the previous rounds
#   got wrong, which is exactly where the rare roles live — but it costs 179 s a fit
#   against Random Forest's 4.3 s for 0.019 macro-F1.
#
# The spread between the best three models (0.2537, 0.2547, 0.2724) is small next to the
# fold-to-fold standard deviations (0.008, 0.003, 0.010). That is itself the finding: the
# ceiling here is set by the **data**, not by the choice of algorithm. The error analysis
# below says what sets it.

# %% [markdown]
# ## 6 · Where the errors are
#
# Out-of-fold predictions from the best model, so every prediction comes from a fold that
# did not see that respondent.

# %%
per_class.assign(job_role=lambda d: d["job_role"].map(lambda r: C.JOB_ROLE_LABEL.get(r, r)))[
    ["job_role", "family", "precision", "recall", "f1-score", "support"]].round(3)

# %% [markdown]
# ![per class f1](../reports/figures/04_per_class_f1.png)
#
# ![confusion matrix](../reports/figures/04_confusion_matrix.png)

# %%
conf = pd.DataFrame(report["top_confusions"])
conf["actual"] = conf["actual"].map(lambda r: C.JOB_ROLE_LABEL.get(r, r))
conf["predicted_as"] = conf["predicted_as"].map(lambda r: C.JOB_ROLE_LABEL.get(r, r))
conf

# %%
same = conf["same_family"].mean()
sink = conf["predicted_as"].value_counts()
print(f"{same:.0%} of the largest confusions are between roles in the SAME family.")
print(f"\nWhere the lost respondents go:\n{sink.to_string()}")

# %% [markdown]
# ### This is not the error pattern we expected
#
# The EDA predicted the damage would be *within* families — Cloud Infrastructure confused
# with DevOps, Data Engineer with Data Scientist, because those pairs have cosine
# similarity 0.99 and 0.97. The out-of-fold confusions say something different and more
# important:
#
# **Almost every large confusion points at Full-stack, across family boundaries.** 60% of
# UX/UI respondents, 56% of front-end developers, 50% of AI-apps developers and 48% of
# system administrators are predicted as Full-stack. These are not neighbouring roles with
# similar skills; Full-stack is simply 39% of the training data and acts as a sink that
# swallows anything the model is unsure about.
#
# So the dominant failure is **imbalance, not role overlap**. The within-family overlap is
# real and shows up further down the matrix, but it is the second-order problem. That
# changes the priority for Stage 7: class weighting and resampling matter more than any
# hyper-parameter, and this is why Phase A is the first experiment rather than a
# formality.
#
# It also explains the strange shape of the results table. Logistic Regression has the
# *best* balanced accuracy (0.332) while having a low plain accuracy (0.366), because
# `class_weight="balanced"` pushes it to predict rare roles and it accepts many false
# positives on Full-stack to do so. Hist Gradient Boosting does the reverse: higher
# accuracy (0.560) and top-3 (0.829), lower balanced accuracy (0.248). The two models are
# making a genuinely different trade, and which one is "better" depends on whether the
# product would rather name the right rare role or be right more often overall.

# %% [markdown]
# ### Observations that drive Stage 7
#
# 1. **Class size predicts per-class F1 almost monotonically.** The rare roles are the
#    whole macro-F1 problem, so imbalance handling is the first optimisation experiment.
# 2. **Full-stack is a sink.** The largest confusions cross family boundaries and all point
#    at the majority class, so this is an imbalance problem before it is an overlap problem.
# 3. **Top-3 accuracy is far above top-1 accuracy** (0.83 vs 0.56 for the best model). The
#    decision to show three roles is supported by the numbers, not just by taste.
# 4. **The top models are separated by less than the fold noise.** Logistic Regression and
#    Random Forest differ by 0.001 macro-F1 with fold SDs of 0.003 and 0.008. Stage 7 must
#    treat near-ties as ties and break them on something other than the third decimal.
# 5. **Cost varies by a factor of 40.** Random Forest fits in 4.3 s, Hist Gradient Boosting
#    in 179 s, for 0.019 macro-F1. That gap is what the final selection rule trades against.
#
# These become phases A–D of `scripts/tune_models.py`, continued in `05_optimization`.

# %% [markdown]
# ## 7 · Experiment record
#
# Every cross-validation run in the project appends to `reports/model_experiments.csv`
# with a timestamp — the lab notebook Stage 6 asks for.

# %%
log = pd.read_csv(C.REPORTS_DIR / "model_experiments.csv")
print(f"{len(log)} runs recorded")
log[["run_at", "model", "note", "f1_macro", "top3_accuracy", "total_seconds"]].tail(10)
