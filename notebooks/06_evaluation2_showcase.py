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
# # 06 · Progress Evaluation 2 showcase (Stages 6-8)
#
# **SkillPath** · IT3051 Fundamentals of Data Mining · group KND_12 · SLIIT Kandy Uni
#
# One notebook to walk the evaluator through everything since Evaluation 1, top to bottom.
# It reads the results written by the scripts (so no 40-minute rerun is needed in the lab),
# and recomputes the key numbers live from the saved model where that takes seconds.
#
# | Part | What it shows | Assignment item |
# |---|---|---|
# | **A** | The processed data, opened and explained (requested at Evaluation 1) | Stage 4 follow-up |
# | **B** | Seven algorithms, why each, validation strategy, metrics, comparison, error analysis | Stage 6 |
# | **C** | Imbalance handling, feature experiments, hyper-parameter search, tuned vs baseline | Stage 7 |
# | **D** | The selection rule and the final model, with justification | Stage 7 |
# | **E** | The one held-out test evaluation, reproduced live from `model.joblib` | Stage 7 |
# | **F** | Live prediction for a sample user, and which skills drive a prediction | bridge to Stages 9-10 |
#
# **Run it:** on Google Colab or locally, `Runtime/Kernel → Restart & Run All`. Everything runs in under a minute (plus about 90 s
# the first time, to write the full feature-matrix Excel file); the raw survey CSV is not needed.

# %% [markdown]
# ### Setup (only does anything on Google Colab)
#
# On Colab this cell downloads the project from GitHub and installs the exact scikit-learn
# version the model was saved with (about 1 minute). On a laptop with the project's virtual
# environment it does nothing.
#
# The repository is private, so Colab needs a read-only GitHub token: click the **key icon**
# in Colab's left sidebar, add a secret named `GITHUB_TOKEN`, and switch on notebook access.

# %%
import os
import subprocess
import sys

IN_COLAB = "google.colab" in sys.modules
REPO = "PasinduSuraweera/skillpath"
BRANCH = "feature/evaluation2-showcase"

if IN_COLAB:
    repo_dir = "/content/skillpath"
    if not os.path.isdir(repo_dir):
        try:
            from google.colab import userdata
            token = userdata.get("GITHUB_TOKEN")
            url = f"https://{token}@github.com/{REPO}.git"
        except Exception:
            url = f"https://github.com/{REPO}.git"   # works only if the repo is public
        clone = subprocess.run(["git", "clone", "-q", "--depth", "1", "-b", BRANCH, url, repo_dir],
                               capture_output=True, text=True)
        if clone.returncode != 0:   # message kept generic so the token is never printed
            raise RuntimeError("Could not download the repository. Check the GITHUB_TOKEN secret "
                               "exists, has notebook access switched on, and can read the repo.")
    subprocess.run([sys.executable, "-m", "pip", "install", "-q",
                    "scikit-learn==1.8.0", "xlsxwriter", "pyarrow"], check=True)
    sys.path.insert(0, f"{repo_dir}/src")
    os.chdir(f"{repo_dir}/notebooks")
    print("Colab setup done:", repo_dir)
else:
    print("Running locally, no setup needed.")

# %%
import json
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from IPython.display import Markdown, display

from skillpath import config as C
from skillpath import modelling as M
from skillpath import targets, viz
from skillpath.profile import profile_to_frame

viz.setup()
pd.set_option("display.width", 220, "display.max_columns", 60, "display.max_colwidth", 60)


def label(role):
    return C.JOB_ROLE_LABEL.get(role, role)


def read_csv(name):
    return pd.read_csv(C.REPORTS_DIR / name)


def read_json(name):
    return json.loads((C.REPORTS_DIR / name).read_text())


# %% [markdown]
# ---
# # Part A · The processed data
#
# At Evaluation 1 the processed data could not be shown because it is stored as Parquet,
# which does not open in Excel or a text editor. **Parquet was a deliberate choice** (it
# keeps column types, so numbers stay numbers and missing values stay missing, and it is
# about 5× smaller than CSV), but it needs code to open. This part opens every file and,
# at the end, exports an Excel copy that can be opened on any laptop.
#
# ## A1 · What is in `data/processed/`

