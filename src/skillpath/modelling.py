"""Stage 6-7: candidate models, scoring and the experiment runner.

Everything the modelling notebooks and the tuning scripts need lives here, for
the same reason the preprocessing lives in `skillpath.pipeline`: one definition
of a model or a metric, used by the notebooks, the scripts and the tests.

The two rules this module exists to enforce
-------------------------------------------
1. **The preprocessor is always inside the estimator.** Every candidate built
   here is a `Pipeline([("prep", build_preprocessor(...)), ("clf", ...)])`, so
   cross-validation refits the vocabulary, imputation values and scalers on each
   fold's training part. Nothing from a validation fold reaches preprocessing.
2. **Every metric is reported at both levels.** The model predicts one of 20 job
   roles; a role family's probability is the sum of its job roles' probabilities
   (`skillpath.targets`), so the family-level scores come from the same fitted
   model and never need a second model.

Scorers are written as `scorer(estimator, X, y)` callables rather than
`make_scorer` wrappers because the family-level metrics need `estimator.classes_`
to know which probability column belongs to which job role.
"""
from __future__ import annotations

import time
import warnings

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, ClassifierMixin, clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_selection import SelectKBest, chi2
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    log_loss,
    top_k_accuracy_score,
)
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.naive_bayes import ComplementNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC

from . import config as C
from . import targets
from .pipeline import build_preprocessor, model_input_columns

# 5 folds: the smallest job role has 47 training examples, which still leaves
# about 9 per fold. 10 folds would leave 4 and make the macro-F1 of that class
# almost pure noise; 3 folds would waste training data for the rare roles.
N_SPLITS = 5


def cv(n_splits: int = N_SPLITS) -> StratifiedKFold:
    """The validation strategy: stratified k-fold on the 20 job roles."""
    return StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=C.RANDOM_STATE)


def load_train(feature_set: str = "core", include_want: bool = True):
    """Training rows as (X, y). The test split is never loaded here."""
    train = pd.read_parquet(C.PROCESSED_DIR / "train.parquet")
    cols = model_input_columns(feature_set=feature_set, include_want=include_want)
    return train[cols], train[C.TARGET_JOB]


def load_test(feature_set: str = "core", include_want: bool = True):
    """Held-out rows. Only `scripts/finalise_model.py` is allowed to call this."""
    test = pd.read_parquet(C.PROCESSED_DIR / "test.parquet")
    cols = model_input_columns(feature_set=feature_set, include_want=include_want)
    return test[cols], test[C.TARGET_JOB]


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------
def score_all(y_true, proba, classes) -> dict:
    """Every reported metric, at job-role level and at role-family level.

    `proba` is (n x 20) in `classes` order. Family scores come from summing the
    job-role probabilities inside each family, which is exactly what the web app
    shows, so the family metrics measure the product, not a hypothetical model.
    """
    classes = list(classes)
    proba = np.asarray(proba, dtype=float)
    y_pred = np.asarray(classes)[proba.argmax(axis=1)]

    fam = targets.family_proba(proba, classes)
    y_fam_true = targets.family_of(y_true)
    y_fam_pred = fam.columns.to_numpy()[fam.to_numpy().argmax(axis=1)]

    return {
        # job-role level (20 classes) -- macro-F1 is the headline metric because
        # the target is imbalanced 155:1 and accuracy rewards Full-stack only
        "f1_macro": f1_score(y_true, y_pred, average="macro", zero_division=0),
        "f1_weighted": f1_score(y_true, y_pred, average="weighted", zero_division=0),
        "balanced_accuracy": balanced_accuracy_score(y_true, y_pred),
        "accuracy": accuracy_score(y_true, y_pred),
        # the app shows three roles, so top-3 accuracy is the user-facing number
        "top3_accuracy": top_k_accuracy_score(y_true, proba, k=3, labels=classes),
        "log_loss": log_loss(y_true, proba, labels=classes),
        # role-family level (12 classes), from the same probabilities
        "family_f1_macro": f1_score(y_fam_true, y_fam_pred, average="macro", zero_division=0),
        "family_balanced_accuracy": balanced_accuracy_score(y_fam_true, y_fam_pred),
        "family_accuracy": accuracy_score(y_fam_true, y_fam_pred),
        "family_top3_accuracy": targets.top_k_accuracy_family(y_true, proba, classes, k=3),
    }


