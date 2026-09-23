"""Checks that protect the preprocessing decisions.

Run after `python scripts/build_dataset.py`:  pytest -q
"""
from __future__ import annotations

import joblib
import numpy as np
import pandas as pd
import pytest

from skillpath import config as C
from skillpath.data import country_region_table, load_raw
from skillpath.features import TechBlockEncoder, parse_tokens
from skillpath.pipeline import build_preprocessor, column_step, model_input_columns
from skillpath.profile import profile_to_frame, row_to_profile


@pytest.fixture(scope="module")
def train():
    return pd.read_parquet(C.PROCESSED_DIR / "train.parquet")


@pytest.fixture(scope="module")
def test_df():
    return pd.read_parquet(C.PROCESSED_DIR / "test.parquet")


@pytest.fixture(scope="module")
def prep():
    return joblib.load(C.ARTIFACTS_DIR / "preprocessor_core.joblib")


# --- parsing ------------------------------------------------------------------
def test_parse_tokens_accepts_strings_lists_and_missing():
    assert parse_tokens("Python; SQL") == frozenset({"Python", "SQL"})
    assert parse_tokens(["Python", " SQL "]) == frozenset({"Python", "SQL"})
    assert parse_tokens(np.nan) == frozenset()
    assert parse_tokens(None) == frozenset()
    assert parse_tokens([]) == frozenset()


# --- structural zero vs unknown ---------------------------------------------------
def test_gate_no_is_a_true_zero_but_skipped_is_unknown():
    blocks = {"Database": ("DatabaseHaveWorkedWith", "DatabaseWantToWorkWith", "DatabaseChoice")}
    fit_df = pd.DataFrame({
        "DatabaseHaveWorkedWith": ["PostgreSQL"] * 5,
        "DatabaseWantToWorkWith": ["Redis"] * 5,
        "DatabaseChoice": ["Yes"] * 5,
    })
    enc = TechBlockEncoder(blocks=blocks, min_frequency=1).fit(fit_df)
    rows = pd.DataFrame({
        "DatabaseHaveWorkedWith": [np.nan, np.nan],
        "DatabaseWantToWorkWith": [np.nan, np.nan],
        "DatabaseChoice": ["No", np.nan],  # said "none" vs skipped
    })
    out = pd.DataFrame(enc.transform(rows), columns=enc.get_feature_names_out())
    assert out.loc[0, "Database_have_unknown"] == 0
    assert out.loc[1, "Database_have_unknown"] == 1


def test_unseen_technology_goes_to_other_column():
    blocks = {"Language": ("LanguageHaveWorkedWith", "LanguageWantToWorkWith", "LanguageChoice")}
    fit_df = pd.DataFrame({"LanguageHaveWorkedWith": ["Python"] * 3, "LanguageWantToWorkWith": [np.nan] * 3,
                           "LanguageChoice": ["Yes"] * 3})
    enc = TechBlockEncoder(blocks=blocks, min_frequency=1).fit(fit_df)
    out = pd.DataFrame(enc.transform(pd.DataFrame({"LanguageHaveWorkedWith": ["Python;BrandNewLang"],
                                                   "LanguageWantToWorkWith": [np.nan],
                                                   "LanguageChoice": ["Yes"]})),
                       columns=enc.get_feature_names_out())
    assert out.loc[0, "Language_have__Python"] == 1
    assert out.loc[0, "Language_have__OTHER"] == 1


# --- leakage ----------------------------------------------------------------------
def test_target_and_leaky_columns_are_never_model_inputs():
    for fs in ("core", "core+context"):
        cols = set(model_input_columns(fs))
        assert not cols & set(C.LEAKY_OR_EXCLUDED)
        assert C.SALARY_COL not in cols


def test_split_is_disjoint_and_stratified(train, test_df):
    assert not set(train[C.ID_COL]) & set(test_df[C.ID_COL])
    p_tr = train[C.TARGET_JOB].value_counts(normalize=True)
    p_te = test_df[C.TARGET_JOB].value_counts(normalize=True)
    assert (p_tr - p_te).abs().max() < 0.005
    assert set(p_tr.index) == set(p_te.index) == set(C.ROLE_FAMILY)