# %%
files = {
    "train.parquet": "Cleaned training respondents (one row per person, survey format)",
    "test.parquet": "Cleaned held-out respondents, same columns, never used for any decision",
    "features_core_train.parquet": "train after the Stage 4 pipeline: the 479 numbers the model sees",
    "features_core_test.parquet": "test after the same fitted pipeline",
    "role_cohort.parquet": "train + test together, used for the app's role statistics",
    "split_ids.csv": "ResponseId → train/test, freezes the 80/20 split",
}
rows = []
for name, what in files.items():
    p = C.PROCESSED_DIR / name
    df = pd.read_csv(p) if p.suffix == ".csv" else pd.read_parquet(p)
    rows.append({"file": name, "rows": len(df), "columns": df.shape[1],
                 "size_MB": round(p.stat().st_size / 1e6, 2), "what it is": what})
pd.DataFrame(rows)

# %% [markdown]
# ## A2 · The cleaned rows (`train.parquet`)
#
# Each row is one developer. Multi-select survey answers keep the survey's own `;`
# separator here; they are turned into 0/1 columns only inside the pipeline, so the same
# pipeline can be applied to a single profile from the web form.

# %%
train = pd.read_parquet(C.PROCESSED_DIR / "train.parquet")
test = pd.read_parquet(C.PROCESSED_DIR / "test.parquet")
X_train, y_train = M.load_train()
model_cols = list(X_train.columns)

print(f"train: {train.shape[0]:,} respondents × {train.shape[1]} columns")
print(f"test : {test.shape[0]:,} respondents × {test.shape[1]} columns")
print(f"columns fed to the model: {len(model_cols)}  (the rest are IDs, the target, and app-only fields)")
train[["ResponseId", C.TARGET_JOB, "RoleFamily"] + model_cols[:8]].head(8)

# %%
summary = pd.DataFrame({
    "dtype": train[model_cols].dtypes.astype(str),
    "non_missing": train[model_cols].notna().sum(),
    "missing_%": (train[model_cols].isna().mean() * 100).round(1),
    "example": train[model_cols].apply(lambda s: s.dropna().iloc[0] if s.notna().any() else None),
})
summary["example"] = summary["example"].astype(str).str.slice(0, 55)
summary

# %% [markdown]
# Missing values are **left missing on purpose** at this stage. The pipeline decides what a
# blank means per column: for a technology block, "skipped the question" becomes an
# `unknown` flag while "ticked I don't use any" is a genuine zero; numeric experience is
# median-imputed *inside each training fold* so no validation row influences the median.

# %% [markdown]
# ## A3 · The split is clean and stratified

# %%
overlap = set(train["ResponseId"]) & set(test["ResponseId"])
print(f"Respondents in both train and test: {len(overlap)}")
print(f"Test share: {len(test) / (len(train) + len(test)):.1%}")

dist = pd.DataFrame({
    "train_%": train[C.TARGET_JOB].value_counts(normalize=True) * 100,
    "test_%": test[C.TARGET_JOB].value_counts(normalize=True) * 100,
    "train_n": train[C.TARGET_JOB].value_counts(),
}).sort_values("train_n", ascending=False)
dist.index = dist.index.map(label)
dist["difference_pp"] = dist["train_%"] - dist["test_%"]
dist.round(2)

# %% [markdown]
# Every role has the same share in train and test (differences are hundredths of a
# percentage point), which is what `stratify=JobRole` guarantees. The imbalance is visible
# too: Full-stack is about 39% of rows and UX/UI Designer is 47 rows, about 155:1.

# %% [markdown]
# ## A4 · The transformed feature matrix (what the model actually sees)

# %%
feat_train = pd.read_parquet(C.PROCESSED_DIR / "features_core_train.parquet")
fdict = read_csv("feature_dictionary.csv")
id_cols = ["ResponseId", C.TARGET_JOB, "RoleFamily"]
feature_cols = [c for c in feat_train.columns if c not in id_cols]
print(f"features_core_train: {feat_train.shape[0]:,} rows × {len(feature_cols)} features "
      f"(+ {', '.join(c for c in id_cols if c in feat_train.columns)} kept for traceability)")

groups = (fdict.assign(block=fdict["group"].str.replace(r" \((have|want)\)", "", regex=True))
          .groupby("block").size().sort_values(ascending=False).rename("features"))
display(groups.to_frame().T)
fdict.groupby("group").head(1)[["feature", "group", "type", "transformation"]].head(18)

