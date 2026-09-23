"""Loading helpers for the raw survey files."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd

from . import config as C


def load_raw(path: str | Path | None = None, use_cache: bool = True) -> pd.DataFrame:
    """Load survey_results_public.csv (49,123 rows x 170 columns).

    A parquet copy is cached in data/interim because reading the 140 MB CSV
    takes several seconds and every notebook needs it.
    """
    path = Path(path) if path else C.RAW_CSV
    cache = C.INTERIM_DIR / "raw.parquet"
    if use_cache and cache.exists() and cache.stat().st_mtime >= path.stat().st_mtime:
        return pd.read_parquet(cache)
    df = pd.read_csv(path, low_memory=False)
    if use_cache:
        cache.parent.mkdir(parents=True, exist_ok=True)
        df.to_parquet(cache, index=False)
    return df


def load_schema(path: str | Path | None = None) -> pd.DataFrame:
    """Load survey_results_schema.csv (question text for each qname)."""
    return pd.read_csv(Path(path) if path else C.SCHEMA_CSV)


@lru_cache(maxsize=1)
def country_region_table() -> pd.DataFrame:
    """Country -> ISO3, UN M49 subregion and the 13 analysis regions."""
    return pd.read_csv(C.COUNTRY_REGION_CSV)


def country_to_region(country: pd.Series) -> pd.Series:
    """Map survey country names to analysis regions (NaN when unknown)."""
    table = country_region_table()
    return country.map(dict(zip(table["Country"], table["Region"])))
