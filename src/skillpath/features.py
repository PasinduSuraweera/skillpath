"""Custom scikit-learn transformers used by the SkillPath preprocessing pipeline.

They live in this installable package (not in a notebook) so that a pipeline
saved with joblib can be loaded by the web backend: unpickling needs to import
the exact same classes.

All transformers accept raw survey-format columns. Multi-select values can be a
semicolon string ("Python;SQL"), a Python list/tuple/set, or missing, so the
same object works on the survey file and on JSON coming from the web form.
"""
from __future__ import annotations

from collections import Counter
from typing import Iterable

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.utils.validation import check_is_fitted

from . import config as C
from .data import country_region_table


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _is_missing(value) -> bool:
    if value is None:
        return True
    if isinstance(value, (list, tuple, set, frozenset, np.ndarray)):
        return len(value) == 0
    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def parse_tokens(value, sep: str = C.MULTI_SEP) -> frozenset:
    """Turn one multi-select cell into a set of clean technology names."""
    if _is_missing(value):
        return frozenset()
    if isinstance(value, str):
        items: Iterable = value.split(sep)
    else:
        items = value
    return frozenset(t.strip() for t in items if isinstance(t, str) and t.strip())


def _safe(name: str) -> str:
    return name.replace(" ", "_")


# ---------------------------------------------------------------------------
# Technology blocks
# ---------------------------------------------------------------------------
class TechBlockEncoder(BaseEstimator, TransformerMixin):
    """Multi-hot encode the technology multi-select questions.

    For every block (Language, Database, Platform, Webframe, DevEnvs,
    AIModels, SOTags) and every list (have = used in the past year, want =
    wants to use next year) it produces:

    * one 0/1 column per technology selected by at least `min_frequency` of
      the TRAINING rows (the vocabulary is learned in `fit` only);
    * `<block>_<list>__OTHER`: 1 if the person picked any rarer or unseen
      technology (rare-category grouping; also makes unseen web inputs safe);
    * `<block>_<list>_count`: log1p(number of technologies picked), a breadth
      measure on a scale comparable to the 0/1 columns;
    * `<block>_<list>_unknown`: 1 when the list is empty but the respondent did
      NOT say "No" to the gate question, i.e. we do not know what they use.
      An empty list after gate == "No" is a genuine "uses none" and stays all
      zeros with unknown = 0. This separates structural zeros from missing data.
    * `<block>_want_new_count`: log1p(number of wanted technologies not already
      used), an aspiration / learning-direction signal (engineered feature).
    """

    def __init__(self, blocks: dict | None = None, min_frequency: float | int = C.MIN_TOKEN_FREQUENCY,
                 include_want: bool = True, add_counts: bool = True,
                 add_unknown_flags: bool = True, add_want_new: bool = True):
        self.blocks = blocks
        self.min_frequency = min_frequency
        self.include_want = include_want
        self.add_counts = add_counts
        self.add_unknown_flags = add_unknown_flags
        self.add_want_new = add_want_new

    # -- internal -----------------------------------------------------------
    def _blocks(self) -> dict:
        return self.blocks if self.blocks is not None else C.TECH_BLOCKS

    def _lists(self):
        for block, (have, want, gate) in self._blocks().items():
            yield block, "have", have, gate
            if self.include_want:
                yield block, "want", want, gate

    def _threshold(self, n_rows: int) -> float:
        f = self.min_frequency
        return f * n_rows if isinstance(f, float) and f < 1 else float(f)

    def required_columns(self) -> list:
        cols = []
        for _, (have, want, gate) in self._blocks().items():
            cols += [have] + ([want] if self.include_want else []) + ([gate] if gate else [])
        return cols

    # -- sklearn API --------------------------------------------------------
    def fit(self, X: pd.DataFrame, y=None):
        X = pd.DataFrame(X)
        thr = self._threshold(len(X))
        self.vocabulary_ = {}
        self.rare_ = {}
        self.token_counts_ = {}
        for block, kind, col, _ in self._lists():
            counts = Counter()
            for toks in X[col].map(parse_tokens):
                counts.update(toks)
            keep = sorted(t for t, n in counts.items() if n >= thr)
            self.vocabulary_[(block, kind)] = keep
            self.rare_[(block, kind)] = sorted(t for t, n in counts.items() if n < thr)
            self.token_counts_[(block, kind)] = dict(counts)
        self.feature_names_out_ = np.array(self._build_names(), dtype=object)
        self.n_features_in_ = X.shape[1]
        return self

    def _build_names(self) -> list:
        names = []
        for block, kind, _, _ in self._lists():
            names += [f"{block}_{kind}__{_safe(t)}" for t in self.vocabulary_[(block, kind)]]
            names.append(f"{block}_{kind}__OTHER")
            if self.add_counts:
                names.append(f"{block}_{kind}_count")
            if self.add_unknown_flags:
                names.append(f"{block}_{kind}_unknown")
        if self.add_want_new and self.include_want:
            names += [f"{block}_want_new_count" for block in self._blocks()]
        return names

    def transform(self, X: pd.DataFrame):
        check_is_fitted(self, "vocabulary_")
        X = pd.DataFrame(X)
        n = len(X)
        parts = []
        parsed = {}
        for block, kind, col, gate in self._lists():
            toks = X[col].map(parse_tokens).tolist()
            parsed[(block, kind)] = toks
            vocab = self.vocabulary_[(block, kind)]
            index = {t: i for i, t in enumerate(vocab)}
            mat = np.zeros((n, len(vocab) + 1), dtype=np.float32)
            for r, ts in enumerate(toks):
                for t in ts:
                    j = index.get(t)
                    if j is None:
                        mat[r, -1] = 1.0  # rare or unseen -> OTHER
                    else:
                        mat[r, j] = 1.0
            parts.append(mat)
            if self.add_counts:
                parts.append(np.log1p(np.array([len(ts) for ts in toks], dtype=np.float32))[:, None])
            if self.add_unknown_flags:
                empty = np.array([len(ts) == 0 for ts in toks])
                said_no = (X[gate].astype("object") == "No").to_numpy() if gate else np.zeros(n, bool)
                parts.append((empty & ~said_no).astype(np.float32)[:, None])
        if self.add_want_new and self.include_want:
            for block in self._blocks():
                have, want = parsed[(block, "have")], parsed[(block, "want")]
                new = np.array([len(w - h) for h, w in zip(have, want)], dtype=np.float32)
                parts.append(np.log1p(new)[:, None])
        return np.hstack(parts)

    def get_feature_names_out(self, input_features=None):
        check_is_fitted(self, "feature_names_out_")
        return self.feature_names_out_