# %%
cols_show = ["ResponseId", C.TARGET_JOB, "tech__Language_have__Python", "tech__Language_have__SQL",
             "tech__Platform_have__Docker"] + [c for c in feature_cols if not c.startswith("tech__")][:8]
feat_train[[c for c in cols_show if c in feat_train.columns]].head(6).round(3)

# %% [markdown]
# ## A5 · One respondent, before and after preprocessing
#
# The clearest way to show what Stage 4 did: the same person as a survey row and as the
# non-zero part of their 479-number feature vector.

# %%
rid = train.loc[train[C.TARGET_JOB] == "Data engineer", "ResponseId"].iloc[3] \
    if (train[C.TARGET_JOB] == "Data engineer").any() else train["ResponseId"].iloc[0]
before = train.loc[train["ResponseId"] == rid, [C.TARGET_JOB] + model_cols].T
before.columns = ["survey row"]
display(before.dropna().head(16))

after = feat_train.loc[feat_train["ResponseId"] == rid, feature_cols].T.iloc[:, 0].astype(float)
after = after[after != 0]
print(f"\nAfter preprocessing: {len(after)} of {len(feature_cols)} features are non-zero for respondent {rid}")
after.round(3).to_frame("value").head(25)

# %% [markdown]
# ## A6 · Excel copy for viewing
#
# Writes two Excel files to `data/processed/excel/`, both with **every row** (nothing sampled):
#
# * `SkillPath_processed_data.xlsx`: the cleaned train and test rows, the feature
#   dictionary and the split check
# * `SkillPath_feature_matrix.xlsx`: the full transformed feature matrices, all 18,457
#   training rows and all 4,615 test rows × 479 features (values rounded to 6 decimals)
#
# The feature matrix is in its own file because it is ~11 million cells; kept separate, the
# first file still opens instantly on a lab PC.

# %%
out_dir = C.PROCESSED_DIR / "excel"
out_dir.mkdir(exist_ok=True)
feat_test = pd.read_parquet(C.PROCESSED_DIR / "features_core_test.parquet")

xlsx = out_dir / "SkillPath_processed_data.xlsx"
with pd.ExcelWriter(xlsx, engine="xlsxwriter") as xw:
    pd.DataFrame(rows).to_excel(xw, sheet_name="README", index=False)
    train.to_excel(xw, sheet_name="train_cleaned", index=False)
    test.to_excel(xw, sheet_name="test_cleaned", index=False)
    fdict.to_excel(xw, sheet_name="feature_dictionary", index=False)
    dist.reset_index(names="job_role").to_excel(xw, sheet_name="split_check", index=False)

# Writing ~11 million cells takes about 90 s, so this file is only rebuilt when missing
# (set REBUILD = True to force it). Its contents never change unless build_dataset.py is rerun.
REBUILD = False
xlsx_feat = out_dir / "SkillPath_feature_matrix.xlsx"
if REBUILD or not xlsx_feat.exists():
    with pd.ExcelWriter(xlsx_feat, engine="xlsxwriter") as xw:
        for name, df in [("features_train", feat_train), ("features_test", feat_test)]:
            df.round(6).to_excel(xw, sheet_name=name, index=False)
            xw.sheets[name].freeze_panes(1, 2)

for f, parts in [(xlsx, [train, test]), (xlsx_feat, [feat_train, feat_test])]:
    print(f"wrote {f.relative_to(C.PROJECT_ROOT)}  ({f.stat().st_size / 1e6:.1f} MB): "
          + ", ".join(f"{len(d):,} × {d.shape[1]}" for d in parts))


# %% [markdown]
# ---
# # Part B · Stage 6, model development
#
# ## B1 · The problem the models face
#
# * **Task:** multi-class classification, target `JobRole`, 20 classes. Each role belongs to
#   one of 12 families; a family's probability is the sum of its roles' probabilities, so one
#   model gives both the top-3 roles and the top families.
# * **Imbalance 155:1** (Full-stack 39% vs UX/UI 47 rows).
# * **Overlapping classes:** Cloud Infrastructure and DevOps engineers have a 0.99 cosine
#   similarity on their technology profiles (EDA). No model separates people who are not
#   separable, which is why the app shows three ranked roles, not one.

