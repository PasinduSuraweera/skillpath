"""Cohort construction for the recommender and the supporting analyses.

Cohorts are defined by fixed, documented rules (no learned statistics), and
each builder returns an attrition table so the report can show how many
records every rule removed.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C
from .cleaning import add_region, experience_band


def _step(name: str, frame: pd.DataFrame, rows: list) -> None:
    rows.append({"step": name, "records": int(len(frame))})


def add_targets(df: pd.DataFrame) -> pd.DataFrame:
    """Add JobRole (the DevType value) and RoleFamily when DevType is in scope."""
    out = df.copy()
    in_scope = out[C.TARGET_SOURCE].isin(C.ROLE_FAMILY)
    out[C.TARGET_JOB] = out[C.TARGET_SOURCE].where(in_scope)
    out[C.TARGET_FAMILY] = out[C.TARGET_SOURCE].map(C.ROLE_FAMILY)
    return out


def build_role_cohort(clean: pd.DataFrame, raw_rows: int | None = None,
                      near_empty_removed: pd.DataFrame | None = None):
    """Primary recommender cohort (proposal Section 3.2.1).

    `clean` must already have near-empty, duplicate and straight-lined rows removed.
    """
    rows: list = []
    if raw_rows is not None:
        rows.append({"step": "Raw public results file", "records": int(raw_rows)})
    _step("Remove near-empty, duplicate and straight-lined responses", clean, rows)

    has_role = clean[C.TARGET_SOURCE].notna() & ~clean[C.TARGET_SOURCE].isin(
        ["Student", "Retired", "Other (please specify):"]
    )
    d = clean.loc[has_role]
    _step("Keep a specific developer role (drop missing DevType, Student, Retired, Other)", d, rows)

    d = d.loc[d[C.TARGET_SOURCE].isin(C.ROLE_FAMILY)]
    _step("Keep skill-defined technical roles (drop management/seniority/non-technical)", d, rows)

    d = d.loc[d["LanguageHaveWorkedWith"].notna()]
    _step("Keep respondents who answered the main technology question", d, rows)

    d = add_region(add_targets(d))
    return d.reset_index(drop=True), pd.DataFrame(rows)


def build_salary_cohort(clean: pd.DataFrame):
    """Employed/self-employed professional developers who reported pay."""
    rows: list = []
    d = clean.loc[clean["MainBranch"] == C.SALARY_MAIN_BRANCH]
    _step("Developer by profession", d, rows)
    d = d.loc[d["Employment"].isin(C.SALARY_EMPLOYMENT)]
    _step("Employed or self-employed", d, rows)
    d = d.loc[d[C.SALARY_COL].notna()]
    _step("Reported annual compensation", d, rows)
    d = add_region(add_targets(d))
    d["ExperienceBand"] = experience_band(d["WorkExp"])
    return d.reset_index(drop=True), pd.DataFrame(rows)


def build_persona_cohort(clean: pd.DataFrame):
    """Usable respondents who answered every AI usage/attitude question."""
    d = clean.loc[clean[C.PERSONA_FEATURES].notna().all(axis=1)]
    d = add_region(add_targets(d))
    rows = [{"step": "Answered all six AI usage/attitude questions", "records": int(len(d))}]
    return d.reset_index(drop=True), pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# AI task matrix -> per-respondent AI Exposure Index
# ---------------------------------------------------------------------------
_LEVEL_NAME = {
    "AIToolCurrently mostly AI": "mostly_now",
    "AIToolCurrently partially AI": "partially_now",
    "AIToolPlan to mostly use AI": "plan_mostly",
    "AIToolPlan to partially use AI": "plan_partially",
    "AIToolDon't plan to use AI for this task": "no_plan",
}
_NOW_WEIGHT = {"mostly_now": 1.0, "partially_now": 0.5}
_EXPECTED_WEIGHT = {"mostly_now": 1.0, "plan_mostly": 1.0, "partially_now": 0.5, "plan_partially": 0.5}


def ai_task_levels(df: pd.DataFrame) -> pd.DataFrame:
    """One column per development task holding the respondent's AI level.

    The survey stores the matrix as five multi-select columns (one per level).
    Each task appears in at most one of them per respondent (verified: zero
    conflicts), so the matrix can be pivoted into one categorical per task.
    """
    out = pd.DataFrame(index=df.index)
    for task in C.AI_TASKS:
        level = pd.Series(np.nan, index=df.index, dtype="object")
        for col, name in _LEVEL_NAME.items():
            hit = df[col].fillna("").str.split(C.MULTI_SEP).apply(lambda toks, t=task: t in toks)
            level = level.mask(hit, name)
        out[task] = level
    return out


def ai_exposure_index(df: pd.DataFrame) -> pd.DataFrame:
    """Per-respondent AI Exposure Index (0-100), current and expected.

    now      = mean over rated tasks of (mostly now = 1, partially now = 0.5, else 0)
    expected = mean over rated tasks of (mostly now or planned mostly = 1,
               partially now or planned partially = 0.5, no plan = 0)
    Only computed when at least AI_MIN_TASKS_ANSWERED of 13 tasks were rated.
    """
    levels = ai_task_levels(df)
    rated = levels.notna().sum(axis=1)
    now = levels.apply(lambda s: s.map(_NOW_WEIGHT).fillna(0).where(s.notna())).mean(axis=1)
    exp = levels.apply(lambda s: s.map(_EXPECTED_WEIGHT).fillna(0).where(s.notna())).mean(axis=1)
    ok = rated >= C.AI_MIN_TASKS_ANSWERED
    res = pd.DataFrame(
        {
            "ai_tasks_rated": rated,
            "ai_exposure_now": (now * 100).where(ok),
            "ai_exposure_expected": (exp * 100).where(ok),
        },
        index=df.index,
    )
    return pd.concat([res, levels.add_prefix("task: ")], axis=1)
