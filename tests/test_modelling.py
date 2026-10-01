"""Checks that protect the Stage 6 and Stage 7 decisions.

Companion to test_preprocessing.py. These are the claims the modelling report
makes that would be embarrassing to have wrong:

  * every candidate can produce probabilities (the app ranks three roles)
  * family probabilities are a proper aggregation of the job-role probabilities
  * oversampling happens inside the estimator, so it cannot leak across folds
  * feature selection happens inside the pipeline, for the same reason
  * the metric set behaves the way the report says it does

Run:  pytest -q
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest
from sklearn.base import BaseEstimator
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_validate

from skillpath import config as C
from skillpath import modelling as M
from skillpath import targets


@pytest.fixture(scope="module")
def small():
    """A small, stratified slice of the training split: fast but still 20 classes."""
    train = pd.read_parquet(C.PROCESSED_DIR / "train.parquet")
    keep = train.groupby(C.TARGET_JOB, sort=False).cumcount() < 40
    part = train[keep]
    from skillpath.pipeline import model_input_columns
    return part[model_input_columns()], part[C.TARGET_JOB]


# --- candidates ---------------------------------------------------------------
def test_at_least_four_algorithms_are_compared():
    """Stage 6 requires four; the baseline does not count as one of them."""
    learners = [n for n, s in M.candidates().items() if s["family"] != "baseline"]
    assert len(learners) >= 4, learners


def test_every_candidate_exposes_predict_proba():
    """The app shows three ranked roles and sums them into families, so a model
    without probabilities cannot be deployed however well it scores."""
    for name, spec in M.candidates().items():
        assert hasattr(spec["pipeline"].named_steps["clf"], "predict_proba"), name


def test_every_candidate_keeps_preprocessing_inside_the_estimator():
    """If the preprocessor were fitted outside, CV folds would leak into it."""
    for name, spec in M.candidates().items():
        assert spec["pipeline"].steps[0][0] == "prep", name


# --- metrics ------------------------------------------------------------------
def test_score_all_reports_every_documented_metric(small):
    X, y = small
    pipe = M.make_pipeline(LogisticRegression(max_iter=300)).fit(X, y)
    scores = M.score_all(y, pipe.predict_proba(X), pipe.classes_)
    assert set(scores) == set(M.METRICS)
    assert all(np.isfinite(v) for v in scores.values())


def test_family_probabilities_are_a_partition_of_the_job_role_probabilities(small):
    """Each job role belongs to exactly one family, so the family probabilities
    must sum to 1 as well -- this is what lets one model serve both levels."""
    X, y = small
    pipe = M.make_pipeline(LogisticRegression(max_iter=300)).fit(X, y)
    proba = pipe.predict_proba(X)
    fam = targets.family_proba(proba, pipe.classes_)
    assert fam.shape[1] == len(targets.FAMILIES)
    np.testing.assert_allclose(fam.to_numpy().sum(axis=1), 1.0, atol=1e-9)


def test_top3_accuracy_is_never_below_top1(small):
    X, y = small
    pipe = M.make_pipeline(LogisticRegression(max_iter=300)).fit(X, y)
    s = M.score_all(y, pipe.predict_proba(X), pipe.classes_)
    assert s["top3_accuracy"] >= s["accuracy"]
    assert s["family_top3_accuracy"] >= s["family_accuracy"]


def test_majority_baseline_has_high_accuracy_but_almost_no_macro_f1(small):
    """The evidence for choosing macro-F1 over accuracy as the headline metric."""
    from sklearn.dummy import DummyClassifier
    X, y = small
    pipe = M.make_pipeline(DummyClassifier(strategy="most_frequent")).fit(X, y)
    s = M.score_all(y, pipe.predict_proba(X), pipe.classes_)
    assert s["f1_macro"] < 0.05
    assert s["accuracy"] > s["f1_macro"] * 2


def test_multi_scorer_returns_all_metrics_in_one_call(small):
    """One predict_proba per fold instead of ten; cross_validate must still see
    every metric under its usual test_<name> key."""
    X, y = small
    res = cross_validate(M.make_pipeline(LogisticRegression(max_iter=200)), X, y,
                         cv=M.cv(3), scoring=M.scorers(), error_score="raise")
    for m in M.METRICS:
        assert f"test_{m}" in res


# --- imbalance handling -------------------------------------------------------
class Spy(BaseEstimator):
    """Records the class counts it is handed, so a test can see what the
    oversampler actually passed to the wrapped model."""

    def fit(self, X, y):
        self.seen_ = pd.Series(y).value_counts()
        self.classes_ = np.unique(y)
        return self


def test_oversampling_balances_the_training_rows_it_is_given():
    y = np.array(["a"] * 100 + ["b"] * 10 + ["c"] * 5)
    X = pd.DataFrame({"f": np.arange(len(y))})
    clf = M.OversampledClassifier(Spy(), sampling_strategy=1.0).fit(X, y)
    assert clf.estimator_.seen_.nunique() == 1, "all classes should reach the same size"
    assert clf.estimator_.seen_.iloc[0] == 100


def test_partial_oversampling_lifts_only_the_rare_classes():
    y = np.array(["a"] * 100 + ["b"] * 40 + ["c"] * 5)
    X = pd.DataFrame({"f": np.arange(len(y))})
    clf = M.OversampledClassifier(Spy(), sampling_strategy=0.5).fit(X, y)
    seen = clf.estimator_.seen_
    assert seen["a"] == 100   # already above 0.5 * 100, untouched
    assert seen["b"] == 50    # lifted to the floor
    assert seen["c"] == 50


def test_oversampling_does_not_mutate_the_caller_data():
    """The resampling must stay inside fit; if it changed X or y in place, the
    validation fold of the next CV iteration would be contaminated."""
    y = np.array(["a"] * 30 + ["b"] * 5)
    X = pd.DataFrame({"f": np.arange(len(y))})
    before = X.copy()
    M.OversampledClassifier(LogisticRegression(max_iter=100), sampling_strategy=1.0).fit(X, y)
    pd.testing.assert_frame_equal(X, before)
    assert len(y) == 35


def test_oversampler_is_a_classifier_not_a_pipeline_step():
    """scikit-learn pipeline steps may not change the number of rows, so the
    resampling has to live inside the estimator for CV to refit it per fold."""
    pipe = M.make_pipeline(M.OversampledClassifier(LogisticRegression(max_iter=100)))
    assert pipe.steps[-1][0] == "clf"
    assert isinstance(pipe.steps[-1][1], M.OversampledClassifier)


# --- feature selection --------------------------------------------------------
@pytest.mark.parametrize("k", [50, 150])
def test_select_kbest_keeps_exactly_k_features_and_sits_inside_the_pipeline(small, k):
    X, y = small
    pipe = M.select_kbest_pipeline(LogisticRegression(max_iter=200), k=k).fit(X, y)
    assert "select" in pipe.named_steps
    assert pipe.named_steps["select"].get_support().sum() == k
    assert list(pipe.named_steps).index("select") < list(pipe.named_steps).index("clf")


def test_select_kbest_uses_an_unscaled_preprocessor_because_chi2_needs_non_negative(small):
    X, y = small
    pipe = M.select_kbest_pipeline(LogisticRegression(max_iter=200), k=50)
    Z = pipe.named_steps["prep"].fit_transform(X)
    assert Z.min() >= 0.0


def test_select_all_skips_the_selection_step():
    pipe = M.select_kbest_pipeline(LogisticRegression(), k="all")
    assert "select" not in pipe.named_steps


# --- the final artifact, when it exists ---------------------------------------
@pytest.mark.skipif(not (C.ARTIFACTS_DIR / "model.joblib").exists(),
                    reason="run scripts/finalise_model.py first")
def test_final_model_predicts_valid_job_role_probabilities():
    import joblib
    from skillpath.pipeline import model_input_columns
    model = joblib.load(C.ARTIFACTS_DIR / "model.joblib")
    test = pd.read_parquet(C.PROCESSED_DIR / "test.parquet").head(50)
    proba = model.predict_proba(test[model_input_columns()])
    assert proba.shape == (50, len(targets.JOB_ROLES))
    np.testing.assert_allclose(proba.sum(axis=1), 1.0, atol=1e-9)
    assert set(model.classes_) == set(targets.JOB_ROLES)


@pytest.mark.skipif(not (C.ARTIFACTS_DIR / "model.joblib").exists(),
                    reason="run scripts/finalise_model.py first")
def test_final_model_serves_the_web_api_contract_identically():
    """A profile sent through the web format must give the same answer as the
    training-format row it came from."""
    import joblib
    from skillpath.pipeline import model_input_columns
    from skillpath.profile import profile_to_frame, row_to_profile
    model = joblib.load(C.ARTIFACTS_DIR / "model.joblib")
    cols = model_input_columns()
    rows = pd.read_parquet(C.PROCESSED_DIR / "train.parquet").sample(25, random_state=0)
    rebuilt = pd.concat([profile_to_frame(row_to_profile(r)) for _, r in rows.iterrows()],
                        ignore_index=True)[cols]
    np.testing.assert_allclose(model.predict_proba(rows[cols]),
                               model.predict_proba(rebuilt), atol=1e-12)


@pytest.mark.skipif(not (C.ARTIFACTS_DIR / "model_card.json").exists(),
                    reason="run scripts/finalise_model.py first")
def test_model_card_records_the_limitations_the_report_claims():
    card = json.loads((C.ARTIFACTS_DIR / "model_card.json").read_text())
    for key in ("model", "test_scores", "cv_scores_training_split", "known_limitations",
                "not_for", "sklearn_version", "selection_rule"):
        assert key in card, key
    assert card["known_limitations"] and card["not_for"]