# %%
counts = y_train.value_counts()
fig, ax = plt.subplots(figsize=(7.5, 5))
viz.barh(ax, [label(i) for i in counts.index], counts.to_numpy())
ax.set_title(f"Training examples per job role (imbalance {counts.max() / counts.min():.0f}:1)")
ax.set_xlabel("respondents in the training split")
plt.show()

# %% [markdown]
# ## B2 · Algorithms and why each was chosen
#
# The brief asks for at least four; seven are compared, chosen to cover **different
# inductive biases** (linear, max-margin, probabilistic, instance-based, bagged trees,
# boosted trees) plus a baseline. One product constraint applies to all of them: the app
# ranks roles by probability, so every model must give usable `predict_proba`. That is why
# Linear SVM is wrapped in `CalibratedClassifierCV`.

# %%
spec = pd.DataFrame([{"model": n, "family": s["family"], "why it is here": s["why"]}
                     for n, s in M.candidates().items()])
with pd.option_context("display.max_colwidth", 140):
    display(spec)

# %% [markdown]
# ## B3 · Validation strategy
#
# * **Stratified 5-fold cross-validation on the training split only.** Stratified because
#   the smallest class has 47 rows; 5 folds leaves about 9 of them per validation fold
#   (10 folds would leave 4, too few to estimate a per-class F1).
# * **The whole preprocessor sits inside the pipeline**, so each fold refits the vocabulary,
#   rare-category pooling, imputation medians, scaler and variance filter on its own
#   training part. Fitting preprocessing once before CV would leak validation information.
# * **The 20% test split is not used for any comparison or tuning** (Part E is the only place).

# %%
print(M.cv())
print("\nEvery candidate is: Pipeline([('prep', build_preprocessor()), ('clf', <model>)])")

# %% [markdown]
# ## B4 · Metrics, and why accuracy is not the headline
#
# | Metric | Why |
# |---|---|
# | **macro-F1** (primary) | averages F1 over the 20 roles equally, so ignoring a rare role is punished as much as ignoring Full-stack |
# | balanced accuracy | mean recall per role: does it find each role at all |
# | **top-3 accuracy** | what the user sees: the app shows three roles |
# | log loss | the app prints probabilities, so their quality matters |
# | family macro-F1 / top-3 | the career-family recommendation, from the same probabilities |
# | accuracy | shown only to prove it misleads (see the Dummy row) |

# %%
stage6 = read_csv("stage6_model_comparison.csv")
cols = ["model", "f1_macro", "f1_macro_std", "balanced_accuracy", "accuracy", "top3_accuracy",
        "log_loss", "family_f1_macro", "family_top3_accuracy", "fit_seconds"]
stage6[cols].round(4)

# %%
s6 = stage6.sort_values("f1_macro")
fig, axes = plt.subplots(1, 2, figsize=(12, 4.2), sharey=True)
axes[0].barh(s6["model"], s6["f1_macro"], xerr=s6["f1_macro_std"], color=viz.BLUE, height=0.6)
axes[0].set_title("macro-F1 (primary metric), 5-fold CV")
axes[1].barh(s6["model"], s6["accuracy"], color=viz.MUTED, height=0.6, label="accuracy")
axes[1].barh(s6["model"], s6["top3_accuracy"] - s6["accuracy"], left=s6["accuracy"],
             color=viz.ORANGE, height=0.6, label="extra from showing top 3")
axes[1].set_title("accuracy vs top-3 accuracy")
axes[1].legend(loc="lower right", fontsize=8)
for ax in axes:
    ax.grid(axis="y", visible=False)
plt.tight_layout()
plt.show()

d = stage6.set_index("model")
dummy = d.loc["Dummy (most frequent)"]
print(f"Dummy (always Full-stack): accuracy {dummy['accuracy']:.3f}, macro-F1 {dummy['f1_macro']:.3f}")
print("→ a model that knows nothing gets ~39% accuracy. Accuracy alone would hide that.")