METRICS = [
    "f1_macro", "f1_weighted", "balanced_accuracy", "accuracy", "top3_accuracy", "log_loss",
    "family_f1_macro", "family_balanced_accuracy", "family_accuracy", "family_top3_accuracy",
]
# Higher is better for every metric except log loss.
GREATER_IS_BETTER = {m: m != "log_loss" for m in METRICS}
PRIMARY_METRIC = "f1_macro"


def multi_scorer(estimator, X, y) -> dict:
    """All ten metrics from ONE `predict_proba` call.

    scikit-learn accepts a callable returning a dict as a multimetric `scoring=`.
    Passing a dict of ten separate scorers instead would re-run `predict_proba`
    ten times per fold, which for k-NN and a 400-tree forest dominates the whole
    run. One call, ten metrics.
    """
    return score_all(y, estimator.predict_proba(X), estimator.classes_)


def scorers():
    """`scoring=` for cross_validate: one callable, ten metrics."""
    return multi_scorer


def primary_scorer():
    """Single scorer for hyper-parameter search: macro-F1 at job-role level."""
    def scorer(estimator, X, y):
        return score_all(y, estimator.predict_proba(X), estimator.classes_)[PRIMARY_METRIC]
    scorer.__name__ = PRIMARY_METRIC
    return scorer


# ---------------------------------------------------------------------------
# Candidate models
# ---------------------------------------------------------------------------
def fast_lr(**kw) -> LogisticRegression:
    """Logistic Regression tuned for experiment cost, not for score.

    The Stage 6 baseline runs lbfgs to `max_iter=1500, tol=1e-4` and takes about
    460 s for one 5-fold run -- it never fully converges, it just hits the cap.
    Stage 7 fits this model dozens of times, so the solver settings were measured
    directly (3-fold, training split, `reports/lr_convergence_probe.log`):

        max_iter=1500  tol=1e-4   macro-F1 0.2540   379 s
        max_iter=400   tol=1e-3   macro-F1 0.2541   193 s
        max_iter=200   tol=1e-3   macro-F1 0.2541   193 s

    The looser tolerance changes macro-F1 by 0.0001 -- two orders of magnitude
    below the fold-to-fold standard deviation -- and halves the cost. The
    identical 400 and 200 rows show the solver reaches tol=1e-3 before iteration
    200, so the extra 1,300 iterations of the baseline buy nothing at all.

    Used for the Stage 7 experiment phases, where the comparisons are relative
    and the budget is better spent on more experiments than on decimal places.
    """
    kw.setdefault("max_iter", 400)
    kw.setdefault("tol", 1e-3)
    kw.setdefault("C", 1.0)
    kw.setdefault("class_weight", "balanced")
    kw.setdefault("random_state", C.RANDOM_STATE)
    return LogisticRegression(**kw)


def make_pipeline(clf, feature_set: str = "core", scale: bool = True,
                  min_frequency: float | int = C.MIN_TOKEN_FREQUENCY,
                  include_want: bool = True) -> Pipeline:
    """Preprocessor + classifier as one estimator, so CV refits preprocessing."""
    return Pipeline([
        ("prep", build_preprocessor(feature_set=feature_set, min_frequency=min_frequency,
                                    include_want=include_want, scale=scale)),
        ("clf", clf),
    ])


