"""Row-level cleaning rules.

These rules are deterministic (no statistics are learned from the data), so
applying them to the whole file before the train/test split cannot leak test
information. Anything that learns from data lives in features.py / pipeline.py
and is fitted on the training split only.

Every function returns the cleaned frame plus a small report dict so the
notebooks and the build script can show exactly how many rows each rule hit.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C
from .data import country_to_region
from .features import parse_tokens


def answered_count(df: pd.DataFrame) -> pd.Series:
    """Number of non-empty fields per response, excluding the ID column."""
    return df.drop(columns=[C.ID_COL], errors="ignore").notna().sum(axis=1)


def drop_near_empty(df: pd.DataFrame, max_answered: int = C.NEAR_EMPTY_MAX_ANSWERED):
    """Remove responses that stopped after the screening questions."""
    n_ans = answered_count(df)
    keep = n_ans > max_answered
    report = {
        "rule": f"near-empty responses (<= {max_answered} answered fields)",
        "rows_before": int(len(df)),
        "rows_removed": int((~keep).sum()),
        "rows_after": int(keep.sum()),
    }
    return df.loc[keep].copy(), report


def drop_exact_duplicates(df: pd.DataFrame):
    """Remove rows identical on every field except ResponseId."""
    dup = df.drop(columns=[C.ID_COL], errors="ignore").duplicated(keep="first")
    report = {
        "rule": "exact duplicate responses (all fields except ResponseId)",
        "rows_before": int(len(df)),
        "rows_removed": int(dup.sum()),
        "rows_after": int((~dup).sum()),
    }
    return df.loc[~dup].copy(), report


def drop_straightliners(df: pd.DataFrame, share: float = C.STRAIGHTLINE_SHARE):
    """Remove careless responses that tick (almost) every technology option.

    A respondent who selects at least `share` of all options in any "have" list
    (e.g. 38+ of 42 languages as extensive work in the past year) is not giving
    usable skill information. The rule uses the questionnaire's option counts,
    not statistics from the data, so it is safe before the split.
    """
    flag = pd.Series(False, index=df.index)
    per_block = {}
    for block, (have, _, _) in C.TECH_BLOCKS.items():
        n_opt = C.TECH_OPTION_COUNTS[block]
        hit = df[have].map(parse_tokens).map(len) >= share * n_opt
        per_block[block] = int(hit.sum())
        flag |= hit
    report = {
        "rule": f"straight-lining: ticked >= {share:.0%} of the options in any technology list",
        "rows_before": int(len(df)),
        "rows_removed": int(flag.sum()),
        "rows_after": int((~flag).sum()),
        "hits_per_block": per_block,
    }
    return df.loc[~flag].copy(), report


def clean_experience(df: pd.DataFrame):
    """Fix the two experience fields.

    1. WorkExp blank -> 0 when YearsCode was answered. The question says
       "If your answer is '0', please leave blank" (no respondent entered 0),
       and blank-WorkExp respondents are young (about 70% aged 18-24) with
       few coding years (median 5 vs 15), which matches "no work experience yet".
    2. Values that are impossible for the respondent's age band become NaN
       (later imputed on the training data): coding cannot start before age 5
       and paid work before age 14. Placeholder answers such as 100 are caught
       by this rule.
    WorkExp > YearsCode is NOT treated as an error: WorkExp is total
    professional work, which can include years before someone learned to code
    (career changers).
    """
    out = df.copy()
    report = {}

    blank_work = out["WorkExp"].isna() & out["YearsCode"].notna()
    out.loc[blank_work, "WorkExp"] = 0
    report["WorkExp blank set to 0 (survey instruction)"] = int(blank_work.sum())

    upper = out["Age"].map(C.AGE_BAND_UPPER)
    max_code = (upper - C.MIN_START_AGE_CODING).fillna(C.MAX_YEARS_FALLBACK)
    max_work = (upper - C.MIN_START_AGE_WORK).fillna(C.MAX_YEARS_FALLBACK)
    bad_code = out["YearsCode"] > max_code
    bad_work = out["WorkExp"] > max_work
    out.loc[bad_code, "YearsCode"] = np.nan
    out.loc[bad_work, "WorkExp"] = np.nan
    report["YearsCode impossible for age band -> NaN"] = int(bad_code.sum())
    report["WorkExp impossible for age band -> NaN"] = int(bad_work.sum())
    report["WorkExp > YearsCode kept (career changers)"] = int((out["WorkExp"] > out["YearsCode"]).sum())
    return out, report


def add_region(df: pd.DataFrame) -> pd.DataFrame:
    """Add the 13-value Region column derived from Country (UN M49 based)."""
    out = df.copy()
    out["Region"] = country_to_region(out["Country"])
    return out


def experience_band(years: pd.Series) -> pd.Series:
    """Bucket professional experience into the salary peer-group bands."""
    return pd.cut(
        years,
        bins=C.EXPERIENCE_BANDS,
        labels=C.EXPERIENCE_BAND_LABELS,
        include_lowest=True,
        right=True,
    ).astype("object")


def salary_hard_bounds(df: pd.DataFrame, col: str = C.SALARY_COL):
    """Stage 1 salary rule: keep USD 1,000 to 1,000,000 per year."""
    y = df[col]
    keep = y.between(C.SALARY_MIN, C.SALARY_MAX)
    report = {
        "rule": f"salary outside ${C.SALARY_MIN:,} to ${C.SALARY_MAX:,}",
        "rows_before": int(len(df)),
        "below_min": int((y < C.SALARY_MIN).sum()),
        "above_max": int((y > C.SALARY_MAX).sum()),
        "rows_after": int(keep.sum()),
    }
    return df.loc[keep].copy(), report


def fit_salary_outlier_rule(ref: pd.DataFrame, col: str = C.SALARY_COL) -> dict:
    """Learn per-country (or per-region) median and MAD of log10 salary.

    Fitted on reference (non-test) rows only. Countries with fewer than
    SALARY_MIN_GROUP_N respondents fall back to their region.
    """
    ly = np.log10(ref[col])
    stats = {}
    for level in ("Country", "Region"):
        g = ly.groupby(ref[level])
        med = g.median()
        mad = g.apply(lambda v: (v - v.median()).abs().median())
        n = g.size()
        stats[level] = {
            k: {"median": float(med[k]), "mad": float(mad[k]), "n": int(n[k])}
            for k in med.index
            if n[k] >= C.SALARY_MIN_GROUP_N and mad[k] > 0
        }
    return stats


def apply_salary_outlier_rule(df: pd.DataFrame, stats: dict, col: str = C.SALARY_COL):
    """Stage 2 salary rule: drop |robust z| > SALARY_ROBUST_Z on log10 salary.

    Catches entries that are plausible in absolute terms but implausible for
    the country, e.g. US salaries of "130" typed in thousands or per month.
    """
    ly = np.log10(df[col])
    med = pd.Series(np.nan, index=df.index)
    mad = pd.Series(np.nan, index=df.index)
    for level in ("Region", "Country"):  # country overrides region when available
        m = df[level].map({k: v["median"] for k, v in stats[level].items()})
        s = df[level].map({k: v["mad"] for k, v in stats[level].items()})
        med = m.where(m.notna(), med)
        mad = s.where(s.notna(), mad)
    z = 0.6745 * (ly - med) / mad
    flag = z.abs() > C.SALARY_ROBUST_Z
    report = {
        "rule": f"robust z-score of log10 salary > {C.SALARY_ROBUST_Z} within country/region",
        "rows_before": int(len(df)),
        "flag_low": int((z < -C.SALARY_ROBUST_Z).sum()),
        "flag_high": int((z > C.SALARY_ROBUST_Z).sum()),
        "no_reference_group": int(z.isna().sum()),
        "rows_after": int((~flag).sum()),
    }
    out = df.loc[~flag].copy()
    out["salary_robust_z"] = z[~flag]
    return out, report
