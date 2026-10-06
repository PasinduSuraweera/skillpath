"""Checks for the insights shown next to each recommended role (src/skillpath/insights.py).

  * the committed artifacts/insights.json is exactly what the build script
    would write today (a stale file once broke the running API)
  * the skill gap only suggests technologies that are common in the role and
    more common than overall, and never one the user already has
  * the salary benchmark falls back from local to worldwide groups in the
    documented order and never uses a group smaller than MIN_PEER_N
  * the AI outlook falls back to the role family for a small role

Run:  pytest -q tests/test_insights.py
"""
from __future__ import annotations

import json

import pandas as pd
import pytest

from skillpath import config as C
from skillpath import insights as I


@pytest.fixture(scope="module")
def tables():
    return I.load_tables()


# --- the committed artifact ---------------------------------------------------
def test_committed_insights_json_is_up_to_date(tables):
    """Re-run scripts/build_app_tables.py if this fails, then restart the API."""
    rebuilt = I.build_tables(
        pd.read_parquet(C.REFERENCE_DIR / "ai_exposure_role_cohort.parquet"),
        pd.read_parquet(C.REFERENCE_DIR / "salary_reference.parquet"),
        pd.read_csv(C.REPORTS_DIR / "stage7_test_per_class.csv"),
        pd.read_parquet(C.PROCESSED_DIR / "train.parquet"),
    )
    assert json.loads(json.dumps(rebuilt, ensure_ascii=False)) == tables


def test_every_job_role_has_every_insight(tables):
    for job in C.JOB_ROLE_LABEL:
        assert job in tables["ai"]["job_role"], job
        assert job in tables["roles"], job
        assert tables["skills"]["technologies"].get(job), job
        assert tables["skills"]["role_n"][job] > 0, job


def test_skill_tables_respect_the_documented_thresholds(tables):
    for job, techs in tables["skills"]["technologies"].items():
        assert len(techs) <= I.SKILL_TOP_N, job
        for s in techs:
            assert s["area"] in I.SKILL_GAP_BLOCKS, s
            assert s["share_pct"] >= I.SKILL_MIN_SHARE * 100, (job, s)
            assert s["lift"] >= I.SKILL_MIN_LIFT, (job, s)


def test_skill_tables_are_built_from_the_training_split_only(tables):
    train = pd.read_parquet(C.PROCESSED_DIR / "train.parquet", columns=[C.TARGET_JOB])
    assert tables["sources"]["skill_rows"] == len(train)
    assert sum(tables["skills"]["role_n"].values()) == len(train)


def test_salary_groups_are_never_smaller_than_the_minimum(tables):
    for level, groups in tables["salary"]["groups"].items():
        for key, g in groups.items():
            assert g["n"] >= C.MIN_PEER_N, (level, key)
            assert g["p25"] <= g["median"] <= g["p75"], (level, key)


def test_distinctive_technologies_make_sense():
    """A sanity check a reader can verify: each role's signature technology."""
    techs = {job: [s["technology"] for s in v] for job, v in I.load_tables()["skills"]["technologies"].items()}
    assert "Jupyter Notebook/JupyterLab" in techs["Data scientist"]
    assert "Kotlin" in techs["Developer, mobile"] and "Swift" in techs["Developer, mobile"]
    assert "Python" not in techs["Developer, front-end"]


# --- skill gap ----------------------------------------------------------------
def _toy_train():
    """Two roles over one technology area. 'R' is common in data roles and rare
    elsewhere; 'Python' is common everywhere; 'Rust' is too rare to matter."""
    have, gate = C.TECH_BLOCKS["Language"][0], C.TECH_BLOCKS["Language"][2]
    rows = (
        [("Data scientist", "R;Python")] * 30 + [("Data scientist", "Python")] * 10
        + [("Developer, back-end", "Python")] * 30 + [("Developer, back-end", "Python;Rust")] * 5
        + [("Developer, back-end", None)] * 50     # skipped the question: must not dilute shares
    )
    frame = pd.DataFrame(rows, columns=[C.TARGET_JOB, have])
    frame[gate] = None
    for block in I.SKILL_GAP_BLOCKS[1:]:
        frame[C.TECH_BLOCKS[block][0]] = None
        frame[C.TECH_BLOCKS[block][2]] = None
    return frame


def test_role_technologies_keep_only_common_and_characteristic_ones():
    techs = I._role_technologies(_toy_train())
    data = {s["technology"]: s for s in techs["Data scientist"]}
    assert set(data) == {"R"}                  # Python is common but not characteristic (lift < 1.1)
    assert data["R"]["share_pct"] == 75.0      # 30 of the 40 who answered
    assert data["R"]["lift"] == pytest.approx(0.75 / (30 / 75), abs=0.01)
    assert "Developer, back-end" not in techs  # Rust: 5 people is under SKILL_MIN_COUNT


def _gap_tables():
    techs = [{"technology": t, "area": "Language", "share_pct": 50.0, "lift": 2.0}
             for t in ["R", "Python", "SQL", "Julia", "Scala", "MATLAB", "SAS"]]
    return {"skills": {"role_n": {"Data scientist": 40}, "technologies": {"Data scientist": techs}}}