class OversampledClassifier(BaseEstimator, ClassifierMixin):
    """Random oversampling of the minority job roles, applied in `fit` only.

    Why this and not SMOTE: SMOTE invents new rows by interpolating between
    neighbours, which on this feature matrix would produce a respondent who
    "0.4 knows React" -- 403 of the 479 features are 0/1 skill flags, so the
    synthetic rows are not valid skill profiles. Plain duplication of real
    respondents keeps every row a profile somebody actually reported.

    It is a *classifier wrapper* rather than a pipeline step because scikit-learn
    pipelines may not change the number of rows. Living inside the estimator
    means the resampling happens on each CV fold's training part only, never on
    the validation part -- resampling before the split is a classic leak that
    inflates scores because copies of the same respondent land on both sides.

    `sampling_strategy`
        float 0 < a <= 1   raise every class to at least a * (size of the largest),
                           leaving classes already above that untouched
        "balanced"         a = 1.0, full balancing

    Full balancing (a = 1.0) is available but is not the default experiment: it
    would copy the 47 UX/UI respondents 155 times each and grow the training set
    from 18,457 rows to 145,580, which costs over an hour per fit here and tends
    to overfit the duplicated rows anyway. Partial oversampling (a = 0.1-0.25)
    lifts the rare roles enough to matter at a fraction of the cost, which is the
    trade-off the Stage 7 table reports.
    """

    def __init__(self, estimator=None, sampling_strategy=0.1, random_state=C.RANDOM_STATE):
        self.estimator = estimator
        self.sampling_strategy = sampling_strategy
        self.random_state = random_state

    def fit(self, X, y):
        rng = np.random.RandomState(self.random_state)
        y = np.asarray(y)
        classes, counts = np.unique(y, return_counts=True)
        a = 1.0 if self.sampling_strategy == "balanced" else float(self.sampling_strategy)
        target = int(a * counts.max())

        take = []
        for cls, n in zip(classes, counts):
            idx = np.flatnonzero(y == cls)
            take.append(idx)
            if n < target:  # draw the shortfall with replacement from real rows
                take.append(rng.choice(idx, size=target - n, replace=True))
        order = rng.permutation(np.concatenate(take))

        Xr = X.iloc[order] if hasattr(X, "iloc") else X[order]
        self.estimator_ = clone(self.estimator).fit(Xr, y[order])
        self.classes_ = self.estimator_.classes_
        return self

    def predict(self, X):
        return self.estimator_.predict(X)

    def predict_proba(self, X):
        return self.estimator_.predict_proba(X)


def select_kbest_pipeline(clf, k, feature_set: str = "core", rescale: bool = True) -> Pipeline:
    """Preprocess -> chi-square SelectKBest -> (rescale) -> classify.

    chi-square needs non-negative inputs, so the preprocessor is built unscaled
    and a StandardScaler is put back *after* the selection for models that need
    it. Selection sits inside the pipeline, so the k best features are chosen
    from each CV fold's training part only. Choosing them once on the whole
    training set would leak the validation folds into the feature choice and
    quietly inflate every score that follows.
    """
    steps = [("prep", build_preprocessor(feature_set=feature_set, scale=False))]
    if k != "all":
        steps.append(("select", SelectKBest(chi2, k=k)))
    if rescale:
        steps.append(("scale", StandardScaler()))
    steps.append(("clf", clf))
    return Pipeline(steps)