# ---------------------------------------------------------------------------
# Ordered answer scales
# ---------------------------------------------------------------------------
class OrdinalMapEncoder(BaseEstimator, TransformerMixin):
    """Map ordered survey answers to integers with a fixed, documented order.

    Answers outside the scale (e.g. "I don’t know", "Other") and missing values
    become NaN and are imputed by the next pipeline step. Stateless: the order
    comes from domain meaning (config.ORDINAL_MAPS), not from the data.
    """

    def __init__(self, maps: dict | None = None):
        self.maps = maps

    def fit(self, X, y=None):
        X = pd.DataFrame(X)
        self.columns_ = list(X.columns)
        self.n_features_in_ = X.shape[1]
        return self

    def transform(self, X):
        check_is_fitted(self, "columns_")
        X = pd.DataFrame(X, columns=self.columns_)
        maps = self.maps if self.maps is not None else C.ORDINAL_MAPS
        out = np.column_stack(
            [X[c].astype("object").map(maps[c]).astype(float).to_numpy() for c in self.columns_]
        )
        return out.astype(np.float64)

    def get_feature_names_out(self, input_features=None):
        check_is_fitted(self, "columns_")
        return np.array([f"{c}_ord" for c in self.columns_], dtype=object)


# ---------------------------------------------------------------------------
# Country -> Region
# ---------------------------------------------------------------------------
class RegionFromCountry(BaseEstimator, TransformerMixin):
    """Replace the 177-value Country with one of 13 UN M49-based regions.

    Lower cardinality generalises better for the recommender and avoids
    country-specific memorisation; unknown countries become missing.
    """

    def fit(self, X, y=None):
        self.n_features_in_ = 1
        return self

    def transform(self, X):
        X = pd.DataFrame(X)
        table = country_region_table()
        mapping = dict(zip(table["Country"], table["Region"]))
        region = X.iloc[:, 0].astype("object").map(mapping)
        return region.to_frame("Region").astype("object").to_numpy()

    def get_feature_names_out(self, input_features=None):
        return np.array(["Region"], dtype=object)


# ---------------------------------------------------------------------------
# Experience
# ---------------------------------------------------------------------------
class ExperienceFeatures(BaseEstimator, TransformerMixin):
    """log1p(YearsCode), log1p(WorkExp) and a career-changer flag.

    Both year counts are right-skewed (a long tail of 30-50 year careers), so a
    log transform stops the tail from dominating distance/linear models.
    CareerChanger = professional work years exceed coding years, meaning the
    person worked in another field before coding (about 6% of the cohort).
    Missing years stay NaN here and are imputed by the next step.
    """

    def fit(self, X, y=None):
        self.n_features_in_ = 2
        return self

    def transform(self, X):
        X = pd.DataFrame(X, columns=C.NUMERIC_FEATURES)
        yc = pd.to_numeric(X["YearsCode"], errors="coerce").clip(lower=0)
        we = pd.to_numeric(X["WorkExp"], errors="coerce").clip(lower=0)
        changer = (we > yc).astype(float).where(yc.notna() & we.notna())
        return np.column_stack([np.log1p(yc), np.log1p(we), changer])

    def get_feature_names_out(self, input_features=None):
        return np.array(["log_YearsCode", "log_WorkExp", "CareerChanger"], dtype=object)


class AsObject(BaseEstimator, TransformerMixin):
    """Convert columns to plain object dtype with np.nan for missing values.

    pandas 3 stores text as a dedicated string dtype; SimpleImputer and
    OneHotEncoder expect object arrays, so this keeps the pipeline working on
    both pandas 2.x and 3.x without any manual conversion by the caller.
    """

    def fit(self, X, y=None):
        X = pd.DataFrame(X)
        self.columns_ = list(X.columns)
        self.n_features_in_ = X.shape[1]
        return self

    def transform(self, X):
        X = pd.DataFrame(X, columns=self.columns_)
        out = np.empty(X.shape, dtype=object)
        for j, c in enumerate(self.columns_):
            col = X[c].astype("object")
            out[:, j] = col.where(col.notna(), np.nan).to_numpy()
        return out

    def get_feature_names_out(self, input_features=None):
        check_is_fitted(self, "columns_")
        return np.array(self.columns_, dtype=object)