# %% [markdown]
# ## B5 · Why the models rank the way they do
#
# * **Hist Gradient Boosting** led Stage 6 (0.272): boosting keeps correcting earlier
#   mistakes, which is where the rare roles are, and trees capture skill *combinations*.
#   It was the slowest by far (179 s per fit).
# * **Logistic Regression** (0.255) and **Random Forest** (0.254) were tied within fold noise.
#   The problem is close to linear in this representation: each technology shifts the odds
#   of each role.
# * **Linear SVM** lost probability quality to calibration; **Complement Naive Bayes** is
#   over-confident because skills are not independent (React implies JavaScript);
#   **k-NN** suffers in 479 mostly-binary dimensions where all distances look alike.
# * The top three were within about one standard deviation of each other: the ceiling is
#   set by the **data**, not the algorithm. That shaped Stage 7.

# %% [markdown]
# ## B6 · Where the errors are (out-of-fold, best Stage 6 model)

# %%
per_class = read_csv("stage6_per_class_report.csv")
per_class["job_role"] = per_class["job_role"].map(label)
pc = per_class.sort_values("support")
fig, ax = plt.subplots(figsize=(6.5, 4))
ax.scatter(pc["support"], pc["f1-score"], color=viz.BLUE)
for _, r in pc.iterrows():
    ax.annotate(r["job_role"], (r["support"], r["f1-score"]), fontsize=7, color=viz.TEXT2,
                xytext=(3, 2), textcoords="offset points")
ax.set_xscale("log")
ax.set_xlabel("training examples (log scale)")
ax.set_ylabel("per-class F1")
ax.set_title("Per-class F1 grows with class size")
ax.grid(axis="both")
plt.show()

conf = pd.DataFrame(read_json("stage6_report.json")["top_confusions"])
conf["actual"] = conf["actual"].map(label)
conf["predicted_as"] = conf["predicted_as"].map(label)
conf.head(8)

# %% [markdown]
# **Finding:** almost all of the biggest confusions point **at Full-stack**, across family boundaries
# (UX/UI, front-end, AI-apps, sysadmin). Full-stack is a "sink" for anything the model is
# unsure about. So the main problem is **imbalance, not role overlap**, which is why Stage 7
# starts with imbalance handling.

# %% [markdown]
# ---
# # Part C · Stage 7, optimisation
#
# Four phases, each answering one question. All on the training split with the same folds.
#
# ## Phase A · Does imbalance handling help?
#
# Tested on two algorithms so the answer is not specific to one. **SMOTE was rejected**:
# 403 of 479 features are 0/1 skill flags and an interpolated row would "0.4 know React".
# Oversampling sits *inside* the estimator so copies never cross a fold boundary.

# %%
phase_a = read_csv("stage7_a_imbalance.csv")
phase_a[["model", "f1_macro", "f1_macro_std", "balanced_accuracy", "accuracy",
         "top3_accuracy", "fit_seconds"]].round(4)

# %% [markdown]
# **The surprise of the project.** Stage 6 used `class_weight="balanced"` everywhere as an
# obvious precaution. Phase A shows it **hurts Logistic Regression** (0.300 → 0.254 when
# added; accuracy collapses to 0.365) but **helps Random Forest** (0.187 → 0.255).
# Weighting forces the softmax to inflate rare-role probabilities everywhere: recall on rare
# roles goes up, precision falls further, and macro-F1 drops. Trees partition the space, so
# weighting just makes the rare classes visible to the split criterion.
# **Lesson: imbalance handling is a property of the algorithm-data pair, not a universal good.**
#
# ## Phase B · Do the Stage 4 feature decisions hold up?

# %%
phase_b = read_csv("stage7_b_features.csv")
ref = phase_b.loc[phase_b["model"] == "core (reference)", "f1_macro"].iloc[0]
sd = phase_b.loc[phase_b["model"] == "core (reference)", "f1_macro_std"].iloc[0]
phase_b.assign(delta_vs_core=phase_b["f1_macro"] - ref)[
    ["model", "f1_macro", "delta_vs_core", "top3_accuracy", "note"]].sort_values(
    "delta_vs_core", ascending=False).round(4)

# %% [markdown]
# * **"Want to learn" columns earn their place:** removing them costs 0.009 macro-F1 and
#   0.029 top-3.
# * **Rare-pooling threshold 0.5% is on a flat optimum** (±0.001, below fold noise).
# * **SelectKBest (chi²) does not help.** The `k=all` row does no selection and still drops
#   0.025, because that branch scales the 0/1 skill flags; this is evidence for the Stage 4
#   decision to leave binary columns unscaled. Selection sits inside the pipeline (no leak).
# * **core+context scores highest but is rejected:** students have no employer, so OrgSize,
#   Industry and RemoteWork would be blank in the app (train/serve mismatch). The +0.006 is
#   also within noise.
#
# ## Phase C · Hyper-parameter search
#
# **Randomised search, not grid search**, optimising macro-F1 with the same stratified
# folds. A 5-parameter grid with 4 values each is 1,024 fits per model; random search
# finds a near-best setting in tens of fits because only two or three parameters usually
# matter. Boosting was searched on 3 folds for cost, then re-scored on 5 so all numbers are
# comparable.

