"""The preprocessing pipeline shared by modelling (Stage 6-7) and the web API.

build_preprocessor() returns an UNFITTED sklearn Pipeline (ColumnTransformer +
zero-variance filter). Wrap it together
with a model in an sklearn Pipeline and call fit() on the training rows only:

    from skillpath.pipeline import build_preprocessor, model_input_columns
    pipe = Pipeline([("prep", build_preprocessor()), ("clf", LogisticRegression())])
    pipe.fit(train[model_input_columns()], train["JobRole"])

Inside cross-validation every fold refits the vocabulary, imputation values
and scalers on that fold's training part, so no validation-fold information
leaks into preprocessing. The same fitted pipeline object is what the backend
loads, which guarantees identical preprocessing at prediction time.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_selection import VarianceThreshold
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from . import config as C
from .features import AsObject, ExperienceFeatures, OrdinalMapEncoder, RegionFromCountry, TechBlockEncoder

FEATURE_SETS = ("core", "core+context")


def _feature_lists(feature_set: str):
    if feature_set not in FEATURE_SETS:
        raise ValueError(f"feature_set must be one of {FEATURE_SETS}")
    ordinal = list(C.ORDINAL_FEATURES_CORE)
    nominal = ["LearnCodeAI"]
    if feature_set == "core+context":
        ordinal += C.ORDINAL_FEATURES_CONTEXT
        nominal += C.NOMINAL_FEATURES_CONTEXT
    return ordinal, nominal


def model_input_columns(feature_set: str = "core", include_want: bool = True) -> list:
    """Raw survey columns the preprocessor reads (what the API must supply)."""
    ordinal, nominal = _feature_lists(feature_set)
    tech = TechBlockEncoder(include_want=include_want).required_columns()
    return tech + C.NUMERIC_FEATURES + ordinal + ["Country"] + nominal


def build_preprocessor(feature_set: str = "core", min_frequency: float | int = C.MIN_TOKEN_FREQUENCY,
                       include_want: bool = True, scale: bool = True) -> Pipeline:
    """Assemble the (unfitted) preprocessing pipeline.

    Step 1 ("columns") is a ColumnTransformer with the branches below; step 2
    ("drop_constant") removes columns that are constant in the training data
    (e.g. an OTHER column for a block with no rare technologies), because a
    feature with zero variance cannot carry any information.

    Branches
    --------
    tech     : TechBlockEncoder (multi-hot + OTHER + breadth + unknown flags)
    exp      : ExperienceFeatures -> median impute (+ missing indicator) -> scale
    ordinal  : OrdinalMapEncoder -> median impute (+ missing indicator) -> scale
    region   : Country -> Region -> 'Missing' fill -> one-hot
    nominal  : 'Missing' fill -> one-hot (unknown categories ignored)

    Technology and one-hot columns are left as 0/1 on purpose; the indicator
    columns created inside the exp/ord branches are scaled with their branch.
    """
    ordinal, nominal = _feature_lists(feature_set)
    scaler = [("scale", StandardScaler())] if scale else []

    exp = Pipeline([
        ("build", ExperienceFeatures()),
        ("impute", SimpleImputer(strategy="median", add_indicator=True)),
        *scaler,
    ])
    ordn = Pipeline([
        ("map", OrdinalMapEncoder()),
        ("impute", SimpleImputer(strategy="median", add_indicator=True)),
        *scaler,
    ])
    region = Pipeline([
        ("region", RegionFromCountry()),
        ("impute", SimpleImputer(strategy="constant", fill_value="Missing")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    nom = Pipeline([
        ("as_object", AsObject()),
        ("impute", SimpleImputer(strategy="constant", fill_value="Missing")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    tech = TechBlockEncoder(min_frequency=min_frequency, include_want=include_want)

    ct = ColumnTransformer(
        [
            ("tech", tech, tech.required_columns()),
            ("exp", exp, C.NUMERIC_FEATURES),
            ("ord", ordn, ordinal),
            ("region", region, ["Country"]),
            ("nom", nom, nominal),
        ],
        remainder="drop",
        sparse_threshold=0.0,
        verbose_feature_names_out=True,
    )
    return Pipeline([("columns", ct), ("drop_constant", VarianceThreshold(threshold=0.0))])


def column_step(prep: Pipeline) -> ColumnTransformer:
    """The fitted ColumnTransformer inside a preprocessor built above."""
    return prep.named_steps["columns"]


def to_object(df):
    """Nominal inputs as plain object dtype (pandas 3 string dtype safe)."""
    out = df.copy()
    for c in out.columns:
        if not pd.api.types.is_numeric_dtype(out[c].dtype):
            out[c] = out[c].astype("object").where(out[c].notna(), np.nan)
    return out


def feature_group(name: str) -> str:
    """Readable group for a transformed feature name (for reports/plots)."""
    prefix, _, rest = name.partition("__")
    if prefix == "tech":
        block, _, kind = rest.partition("_")
        kind = kind.split("__")[0].split("_")[0]
        return f"{block} ({kind})"
    return {"exp": "Experience", "ord": "Ordinal (education, AI usage)", "region": "Region",
            "nom": "Nominal (AI learning, context)"}.get(prefix, prefix)