def candidates(include_slow: bool = True) -> dict:
    """The Stage 6 line-up: one baseline and six learning algorithms.

    Chosen so the comparison spans genuinely different inductive biases rather
    than six variations of the same idea, and so that **every** candidate can
    produce `predict_proba` -- the app has to show three ranked roles plus the
    family totals, so a model without usable probabilities cannot be deployed
    whatever its accuracy. That is why LinearSVC is wrapped in
    `CalibratedClassifierCV` instead of being used directly.

    Returns {name: {"pipeline", "family", "why"}}.
    """
    out = {}

    out["Dummy (most frequent)"] = {
        "pipeline": make_pipeline(DummyClassifier(strategy="most_frequent")),
        "family": "baseline",
        "why": "Floor for every metric. Its 39% accuracy next to a near-zero macro-F1 is "
               "the evidence that accuracy is the wrong headline metric here.",
    }

    # Naive Bayes needs non-negative inputs, so this branch uses the unscaled
    # preprocessor (scale=False -> all features are counts, 0/1 or ordinal codes,
    # minimum 0.0). Cheap, and a sensible floor for sparse binary data.
    out["Complement Naive Bayes"] = {
        "pipeline": make_pipeline(ComplementNB(), scale=False),
        "family": "probabilistic",
        "why": "Designed for imbalanced, sparse count-like data. Assumes features are "
               "conditionally independent, which technology lists clearly are not "
               "(React implies JavaScript), so it is the 'wrong assumption' reference point.",
    }

    out["k-Nearest Neighbours"] = {
        "pipeline": make_pipeline(KNeighborsClassifier(n_neighbors=25, metric="cosine",
                                                       weights="distance")),
        "family": "instance-based",
        "why": "Directly tests the 'people with similar skill profiles do similar jobs' "
               "intuition behind the product. Cosine distance because the vectors are "
               "sparse 0/1 skill sets of very different breadth.",
    }

    out["Logistic Regression"] = {
        "pipeline": make_pipeline(LogisticRegression(max_iter=1500, C=1.0,
                                                     class_weight="balanced",
                                                     random_state=C.RANDOM_STATE)),
        "family": "linear",
        "why": "Multinomial softmax on 479 mostly-binary features: the classic strong "
               "baseline for wide sparse data. Native well-behaved probabilities, and "
               "coefficients read directly as 'which skill pushes which role'.",
    }

    out["Linear SVM (calibrated)"] = {
        "pipeline": make_pipeline(CalibratedClassifierCV(
            LinearSVC(C=1.0, class_weight="balanced", random_state=C.RANDOM_STATE),
            method="sigmoid", cv=3)),
        "family": "linear (max-margin)",
        "why": "Max-margin boundaries often beat logistic loss on sparse high-dimensional "
               "data. LinearSVC has no predict_proba, so it is wrapped in Platt scaling -- "
               "the app needs ranked probabilities.",
    }

    out["Random Forest"] = {
        "pipeline": make_pipeline(RandomForestClassifier(
            n_estimators=400, min_samples_leaf=2, max_features="sqrt", n_jobs=-1,
            class_weight="balanced_subsample", random_state=C.RANDOM_STATE)),
        "family": "bagged trees",
        "why": "Captures skill *combinations* a linear model cannot (Terraform AND Python "
               "AND Kubernetes -> AI/ML engineer rather than three separate nudges). "
               "Needs no scaling and handles the 0/1 columns natively.",
    }

    if include_slow:
        out["Hist Gradient Boosting"] = {
            "pipeline": make_pipeline(HistGradientBoostingClassifier(
                max_iter=200, learning_rate=0.1, early_stopping=True, n_iter_no_change=15,
                validation_fraction=0.1, random_state=C.RANDOM_STATE)),
            "family": "boosted trees",
            "why": "Strongest tree-based option: each round corrects the previous rounds' "
                   "errors, which usually helps the rare roles. Expensive here because a "
                   "20-class problem grows 20 trees per boosting round.",
        }

    return out


# ---------------------------------------------------------------------------
# Experiment runner
# ---------------------------------------------------------------------------
def run_cv(name: str, estimator, X, y, n_splits: int = N_SPLITS, note: str = "") -> dict:
    """Cross-validate one candidate and return a flat row for the results table."""
    t0 = time.time()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        res = cross_validate(estimator, X, y, cv=cv(n_splits), scoring=scorers(),
                             n_jobs=1, error_score="raise")
    row = {"model": name, "note": note, "n_splits": n_splits}
    for m in METRICS:
        row[m] = float(np.mean(res[f"test_{m}"]))
        row[f"{m}_std"] = float(np.std(res[f"test_{m}"]))
    row["fit_seconds"] = float(np.mean(res["fit_time"]))
    row["total_seconds"] = round(time.time() - t0, 1)
    return row


def results_table(rows, sort_by: str = PRIMARY_METRIC) -> pd.DataFrame:
    """Experiment rows as a tidy, sorted DataFrame."""
    df = pd.DataFrame(rows)
    return df.sort_values(sort_by, ascending=not GREATER_IS_BETTER[sort_by]).reset_index(drop=True)


def append_results(rows, path=None) -> pd.DataFrame:
    """Append experiment rows to reports/model_experiments.csv (the lab notebook).

    Stage 6 asks for experiments to be *recorded*, so every run appends here with
    a timestamp instead of overwriting, and the file is the evidence trail.
    """
    path = path or (C.REPORTS_DIR / "model_experiments.csv")
    df = pd.DataFrame(rows)
    df.insert(0, "run_at", pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"))
    if path.exists():
        df = pd.concat([pd.read_csv(path), df], ignore_index=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    return df


SUMMARY_COLUMNS = ["model", "f1_macro", "f1_macro_std", "balanced_accuracy", "accuracy",
                   "top3_accuracy", "log_loss", "family_f1_macro", "family_top3_accuracy",
                   "fit_seconds"]


def summary(df: pd.DataFrame) -> pd.DataFrame:
    """The columns that go in the report, rounded for reading."""
    cols = [c for c in SUMMARY_COLUMNS if c in df.columns]
    return df[cols].round({c: 4 for c in cols if c != "model"})