# %%
best_params = read_json("stage7_best_params.json")
for m, p in best_params.items():
    print(f"{m:<26}" + ", ".join(f"{k.split('__')[-1]}={round(v, 5) if isinstance(v, float) else v}"
                                   for k, v in p.items()))

# %%
search_lr = read_csv("stage7_c_search_logistic.csv").sort_values("param_clf__C")
fig, ax = plt.subplots(figsize=(6.5, 3.6))
for cw, g in search_lr.groupby(search_lr["param_clf__class_weight"].fillna("None")):
    ax.errorbar(g["param_clf__C"], g["mean_test_score"], yerr=g["std_test_score"],
                marker="o", capsize=3, label=f"class_weight={cw}")
ax.set_xscale("log")
ax.xaxis.set_minor_formatter(plt.NullFormatter())
ax.set_xticks([0.01, 0.03, 0.1, 0.3, 1], ["0.01", "0.03", "0.1", "0.3", "1"])
ax.set_xlabel("C (smaller = stronger regularisation)")
ax.set_ylabel("macro-F1 (3-fold)")
ax.set_title("Logistic Regression search: regularisation and class weighting")
ax.legend(fontsize=8)
ax.grid(axis="both")
plt.show()

# %% [markdown]
# The search was free to pick `class_weight="balanced"` and chose `None`, confirming Phase A
# by a different route. Both linear models moved to **stronger regularisation** than the
# default (LR C=1 → 0.218, SVM → 0.0036): with 479 features and 47 examples in the
# smallest class, the defaults were overfitting.
#
# ## Phase D · Tuned vs baseline

# %%
phase_d = read_csv("stage7_d_tuned_vs_baseline.csv")
display(phase_d.round(4))

x = np.arange(len(phase_d))
fig, ax = plt.subplots(figsize=(7.5, 3.6))
ax.bar(x - 0.2, phase_d["baseline_f1_macro"], 0.4, color=viz.MUTED, label="Stage 6 baseline")
ax.bar(x + 0.2, phase_d["tuned_f1_macro"], 0.4, color=viz.BLUE, label="Stage 7 tuned",
       yerr=phase_d["tuned_f1_macro_std"], capsize=3)
ax.set_xticks(x, phase_d["model"], fontsize=8)
ax.set_ylabel("macro-F1 (5-fold)")
ax.set_title("Tuning changed the ranking")
ax.grid(axis="y")
ax.grid(axis="x", visible=False)
ax.legend(fontsize=8)
plt.show()

# %% [markdown]
# **Tuning changed the winner.** Boosting led Stage 6; after tuning, Logistic Regression
# leads (0.303) and boosting is second (0.286). Had only the Stage 6 winner been tuned, the
# wrong model would have shipped. Logistic Regression also became the fastest (3.3 s per fit,
# down from 91.7 s, because without class weights the solver converges quickly).

# %% [markdown]
# ---
# # Part D · Final model selection
#
# The rule was fixed **before** reading the tuned results, so it could not be bent:
#
# > Highest 5-fold macro-F1. Models within one standard deviation of the best are treated
# > as tied, and the cheapest to fit wins.
#
# The tie-break exists because Stage 6 showed gaps the size of fold noise.

# %%
decision = read_json("stage7_final_selection.json")
best = phase_d.sort_values("tuned_f1_macro", ascending=False).iloc[0]
runner = phase_d.sort_values("tuned_f1_macro", ascending=False).iloc[1]
print("FINAL MODEL:", decision["final_model"], best_params[decision["final_model"]])
print(f"\nBest macro-F1 {best['tuned_f1_macro']:.4f} ± {best['tuned_f1_macro_std']:.4f}")
print(f"Runner-up     {runner['model']} {runner['tuned_f1_macro']:.4f}  "
      f"(gap {best['tuned_f1_macro'] - runner['tuned_f1_macro']:.4f} ≈ "
      f"{(best['tuned_f1_macro'] - runner['tuned_f1_macro']) / best['tuned_f1_macro_std']:.1f} SD)")
