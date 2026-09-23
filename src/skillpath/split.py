"""Stratified train/test split, frozen to disk by ResponseId.

The split is made once, right after the deterministic cleaning and before any
statistic is learned. Every notebook and the web build reload the same IDs, so
the test set is never used for EDA decisions, vocabularies, imputation values,
scaling, feature selection, resampling or model tuning.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

from . import config as C

SPLIT_FILE = C.PROCESSED_DIR / "split_ids.csv"


def make_split(cohort: pd.DataFrame, test_size: float = C.TEST_SIZE,
               stratify_on: str = C.STRATIFY_ON, seed: int = C.RANDOM_STATE) -> pd.DataFrame:
    """Return a ResponseId -> {'train','test'} table."""
    train_ids, test_ids = train_test_split(
        cohort[C.ID_COL],
        test_size=test_size,
        stratify=cohort[stratify_on],
        random_state=seed,
    )
    split = pd.concat(
        [
            pd.DataFrame({C.ID_COL: train_ids, "split": "train"}),
            pd.DataFrame({C.ID_COL: test_ids, "split": "test"}),
        ]
    ).sort_values(C.ID_COL)
    return split.reset_index(drop=True)


def save_split(split: pd.DataFrame, path: Path = SPLIT_FILE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    split.to_csv(path, index=False)


def load_split(path: Path = SPLIT_FILE) -> pd.DataFrame:
    return pd.read_csv(path)


def attach_split(df: pd.DataFrame, split: pd.DataFrame) -> pd.DataFrame:
    return df.merge(split, on=C.ID_COL, how="left")