def test_skill_gap_splits_matched_and_missing_in_rank_order():
    gap = I.skill_gap(_gap_tables(), "Data scientist", {"Language": {"have": ["Python", "SAS"], "want": ["Julia"]}})
    assert gap["matched"] == ["Python", "SAS"]
    assert [s["technology"] for s in gap["missing"]] == ["R", "SQL", "Julia", "Scala", "MATLAB"]
    assert [s["wanted"] for s in gap["missing"]] == [False, False, True, False, False]
    assert gap["typical_count"] == 7 and gap["role_n"] == 40


def test_skill_gap_with_no_technology_answers_lists_the_top_five():
    for tech in (None, {}, {"Webframe": {"none": True}}):
        gap = I.skill_gap(_gap_tables(), "Data scientist", tech)
        assert gap["matched"] == [] and len(gap["missing"]) == I.SKILL_GAP_SHOWN


def test_skill_gap_for_a_role_without_a_table_is_empty():
    gap = I.skill_gap(_gap_tables(), "Developer, mobile", {"Language": {"have": ["Kotlin"]}})
    assert gap == {"role_n": 0, "typical_count": 0, "matched": [], "missing": []}


# --- salary benchmark ---------------------------------------------------------
def _salary_tables(**cells):
    """Salary tables where only the given levels have a group for a back-end developer in Sri Lanka."""
    keys = {
        "JobRole x Country x experience": "Developer, back-end|Sri Lanka|3-5",
        "JobRole x Region x experience": "Developer, back-end|South Asia|3-5",
        "RoleFamily x Country x experience": "Backend|Sri Lanka|3-5",
        "RoleFamily x Region x experience": "Backend|South Asia|3-5",
        "JobRole x Global x experience": "Developer, back-end|3-5",
        "RoleFamily x Global x experience": "Backend|3-5",
    }
    groups = {level: {} for level in keys}
    for level, n in cells.items():
        level = level.replace("_", " ")
        groups[level][keys[level]] = {"n": n, "p25": 10000, "median": 20000, "p75": 30000}
    return {"salary": {"groups": groups}}


@pytest.mark.parametrize("available, expected", [
    (["JobRole x Country x experience", "JobRole x Global x experience"], "JobRole x Country x experience"),
    (["JobRole x Region x experience", "RoleFamily x Country x experience"], "JobRole x Region x experience"),
    (["RoleFamily x Country x experience", "JobRole x Global x experience"], "RoleFamily x Country x experience"),
    (["RoleFamily x Region x experience", "JobRole x Global x experience"], "RoleFamily x Region x experience"),
    (["JobRole x Global x experience", "RoleFamily x Global x experience"], "JobRole x Global x experience"),
    (["RoleFamily x Global x experience"], "RoleFamily x Global x experience"),
])
def test_salary_uses_the_most_specific_group_available(available, expected):
    tables = _salary_tables(**{lvl.replace(" ", "_"): 40 for lvl in available})
    s = I.salary_benchmark(tables, "Developer, back-end", "Sri Lanka", 4)
    assert s["available"] and s["level"] == expected
    assert s["local"] == ("Global" not in expected)
    assert s["experience_band"] == "3-5"


def test_salary_without_country_skips_the_local_levels():
    tables = _salary_tables(JobRole_x_Country_x_experience=40, JobRole_x_Global_x_experience=40)
    s = I.salary_benchmark(tables, "Developer, back-end", None, 4)
    assert s["level"] == "JobRole x Global x experience" and not s["local"]
    assert s["peer_group"] == "Back-end Developers worldwide with 3-5 years of professional experience"


def test_salary_unavailable_without_experience_or_any_group():
    assert not I.salary_benchmark(_salary_tables(), "Developer, back-end", "Sri Lanka", None)["available"]
    s = I.salary_benchmark(_salary_tables(), "Developer, back-end", "Sri Lanka", 4)
    assert not s["available"] and str(C.MIN_PEER_N) in s["reason"]


@pytest.mark.parametrize("years, band", [(0, "0-2"), (2, "0-2"), (3, "3-5"), (5, "3-5"), (6, "6-10"),
                                         (10, "6-10"), (11, "11-20"), (20, "11-20"), (21, "20+"), (60, "20+")])
def test_experience_bands_have_inclusive_upper_edges(years, band):
    assert I.band_of(years) == band


def test_region_lookup():
    assert I.region_of("Sri Lanka") == "South Asia"
    assert I.region_of(None) is None
    assert I.region_of("Atlantis") is None


# --- AI outlook ---------------------------------------------------------------
def test_ai_outlook_uses_the_role_or_falls_back_to_its_family():
    stats = {"n": 100, "exposure_now": 50.0, "exposure_expected": 60.0, "threat_yes_pct": 10.0, "threat_n": 90}
    tables = {"ai": {
        "job_role": {"Developer, back-end": stats, "Developer, mobile": {**stats, "n": C.MIN_PEER_N - 1}},
        "family": {"Mobile": {**stats, "exposure_now": 40.0}},
        "all": stats,
    }}
    assert I.ai_outlook(tables, "Developer, back-end")["level"] == "job role"
    small = I.ai_outlook(tables, "Developer, mobile")
    assert small["level"] == "role family" and small["exposure_now"] == 40.0
    assert small["all_roles"] == stats