print("Tied within 1 SD:", decision["tied_within_1sd"], "→ the tie-break was not needed")

# %% [markdown]
# | Criterion | Winner | Note |
# |---|---|---|
# | macro-F1 (primary) | **Logistic Regression 0.303** | only model within 1 SD of the best |
# | family macro-F1 | **Logistic Regression 0.429** | the career-family recommendation |
# | top-3 accuracy | Linear SVM 0.840 | LR 0.839, a 0.001 difference (noise) |
# | log loss | Linear SVM 1.400 | LR 1.415, close; both well calibrated |
# | fit time | **Logistic Regression 3.3 s** | 4× faster than boosting; 108 KB model file |
# | explainability | **Logistic Regression** | one coefficient per skill per role (Part F) |
#
# It wins the primary metric outright, and the secondary reasons (speed, size,
# explainability for the non-technical presentation in Stage 12) all point the same way.

# %% [markdown]
# ---
# # Part E · The one held-out test evaluation
#
# `scripts/finalise_model.py` refit the chosen configuration on all 18,457 training rows and
# scored it once on the 4,615 test respondents. Below, the saved `model.joblib` is loaded and
# re-scored live; it must reproduce the stored numbers exactly (no decision depends on this
# rerun, so it does not turn the test set into a validation set).

# %%
model = joblib.load(C.ARTIFACTS_DIR / "model.joblib")
X_test, y_test = M.load_test()
proba = model.predict_proba(X_test)
live = M.score_all(y_test, proba, model.classes_)
stored = read_json("stage7_test_results.json")

table = pd.DataFrame({
    "cross-validated (train)": pd.Series(stored["cv_scores"]),
    "test (stored)": pd.Series(stored["test_scores"]),
    "test (recomputed now)": pd.Series(live),
}).loc[["f1_macro", "top3_accuracy", "accuracy", "balanced_accuracy", "log_loss",
        "family_f1_macro", "family_top3_accuracy"]]
display(table.round(4).astype(object).where(table.notna(), "not stored"))
print(f"CV → test macro-F1 gap: {stored['cv_to_test_gap_f1_macro']:+.4f}  (small: validation was honest)")
print(f"Recomputed matches stored: {np.allclose(table['test (stored)'], table['test (recomputed now)'], atol=1e-4)}")

# %% [markdown]
# **How to say it to a non-technical person:** for about **84 of every 100** new users, the
# role that actually fits them is in the three the app shows, and for about **88 of 100**
# their career family is in the top three. A single guess would be right about 55% of the
# time, which is why the app never shows only one answer.

# %%
test_pc = read_csv("stage7_test_per_class.csv")
test_pc["job_role"] = test_pc["job_role"].map(label)
test_pc.sort_values("f1-score", ascending=False)[["job_role", "family", "precision", "recall",
                                                  "f1-score", "support"]].round(3)

# %%
from sklearn.metrics import confusion_matrix

classes = list(model.classes_)
order = [c for c in y_train.value_counts().index]
cm = confusion_matrix(y_test, np.asarray(classes)[proba.argmax(1)], labels=order, normalize="true")
fig, ax = plt.subplots(figsize=(8.5, 7.5))
im = ax.imshow(cm, cmap=viz.seq_cmap(), vmin=0, vmax=1)
ax.set_xticks(range(len(order)), [label(c) for c in order], rotation=90, fontsize=7)
ax.set_yticks(range(len(order)), [label(c) for c in order], fontsize=7)
ax.set_xlabel("predicted")
ax.set_ylabel("actual")
ax.grid(False)
ax.set_title("Test confusion matrix (row-normalised, roles by size)")
fig.colorbar(im, ax=ax, fraction=0.04)
plt.show()

# %% [markdown]
# ---
# # Part F · The model in use
#
# ## F1 · Live prediction for a sample user
#
# This goes through the **same path the web backend will use**: a JSON profile →
# `profile_to_frame()` → the saved pipeline. Stage 7 already checked 300 real rows through
# this path with a maximum probability difference of 0.0.

