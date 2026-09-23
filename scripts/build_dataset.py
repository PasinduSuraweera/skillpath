"""Build every preprocessing output from the raw survey file in one run.

    python scripts/build_dataset.py

Order matters and mirrors the leakage-safe workflow:
  1. deterministic row cleaning (no learned statistics)
  2. cohort rules
  3. stratified train/test split, frozen by ResponseId
  4. anything learned (vocabularies, imputation, scaling, salary outlier
     thresholds) is fitted on training / reference rows only
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from skillpath import config as C  # noqa: E402
from skillpath import cleaning, cohorts  # noqa: E402
from skillpath.data import load_raw  # noqa: E402
from skillpath.pipeline import build_preprocessor, feature_group, model_input_columns, to_object  # noqa: E402
from skillpath.profile import build_options, save_options  # noqa: E402
from skillpath.split import attach_split, make_split, save_split  # noqa: E402

KEEP_EXTRA = [
    "MainBranch", "Employment", "Age", "Country", "Region", "DevType", "AIThreat", "AIComplex",
    "AIAgentChange", "AIFrustration", "AIHuman", "AIAgents", "ConvertedCompYearly",
    *C.AI_TOOL_COLUMNS.keys(),
]


def feature_dictionary(names) -> pd.DataFrame:
    """One row per model feature: group, source column and transformation."""
    rows = []
    for n in names:
        branch, _, rest = n.partition("__")
        if branch == "tech":
            block, _, tail = rest.partition("_")
            kind = tail.split("_")[0]
            src = C.TECH_BLOCKS[block][0 if kind == "have" else 1]
            if tail.endswith("__OTHER"):
                t = "1 if any technology below the 0.5% training support (or unseen) was selected"
            elif tail.endswith("_count") and "want_new" in tail:
                src, t = f"{C.TECH_BLOCKS[block][0]} + {C.TECH_BLOCKS[block][1]}", "log1p(number wanted but not yet used)"
            elif tail.endswith("_count"):
                t = "log1p(number of technologies selected)"
            elif tail.endswith("_unknown"):
                src = f"{src} + {C.TECH_BLOCKS[block][2] or '(no gate question)'}"
                t = "1 if list empty and gate answer was not 'No' (unknown, not a true zero)"
            else:
                t = f"1 if '{tail.split('__', 1)[1]}' selected"
            rows.append((n, f"{block} ({kind})", src, "binary/numeric", t))
        elif branch == "exp":
            src = "YearsCode, WorkExp"
            t = ("missing-value indicator" if rest.startswith("missingindicator") else
                 "WorkExp > YearsCode (career changer), median-imputed, standardised" if rest == "CareerChanger" else
                 "log1p(years), median-imputed, standardised")
            rows.append((n, "Experience", src, "numeric", t))
        elif branch == "ord":
            col = rest.replace("missingindicator_", "").replace("_ord", "")
            t = "missing-value indicator (standardised)" if rest.startswith("missingindicator") else \
                "ordered answer scale -> integer, median-imputed, standardised"
            rows.append((n, "Ordinal", col, "numeric", t))
        elif branch == "region":
            rows.append((n, "Region", "Country", "binary", "one-hot of the UN M49 based region"))
        else:
            col = rest.split("_")[0]
            rows.append((n, "Nominal", col, "binary", "one-hot ('Missing' is its own category)"))
    return pd.DataFrame(rows, columns=["feature", "group", "source", "type", "transformation"])


def log(msg: str) -> None:
    print(f"[build] {msg}", flush=True)


def main() -> None:
    t0 = time.time()
    for d in (C.PROCESSED_DIR, C.REFERENCE_DIR, C.ARTIFACTS_DIR, C.REPORTS_DIR):
        d.mkdir(parents=True, exist_ok=True)

    # 1. deterministic cleaning --------------------------------------------
    raw = load_raw()
    log(f"raw file: {raw.shape[0]:,} rows x {raw.shape[1]} columns")
    report = {"raw_rows": int(len(raw)), "raw_columns": int(raw.shape[1]), "steps": []}

    clean, r = cleaning.drop_near_empty(raw)
    report["steps"].append(r)
    clean, r = cleaning.drop_exact_duplicates(clean)
    report["steps"].append(r)
    clean, r = cleaning.drop_straightliners(clean)
    report["steps"].append(r)
    clean, r = cleaning.clean_experience(clean)
    report["experience"] = r
    log(f"after row cleaning: {len(clean):,} rows")

    # 2. role cohort ---------------------------------------------------------
    role, attrition = cohorts.build_role_cohort(clean, raw_rows=len(raw))
    attrition.to_csv(C.REPORTS_DIR / "role_cohort_attrition.csv", index=False)
    log(f"role cohort: {len(role):,} rows, {role[C.TARGET_JOB].nunique()} job roles, "
        f"{role[C.TARGET_FAMILY].nunique()} families")

    # 3. split -------------------------------------------------------------
    split = make_split(role)
    save_split(split)
    role = attach_split(role, split)
    train, test = role[role.split == "train"].copy(), role[role.split == "test"].copy()
    test_ids = set(test[C.ID_COL])
    log(f"split: train {len(train):,} / test {len(test):,}")

    inputs_all = model_input_columns("core+context")
    keep = [C.ID_COL, C.TARGET_JOB, C.TARGET_FAMILY, "split"] + inputs_all + [
        c for c in KEEP_EXTRA if c not in inputs_all
    ]
    keep = list(dict.fromkeys(keep))
    role[keep].to_parquet(C.PROCESSED_DIR / "role_cohort.parquet", index=False)
    train[keep].to_parquet(C.PROCESSED_DIR / "train.parquet", index=False)
    test[keep].to_parquet(C.PROCESSED_DIR / "test.parquet", index=False)

    # 4a. fitted preprocessor on TRAIN only ------------------------------
    cols = model_input_columns("core")
    prep = build_preprocessor("core")
    Xtr = prep.fit_transform(to_object(train[cols]))
    Xte = prep.transform(to_object(test[cols]))
    names = prep.get_feature_names_out().tolist()
    joblib.dump(prep, C.ARTIFACTS_DIR / "preprocessor_core.joblib")
    (C.ARTIFACTS_DIR / "feature_names_core.json").write_text(json.dumps(names, indent=1))
    for part, X, frame in (("train", Xtr, train), ("test", Xte, test)):
        out = pd.DataFrame(X.astype(np.float32), columns=names)
        out.insert(0, C.ID_COL, frame[C.ID_COL].to_numpy())
        out[C.TARGET_JOB] = frame[C.TARGET_JOB].to_numpy()
        out[C.TARGET_FAMILY] = frame[C.TARGET_FAMILY].to_numpy()
        out.to_parquet(C.PROCESSED_DIR / f"features_core_{part}.parquet", index=False)
    log(f"preprocessor (core): {Xtr.shape[1]} features; train {Xtr.shape}, test {Xte.shape}")

    (C.REPORTS_DIR / "feature_dictionary.csv").write_text(feature_dictionary(names).to_csv(index=False))
    groups = pd.Series([feature_group(n) for n in names]).value_counts()
    report["feature_groups_core"] = groups.to_dict()
    report["n_features_core"] = int(Xtr.shape[1])

    prep_ctx = build_preprocessor("core+context").fit(to_object(train[model_input_columns("core+context")]))
    report["n_features_core_context"] = int(len(prep_ctx.get_feature_names_out()))

    save_options(build_options(train), C.ARTIFACTS_DIR / "options.json")

    # 4b. reference datasets for the supporting analyses (no test rows) ---
    ai = cohorts.ai_exposure_index(role)
    ai_ref = pd.concat([role[[C.ID_COL, C.TARGET_JOB, C.TARGET_FAMILY, "split", "AIThreat"]], ai], axis=1)
    ai_ref.to_parquet(C.REFERENCE_DIR / "ai_exposure_role_cohort.parquet", index=False)
    report["ai_exposure"] = {
        "matrix_respondents": int((ai["ai_tasks_rated"] > 0).sum()),
        "index_computed": int(ai["ai_exposure_now"].notna().sum()),
        "index_computed_train": int(ai.loc[role.split == "train", "ai_exposure_now"].notna().sum()),
    }

    persona, _ = cohorts.build_persona_cohort(clean)
    n_persona_all = len(persona)
    persona = persona[~persona[C.ID_COL].isin(test_ids)].copy()
    for f in C.PERSONA_FEATURES:
        persona[f + "_ord"] = persona[f].astype("object").map(C.ORDINAL_MAPS[f])
    persona_cols = [C.ID_COL, C.TARGET_JOB, C.TARGET_FAMILY, "Region"] + C.PERSONA_FEATURES + [
        f + "_ord" for f in C.PERSONA_FEATURES] + ["AIThreat", "LearnCodeAI"]
    persona[persona_cols].to_parquet(C.REFERENCE_DIR / "persona_inputs.parquet", index=False)
    report["persona"] = {
        "complete_ai_answers": int(n_persona_all),
        "after_excluding_role_test_ids": int(len(persona)),
        "AIComplex_not_applicable": int(persona["AIComplex_ord"].isna().sum()),
    }

    sal, sal_attr = cohorts.build_salary_cohort(clean)
    n_sal = len(sal)
    sal = sal[~sal[C.ID_COL].isin(test_ids)].copy()
    sal, r1 = cleaning.salary_hard_bounds(sal)
    stats = cleaning.fit_salary_outlier_rule(sal)
    sal, r2 = cleaning.apply_salary_outlier_rule(sal, stats)
    sal["log10_salary"] = np.log10(sal[C.SALARY_COL])
    sal_cols = [C.ID_COL, C.TARGET_JOB, C.TARGET_FAMILY, "DevType", "Country", "Region", "WorkExp",
                "ExperienceBand", "EdLevel", "OrgSize", "Employment", C.SALARY_COL, "log10_salary",
                "salary_robust_z"]
    sal[sal_cols].to_parquet(C.REFERENCE_DIR / "salary_reference.parquet", index=False)
    (C.ARTIFACTS_DIR / "salary_outlier_rule.json").write_text(json.dumps(stats, indent=1))
    sal_attr = pd.concat([sal_attr, pd.DataFrame([
        {"step": "Exclude recommender test-set respondents", "records": r1["rows_before"]},
        {"step": f"Keep ${C.SALARY_MIN:,} to ${C.SALARY_MAX:,}", "records": r1["rows_after"]},
        {"step": f"Drop |robust z| > {C.SALARY_ROBUST_Z} within country/region", "records": r2["rows_after"]},
    ])], ignore_index=True)
    sal_attr.to_csv(C.REPORTS_DIR / "salary_reference_attrition.csv", index=False)
    report["salary"] = {
        "cohort": int(n_sal),
        "excluded_role_test_ids": int(n_sal - (r1["rows_before"])),
        "hard_bounds": r1,
        "robust_rule": r2,
        "final_reference_rows": int(len(sal)),
        "final_in_role_families": int(sal[C.TARGET_FAMILY].notna().sum()),
    }

    report["role_cohort"] = attrition.to_dict("records")
    report["split"] = {
        "train": int(len(train)), "test": int(len(test)),
        "test_size": C.TEST_SIZE, "stratified_on": C.STRATIFY_ON, "random_state": C.RANDOM_STATE,
    }
    report["seconds"] = round(time.time() - t0, 1)
    (C.REPORTS_DIR / "build_report.json").write_text(json.dumps(report, indent=2, default=str))
    log(f"done in {report['seconds']} s -> reports/build_report.json")


if __name__ == "__main__":
    main()
