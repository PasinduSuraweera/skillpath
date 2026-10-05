"""Build the small lookup tables the web backend shows next to each job role.

    python scripts/build_app_tables.py      -> artifacts/insights.json  (~1 s)

Reads the reference datasets written by build_dataset.py and the final model's
per-class test results written by finalise_model.py, and stores only group
summaries (AI exposure per role, salary quantiles per peer group with 30+
people, per-role reliability). No respondent-level row reaches the artifact, so
the deployed app does not need data/ at all.
"""
from __future__ import annotations

import json

import pandas as pd

from skillpath import config as C
from skillpath import insights


def main():
    ai_ref = pd.read_parquet(C.REFERENCE_DIR / "ai_exposure_role_cohort.parquet")
    salary_ref = pd.read_parquet(C.REFERENCE_DIR / "salary_reference.parquet")
    per_class = pd.read_csv(C.REPORTS_DIR / "stage7_test_per_class.csv")

    tables = insights.build_tables(ai_ref, salary_ref, per_class)
    insights.INSIGHTS_JSON.write_text(json.dumps(tables, indent=1, ensure_ascii=False))

    groups = tables["salary"]["groups"]
    print(f"Wrote {insights.INSIGHTS_JSON}  ({insights.INSIGHTS_JSON.stat().st_size / 1024:.0f} KB)")
    print(f"  AI outlook: {len(tables['ai']['job_role'])} job roles from {tables['sources']['ai_rows']:,} train rows")
    print(f"  salary peer groups with {C.MIN_PEER_N}+ people: "
          + ", ".join(f"{k.split(' x experience')[0]} {len(v)}" for k, v in groups.items()))
    low = [C.JOB_ROLE_LABEL[k] for k, v in tables["roles"].items() if v["low_confidence"]]
    print(f"  low-confidence roles (test recall < {insights.LOW_CONFIDENCE_RECALL}): {', '.join(low)}")


if __name__ == "__main__":
    main()