# %%
profile = {
    "country": "Sri Lanka", "years_code": 4, "work_exp": 1,
    "ed_level": "Some college/university study without earning a degree",
    "tech": {
        "Language": {"have": ["Python", "SQL", "R"], "want": ["Scala"]},
        "Database": {"have": ["PostgreSQL", "Databricks SQL"], "want": ["Snowflake"]},
        "Platform": {"have": ["Docker", "Microsoft Azure"], "want": ["Kubernetes"]},
        "DevEnvs": {"have": ["Visual Studio Code", "Jupyter Notebook/JupyterLab"], "want": []},
        "SOTags": {"have": ["Polars", "Microsoft Fabric"], "want": []},
    },
    "ai": {"AISelect": "Yes, I use AI tools daily", "AIAgents": "No, but I plan to"},
    "learn_code_ai": "Yes, I learned how to use AI-enabled tools required for my job or to benefit my career",
}
p = model.predict_proba(profile_to_frame(profile))[0]
roles = pd.DataFrame(targets.top_k(p, model.classes_, k=3))[["label", "family", "probability"]]
fams = pd.DataFrame(targets.top_k_families(p, model.classes_, k=3))
display(Markdown("**Top 3 job roles**"), roles.round(3),
        Markdown("**Top 3 career families**"), fams.round(3))

# %% [markdown]
# Try changing the skills above (for example add `React`, `TypeScript` under a `Webframe`
# block, or `Kubernetes`/`Terraform` under `Platform` as "have") and re-run the cell: the
# ranking moves the way a person would expect.
#
# ## F2 · Why it predicts what it predicts
#
# Logistic Regression has one coefficient per feature per role, so "which skills push
# towards a role" can be read directly. Most features are 0/1 skill flags and the numeric
# ones are standardised, so coefficients can be compared within a role.

# %%
names = model.named_steps["prep"].get_feature_names_out()
coef = pd.DataFrame(model.named_steps["clf"].coef_, index=model.classes_, columns=names)


def pretty(f):
    return (f.replace("tech__", "").replace("_have__", " (uses) ").replace("_want__", " (wants) ")
            .replace("_", " "))


show = [r for r in ["Data engineer", "Data scientist", "DevOps engineer or professional",
                    "Developer, front-end"] if r in coef.index]
fig, axes = plt.subplots(1, len(show), figsize=(4.2 * len(show), 3.8))
for ax, role in zip(np.atleast_1d(axes), show):
    top = coef.loc[role].sort_values(ascending=False).head(8)[::-1]
    ax.barh([pretty(f)[:32] for f in top.index], top.to_numpy(), color=viz.BLUE)
    ax.set_title(label(role), fontsize=10)
    ax.tick_params(axis="y", labelsize=7)
    ax.grid(axis="y", visible=False)
plt.tight_layout()
plt.show()

# %% [markdown]
# ---
# # Quick answers for the viva
#
# | Likely question | Short answer |
# |---|---|
# | Why macro-F1 and not accuracy? | 155:1 imbalance. A model that always says Full-stack gets ~39% accuracy and ~0.03 macro-F1. |
# | Why stratified 5-fold? | Keeps every role in every fold; 5 folds still leaves ~9 UX/UI rows per fold. |
# | How did you prevent leakage? | Preprocessing, resampling and feature selection all inside the pipeline, refit per fold; test split only opened once at the end. |
# | Why not SMOTE? | Features are 0/1 skills; synthetic rows would be impossible profiles. |
# | Why random search? | Grid = 1,024 fits per model; random search finds near-best in tens of fits. |
# | Biggest single improvement? | Removing `class_weight="balanced"` from Logistic Regression: +0.047 macro-F1. |
# | Why not the Stage 6 winner (boosting)? | After tuning LR beat it by ~2 SD, and is 4× faster and explainable. |
# | Why is top-1 accuracy only 55%? | Roles genuinely overlap (DevOps vs Cloud 0.99 similarity); top-3 is 84%, which is what users see. |
# | Did the model generalise? | CV macro-F1 0.303 vs test 0.285, a small gap; top-3 identical (0.839). |
# | Why not use OrgSize/Industry when they helped? | Students cannot answer them; the gain was within noise anyway. |
#
# More detail and evidence: `reports/modelling_decisions.md`, `reports/SkillPath_Stage6-8_Report.pdf`.