def test_vocabulary_learned_from_train_only(train, prep):
    tech = column_step(prep).named_transformers_["tech"]
    refit = TechBlockEncoder().fit(train[tech.required_columns()])
    assert refit.vocabulary_ == tech.vocabulary_


def test_reference_tables_exclude_recommender_test_rows(test_df):
    test_ids = set(test_df[C.ID_COL])
    for f in ("salary_reference.parquet", "persona_inputs.parquet"):
        ref = pd.read_parquet(C.REFERENCE_DIR / f)
        assert not set(ref[C.ID_COL]) & test_ids, f


# --- web contract -----------------------------------------------------------------
def test_profile_roundtrip_gives_identical_features(train, prep):
    """A survey row sent through the API format must give the same features."""
    cols = model_input_columns("core")
    sample = train.sample(300, random_state=0)
    direct = prep.transform(sample[cols])
    via_api = np.vstack([prep.transform(profile_to_frame(row_to_profile(r))[cols])
                         for _, r in sample.iterrows()])
    np.testing.assert_allclose(direct, via_api, rtol=0, atol=1e-6)


def test_empty_profile_does_not_crash(prep):
    X = prep.transform(profile_to_frame({})[model_input_columns("core")])
    assert X.shape == (1, len(prep.get_feature_names_out()))
    assert np.isfinite(X).all()


def test_every_survey_country_maps_to_a_region():
    raw = load_raw()
    table = country_region_table()
    known = set(table["Country"])
    assert set(raw["Country"].dropna()) <= known
    assert table.loc[table["Country"] != "Nomadic", "Region"].notna().all()


def test_pipeline_output_has_no_missing_values(train, prep):
    X = prep.transform(train[model_input_columns("core")])
    assert np.isfinite(X).all()


def test_unfitted_preprocessor_is_cloneable():
    from sklearn.base import clone
    clone(build_preprocessor("core+context"))


def test_straightliners_removed_from_cohort(train, test_df):
    from skillpath.features import parse_tokens
    both = pd.concat([train, test_df])
    for block, (have, _, _) in C.TECH_BLOCKS.items():
        share = both[have].map(parse_tokens).map(len) / C.TECH_OPTION_COUNTS[block]
        assert (share < C.STRAIGHTLINE_SHARE).all(), block


def test_no_constant_columns_after_preprocessing(train, prep):
    X = prep.transform(train[model_input_columns("core")])
    assert (X.var(axis=0) > 0).all()


# --- target: job role -> family -------------------------------------------------------
def test_family_probabilities_sum_job_roles():
    from skillpath import targets
    rng = np.random.default_rng(0)
    p = rng.dirichlet(np.ones(len(targets.JOB_ROLES)), size=50)
    fam = targets.family_proba(p, targets.JOB_ROLES)
    np.testing.assert_allclose(fam.sum(axis=1), 1.0)
    i = targets.JOB_ROLES.index("Data scientist")
    j = targets.JOB_ROLES.index("AI/ML engineer")
    k = [targets.JOB_ROLES.index(r) for r, f in C.ROLE_FAMILY.items() if f == "Data Sci/ML"]
    np.testing.assert_allclose(fam["Data Sci/ML"], p[:, k].sum(axis=1))
    assert i in k and j in k


def test_every_job_role_has_family_label_and_description():
    assert set(C.ROLE_FAMILY) == set(C.JOB_ROLE_LABEL) == set(C.JOB_ROLE_DESCRIPTION)
    assert len(C.ROLE_FAMILY) == 20 and len(set(C.ROLE_FAMILY.values())) == 12


def test_top_k_returns_highest_job_roles():
    from skillpath import targets
    p = np.full(20, 0.01)
    p[targets.JOB_ROLES.index("Developer, mobile")] = 0.5
    top = targets.top_k(p / p.sum(), targets.JOB_ROLES, k=3)
    assert top[0]["job_role"] == "Developer, mobile" and top[0]["family"] == "Mobile"
    assert len(top) == 3
