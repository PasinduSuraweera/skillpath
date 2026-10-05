"""Supporting insights shown next to each recommended job role.

Two lookups, both built from reference tables that exclude the 4,615
recommender test respondents (preprocessing decision 27):

* AI outlook: mean AI Exposure Index (now and expected) and the share of
  respondents who say AI threatens their job, per job role (decision 29).
* Salary benchmark: median and interquartile range of annual pay for the most
  specific peer group with at least MIN_PEER_N people, always within the
  user's experience band (decisions 24 and 30, config.PEER_GROUP_LEVELS).

build_tables() turns the reference parquet files into one small JSON-ready
dict (scripts/build_app_tables.py writes it to artifacts/insights.json). The
lookup functions only read that dict, so the web app never needs the
respondent-level data.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from . import config as C
from .cleaning import experience_band
from .data import country_region_table

INSIGHTS_JSON = C.ARTIFACTS_DIR / "insights.json"

# A role is flagged as low confidence when, on the held-out test split, the
# model picked it as the first choice for fewer than 1 in 10 people who really
# hold it (recall < 0.10). Seven roles, all with fewer than 70 test examples;
# two of them are never predicted at all (model card, known limitations).
LOW_CONFIDENCE_RECALL = 0.10


# ---------------------------------------------------------------------------
# Building the tables (offline, from data/reference and reports/)
# ---------------------------------------------------------------------------
def _ai_summary(frame: pd.DataFrame) -> dict:
    rated = frame["ai_exposure_now"].notna()
    threat = frame["AIThreat"].dropna()
    return {
        "n": int(rated.sum()),
        "exposure_now": round(float(frame.loc[rated, "ai_exposure_now"].mean()), 1),
        "exposure_expected": round(float(frame.loc[rated, "ai_exposure_expected"].mean()), 1),
        "threat_yes_pct": round(float((threat == "Yes").mean() * 100), 1),
        "threat_n": int(len(threat)),
    }


def level_name(role_col: str, geo: str | None) -> str:
    """Readable peer-group level, e.g. 'JobRole x Region x experience'."""
    return f"{role_col} x {geo or 'Global'} x experience"


def _salary_groups(ref: pd.DataFrame) -> dict:
    """Pay quantiles for every peer group with at least MIN_PEER_N people."""
    groups = {}
    for role_col, geo in C.PEER_GROUP_LEVELS:
        keys = [role_col] + ([geo] if geo else []) + ["ExperienceBand"]
        g = ref.dropna(subset=keys).groupby(keys)[C.SALARY_COL]
        stats = pd.DataFrame({
            "n": g.size(),
            "p25": g.quantile(0.25),
            "median": g.median(),
            "p75": g.quantile(0.75),
        })
        stats = stats[stats["n"] >= C.MIN_PEER_N]
        groups[level_name(role_col, geo)] = {
            "|".join(map(str, key)): {
                "n": int(row["n"]),
                # pay is shown rounded to the nearest 100 USD; more precision is noise
                "p25": int(round(row["p25"], -2)),
                "median": int(round(row["median"], -2)),
                "p75": int(round(row["p75"], -2)),
            }
            for key, row in stats.iterrows()
        }
    return groups


def build_tables(ai_ref: pd.DataFrame, salary_ref: pd.DataFrame, per_class: pd.DataFrame) -> dict:
    """Everything the backend needs, as plain JSON-serialisable values.

    ai_ref     : data/reference/ai_exposure_role_cohort.parquet (train rows are used)
    salary_ref : data/reference/salary_reference.parquet (already excludes test rows)
    per_class  : reports/stage7_test_per_class.csv (final model, held-out split)
    """
    ai = ai_ref[ai_ref["split"] == "train"]
    roles = {
        job: {
            "test_f1": round(float(r["f1-score"]), 3),
            "test_recall": round(float(r["recall"]), 3),
            "test_support": int(r["support"]),
            "low_confidence": bool(r["recall"] < LOW_CONFIDENCE_RECALL),
        }
        for job, r in per_class.set_index("job_role").iterrows()
    }
    return {
        "ai": {
            "job_role": {k: _ai_summary(g) for k, g in ai.groupby(C.TARGET_JOB)},
            "family": {k: _ai_summary(g) for k, g in ai.groupby(C.TARGET_FAMILY)},
            "all": _ai_summary(ai),
        },
        "salary": {
            "min_peer_n": C.MIN_PEER_N,
            "levels": [level_name(r, g) for r, g in C.PEER_GROUP_LEVELS],
            "groups": _salary_groups(salary_ref),
        },
        "roles": roles,
        "low_confidence_recall": LOW_CONFIDENCE_RECALL,
        "sources": {
            "ai_rows": int(len(ai)),
            "salary_rows": int(len(salary_ref)),
            "note": "Both tables exclude the 4,615 recommender test respondents.",
        },
    }


def load_tables(path: str | Path = INSIGHTS_JSON) -> dict:
    return json.loads(Path(path).read_text())


# ---------------------------------------------------------------------------
# Lookups (used by the web backend)
# ---------------------------------------------------------------------------
def region_of(country: str | None) -> str | None:
    if not country:
        return None
    table = country_region_table()
    hit = table.loc[table["Country"] == country, "Region"]
    return None if hit.empty or pd.isna(hit.iloc[0]) else str(hit.iloc[0])


def band_of(work_exp) -> str | None:
    """Experience band (0-2, 3-5, 6-10, 11-20, 20+) of professional work years."""
    if work_exp is None:
        return None
    band = experience_band(pd.Series([float(work_exp)])).iloc[0]
    return None if pd.isna(band) else str(band)


def ai_outlook(tables: dict, job_role: str) -> dict:
    """AI exposure and perceived threat for a job role, with the all-roles average.

    Falls back to the role's family when fewer than MIN_PEER_N respondents rated
    the AI tasks (does not happen with the current data; every role has 40+).
    """
    ai = tables["ai"]
    stats, level = ai["job_role"].get(job_role), "job role"
    if not stats or stats["n"] < C.MIN_PEER_N:
        stats, level = ai["family"][C.ROLE_FAMILY[job_role]], "role family"
    return {**stats, "level": level, "all_roles": ai["all"]}


def _peer_description(role_col: str, geo: str | None, job_role: str, values: dict, band: str) -> str:
    who = f"{C.JOB_ROLE_LABEL[job_role]}s" if role_col == "JobRole" else f"{values['RoleFamily']} developers"
    where = f"in {values[geo]}" if geo else "worldwide"
    return f"{who} {where} with {band} years of professional experience"


def salary_benchmark(tables: dict, job_role: str, country: str | None, work_exp) -> dict:
    """Pay of the most specific peer group with at least MIN_PEER_N people.

    Order (config.PEER_GROUP_LEVELS): job role in the user's country, job role in
    their region, family in country, family in region, job role worldwide,
    family worldwide, always within the user's experience band. The level used
    and the group size are returned so the app can say what the figure is based on.
    """
    band = band_of(work_exp)
    if band is None:
        return {"available": False,
                "reason": "Enter your years of professional experience to see a salary benchmark."}
    values = {
        "JobRole": job_role,
        "RoleFamily": C.ROLE_FAMILY[job_role],
        "Country": country,
        "Region": region_of(country),
    }
    groups = tables["salary"]["groups"]
    for role_col, geo in C.PEER_GROUP_LEVELS:
        if geo and not values[geo]:
            continue
        key = "|".join([values[role_col]] + ([values[geo]] if geo else []) + [band])
        cell = groups[level_name(role_col, geo)].get(key)
        if cell:
            return {
                "available": True,
                **cell,
                "currency": "USD per year",
                "experience_band": band,
                "level": level_name(role_col, geo),
                "local": geo is not None,
                "peer_group": _peer_description(role_col, geo, job_role, values, band),
            }
    return {"available": False,
            "reason": f"Fewer than {C.MIN_PEER_N} salaried respondents match this role and experience level."}
