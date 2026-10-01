"""Stage 7: optimisation, modelling experiments and final model selection.

    python scripts/tune_models.py                   # all four phases (~1 hour)
    python scripts/tune_models.py --only A B        # just the cheap experiments
    python scripts/tune_models.py --only C --iters 8

Four phases, each answering one question from the Stage 7 backlog in
reports/preprocessing_decisions.md section 7:

    A  imbalance     does class weighting or oversampling beat doing nothing?
    B  features      do the preprocessing and feature-selection choices matter?
    C  tuning        randomised hyper-parameter search for the serious models
    D  selection     tuned vs baseline, and the final model decision

Every phase cross-validates on the TRAINING split with the same
StratifiedKFold(5) and the same scorers as Stage 6, so every number in the
report is comparable with every other. The test split stays closed: it is opened
once, by scripts/finalise_model.py.

Results append to reports/model_experiments.csv and each phase writes its own
reports/stage7_<phase>_*.csv, so a run that is interrupted keeps what it finished.
"""
from __future__ import annotations

import argparse
import json
import time
import warnings

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.stats import loguniform
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import RandomizedSearchCV
from sklearn.svm import LinearSVC

from skillpath import config as C
from skillpath import modelling as M
from skillpath import viz

RS = C.RANDOM_STATE


# ---------------------------------------------------------------------------
# Phase A -- imbalance handling
# ---------------------------------------------------------------------------
def phase_a(X, y, folds: int) -> pd.DataFrame:
    """Does anything beat leaving the 155:1 imbalance alone?

    Tested on the two strongest cheap models so the answer is not an artefact of
    one algorithm. Oversampling happens inside the estimator (see
    modelling.OversampledClassifier), so duplicated respondents can never appear
    on both sides of a fold.
    """
    print("\n--- Phase A: imbalance handling " + "-" * 50)
    runs = []
    for base_name, make in [
        # fast_lr: measured-equivalent solver settings at half the cost, see its docstring
        ("Logistic Regression", lambda cw: M.fast_lr(class_weight=cw)),
        ("Random Forest", lambda cw: RandomForestClassifier(
            n_estimators=300, min_samples_leaf=2, max_features="sqrt", n_jobs=-1,
            class_weight=cw, random_state=RS)),
    ]:
        bal = "balanced_subsample" if base_name == "Random Forest" else "balanced"
        runs += [
            (f"{base_name} + no imbalance handling", M.make_pipeline(make(None))),
            (f"{base_name} + class_weight", M.make_pipeline(make(bal))),
            # partial oversampling: every role lifted to at least 10% of Full-stack's
            # size. Full balancing is 145k rows per fit and is reported as rejected
            # on cost rather than run -- see OversampledClassifier's docstring.
            (f"{base_name} + oversampling to 10%",
             M.make_pipeline(M.OversampledClassifier(make(None), sampling_strategy=0.1))),
        ]

    rows = []
    for name, pipe in runs:
        print(f"  {name:<46}", end="", flush=True)
        r = M.run_cv(name, pipe, X, y, n_splits=folds, note="phase A imbalance")
        rows.append(r)
        print(f"f1_macro {r['f1_macro']:.4f}  acc {r['accuracy']:.4f}  ({r['total_seconds']:.0f}s)")

    df = M.results_table(rows)
    M.append_results(rows)
    df.to_csv(C.REPORTS_DIR / "stage7_a_imbalance.csv", index=False)
    return df


# ---------------------------------------------------------------------------
# Phase B -- preprocessing and feature-selection experiments
# ---------------------------------------------------------------------------
def phase_b(X, y, folds: int) -> pd.DataFrame:
    """Do the Stage 4 preprocessing choices actually earn their place?

    Run on Logistic Regression: it is fast, and a linear model reacts most
    visibly to the feature set, so a change that does nothing here is unlikely
    to matter elsewhere.
    """
    print("\n--- Phase B: feature set and selection " + "-" * 44)
    print(f"    {folds}-fold here: every row is a *relative* comparison against the same")
    print(f"    reference on the same folds, so fewer folds costs precision we do not need.")

    lr = M.fast_lr

    runs = [
        ("core (reference)", M.make_pipeline(lr()), "479 features, the Stage 4 default"),
        ("want lists removed", M.make_pipeline(lr(), include_want=False),
         "does 'what they want to learn' add anything over 'what they use'?"),
        ("rare pooling 0.25%", M.make_pipeline(lr(), min_frequency=0.0025), "more technology columns"),
        ("rare pooling 1%", M.make_pipeline(lr(), min_frequency=0.01), "fewer technology columns"),
    ]
    # core+context needs the extra raw columns, so it gets its own X below.
    for k in (100, 200, 300, "all"):
        runs.append((f"SelectKBest chi2 k={k}", M.select_kbest_pipeline(lr(), k=k),
                     "selection fitted inside every fold"))

    rows = []
    for name, pipe, note in runs:
        print(f"  {name:<46}", end="", flush=True)
        r = M.run_cv(name, pipe, X, y, n_splits=folds, note=f"phase B: {note}")
        rows.append(r)
        print(f"f1_macro {r['f1_macro']:.4f}  top3 {r['top3_accuracy']:.4f}  ({r['total_seconds']:.0f}s)")

    # core+context: job-context answers most student users cannot give
    Xc, yc = M.load_train(feature_set="core+context")
    print(f"  {'core+context (506 features)':<46}", end="", flush=True)
    r = M.run_cv("core+context (506 features)", M.make_pipeline(lr(), feature_set="core+context"),
                 Xc, yc, n_splits=folds,
                 note="phase B: adds OrgSize/Industry/RemoteWork/ICorPM")
    rows.append(r)
    print(f"f1_macro {r['f1_macro']:.4f}  top3 {r['top3_accuracy']:.4f}  ({r['total_seconds']:.0f}s)")

    df = M.results_table(rows)
    M.append_results(rows)
    df.to_csv(C.REPORTS_DIR / "stage7_b_features.csv", index=False)
    return df


# ---------------------------------------------------------------------------
# Phase C -- hyper-parameter search
# ---------------------------------------------------------------------------
def search_spaces(iters: int) -> dict:
    """Randomised search is used rather than a grid.

    A grid over five hyper-parameters with four values each is 1,024 fits per
    model; at roughly 6-25 s a fit that is days of compute. Random search over
    the same ranges finds a near-best setting in a few dozen fits, because only
    two or three of the parameters actually matter and random sampling tries
    many distinct values of each.
    """
    # Search budgets are set from the measured cost of one fit, so no single model
    # eats the whole run: Logistic Regression is ~64 s a fit, Random Forest ~5 s.
    # Each winner is re-scored on the standard 5 folds afterwards, so a cheaper
    # search here never makes the reported comparison unfair.
    return {
        "Logistic Regression": dict(
            estimator=M.make_pipeline(M.fast_lr()),
            params={
                "clf__C": loguniform(1e-2, 1e1),
                "clf__class_weight": [None, "balanced"],
            },
            n_iter=max(6, iters // 2), cv=3,
        ),
        "Linear SVM (calibrated)": dict(
            estimator=M.make_pipeline(CalibratedClassifierCV(
                LinearSVC(random_state=RS), method="sigmoid", cv=3)),
            params={
                "clf__estimator__C": loguniform(1e-3, 1e0),
                "clf__estimator__class_weight": [None, "balanced"],
            },
            n_iter=max(6, iters // 2), cv=5,
        ),
        "Random Forest": dict(
            estimator=M.make_pipeline(RandomForestClassifier(n_jobs=-1, random_state=RS)),
            params={
                "clf__n_estimators": [300, 500, 800],
                "clf__max_depth": [None, 20, 40],
                "clf__min_samples_leaf": [1, 2, 4],
                "clf__max_features": ["sqrt", 0.1, 0.2],
                "clf__class_weight": [None, "balanced", "balanced_subsample"],
            },
            n_iter=iters + 4, cv=5,
        ),
        # Boosting gets the smallest budget because it is by far the most
        # expensive: a 20-class problem grows 20 trees per round, and the Stage 6
        # baseline measured 179 s for a single fit. The search therefore runs on
        # 3 folds and leans on smaller `max_leaf_nodes`, which cuts the cost per
        # fit as well as being the parameter most likely to help a model whose
        # rare classes are starved of data.
        "Hist Gradient Boosting": dict(
            estimator=M.make_pipeline(HistGradientBoostingClassifier(
                early_stopping=True, n_iter_no_change=15, validation_fraction=0.1,
                random_state=RS)),
            params={
                "clf__learning_rate": [0.1, 0.2],
                "clf__max_leaf_nodes": [15, 31],
                "clf__min_samples_leaf": [20, 50],
                "clf__l2_regularization": [0.0, 1.0],
                "clf__max_iter": [100, 200],
            },
            n_iter=5, cv=3,
        ),
    }


def phase_c(X, y, folds: int, iters: int) -> tuple[pd.DataFrame, dict]:
    """Randomised search per model, then re-score the winner on the common 5-fold CV."""
    print("\n--- Phase C: hyper-parameter search " + "-" * 47)
    rows, best_params = [], {}
    for name, spec in search_spaces(iters).items():
        print(f"  {name}: {spec['n_iter']} candidates x {spec['cv']} folds", flush=True)
        t0 = time.time()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            rs = RandomizedSearchCV(
                spec["estimator"], spec["params"], n_iter=spec["n_iter"],
                scoring=M.primary_scorer(), cv=M.cv(spec["cv"]), n_jobs=1,
                random_state=RS, refit=False, error_score="raise",
            ).fit(X, y)
        best_params[name] = {k: (float(v) if isinstance(v, (np.floating, float)) else v)
                             for k, v in rs.best_params_.items()}
        print(f"    best search score {rs.best_score_:.4f} in {time.time() - t0:.0f}s")
        print(f"    {best_params[name]}")

        # re-score the winning setting on the standard 5-fold CV so it is
        # directly comparable with the Stage 6 baseline row
        tuned = spec["estimator"].set_params(**rs.best_params_)
        print(f"  {name + ' (tuned)':<46}", end="", flush=True)
        r = M.run_cv(f"{name} (tuned)", tuned, X, y, n_splits=folds,
                     note=f"phase C: {best_params[name]}")
        rows.append(r)
        print(f"f1_macro {r['f1_macro']:.4f}  top3 {r['top3_accuracy']:.4f}")

        pd.DataFrame(rs.cv_results_).to_csv(
            C.REPORTS_DIR / f"stage7_c_search_{name.split()[0].lower()}.csv", index=False)

    df = M.results_table(rows)
    M.append_results(rows)
    df.to_csv(C.REPORTS_DIR / "stage7_c_tuned.csv", index=False)
    (C.REPORTS_DIR / "stage7_best_params.json").write_text(json.dumps(best_params, indent=2))
    return df, best_params


# ---------------------------------------------------------------------------
# Phase D -- tuned vs baseline, and the final decision
# ---------------------------------------------------------------------------
def plot_tuned_vs_baseline(d: pd.DataFrame) -> None:
    viz.setup()
    fig, ax = plt.subplots(figsize=(8, 4.2))
    y = np.arange(len(d))
    ax.barh(y - 0.2, d["baseline_f1_macro"], height=0.38, color=viz.MUTED, label="Stage 6 baseline")
    ax.barh(y + 0.2, d["tuned_f1_macro"], height=0.38, color=viz.BLUE, label="Stage 7 tuned")
    ax.set_yticks(y, d["model"])
    ax.grid(axis="y", visible=False)
    ax.legend(loc="lower right")
    ax.set_title("Macro-F1: tuning gain per model")
    ax.set_xlabel("5-fold mean on the training split")
    fig.tight_layout()
    viz.save(fig, "05_tuned_vs_baseline")
    plt.close(fig)


def phase_d(folds: int) -> pd.DataFrame:
    """Join the Stage 6 baselines to the tuned results and pick the final model."""
    print("\n--- Phase D: tuned vs baseline, final selection " + "-" * 35)
    base_path = C.REPORTS_DIR / "stage6_model_comparison.csv"
    tuned_path = C.REPORTS_DIR / "stage7_c_tuned.csv"
    if not (base_path.exists() and tuned_path.exists()):
        print("  needs stage6_model_comparison.csv and stage7_c_tuned.csv; run phases 6 and C first")
        return pd.DataFrame()

    base = pd.read_csv(base_path)
    tuned = pd.read_csv(tuned_path)
    tuned["base_model"] = tuned["model"].str.replace(" (tuned)", "", regex=False)

    d = tuned.merge(base, left_on="base_model", right_on="model", suffixes=("_tuned", "_base"))
    out = pd.DataFrame({
        "model": d["base_model"],
        "baseline_f1_macro": d["f1_macro_base"],
        "tuned_f1_macro": d["f1_macro_tuned"],
        "gain": d["f1_macro_tuned"] - d["f1_macro_base"],
        "tuned_f1_macro_std": d["f1_macro_std_tuned"],
        "baseline_top3": d["top3_accuracy_base"],
        "tuned_top3": d["top3_accuracy_tuned"],
        "tuned_balanced_accuracy": d["balanced_accuracy_tuned"],
        "tuned_log_loss": d["log_loss_tuned"],
        "tuned_family_f1_macro": d["family_f1_macro_tuned"],
        "tuned_family_top3": d["family_top3_accuracy_tuned"],
        "fit_seconds": d["fit_seconds_tuned"],
    }).sort_values("tuned_f1_macro", ascending=False).reset_index(drop=True)

    out.to_csv(C.REPORTS_DIR / "stage7_d_tuned_vs_baseline.csv", index=False)
    plot_tuned_vs_baseline(out.sort_values("tuned_f1_macro"))

    print(out.round(4).to_string(index=False))

    # --- the selection rule ---------------------------------------------------
    # Pick on macro-F1, but treat models inside one standard deviation of the
    # best as tied and break that tie on fit cost: a model that is not reliably
    # better should not be the one that is harder to retrain and deploy.
    top = out.iloc[0]
    tol = float(top["tuned_f1_macro_std"])
    tied = out[out["tuned_f1_macro"] >= top["tuned_f1_macro"] - tol]
    final = tied.sort_values("fit_seconds").iloc[0]

    print(f"\n  best macro-F1 : {top['model']} ({top['tuned_f1_macro']:.4f})")
    print(f"  within 1 SD   : {', '.join(tied['model'])}  (SD {tol:.4f})")
    print(f"  FINAL MODEL   : {final['model']}  "
          f"(macro-F1 {final['tuned_f1_macro']:.4f}, top-3 {final['tuned_top3']:.4f}, "
          f"{final['fit_seconds']:.1f}s to fit)")

    decision = {
        "generated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "stage": "7 - optimisation and final model selection",
        "selection_rule": (
            "highest 5-fold macro-F1 on the training split; models within one standard "
            "deviation of the best are treated as tied and the cheapest to fit wins, "
            "because the web backend reloads this pipeline and an unreliable improvement "
            "does not justify a slower model"
        ),
        "best_by_f1_macro": top["model"],
        "tied_within_1sd": list(tied["model"]),
        "final_model": final["model"],
        "final_cv_scores": {
            "f1_macro": round(float(final["tuned_f1_macro"]), 4),
            "top3_accuracy": round(float(final["tuned_top3"]), 4),
            "balanced_accuracy": round(float(final["tuned_balanced_accuracy"]), 4),
            "log_loss": round(float(final["tuned_log_loss"]), 4),
            "family_f1_macro": round(float(final["tuned_family_f1_macro"]), 4),
            "family_top3_accuracy": round(float(final["tuned_family_top3"]), 4),
        },
        "validation": f"StratifiedKFold({folds}, shuffle=True, random_state={RS})",
    }
    (C.REPORTS_DIR / "stage7_final_selection.json").write_text(json.dumps(decision, indent=2))
    print("\n  wrote reports/stage7_final_selection.json  "
          "-> scripts/finalise_model.py reads this")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", default=["A", "B", "C", "D"],
                    help="phases to run, e.g. --only A B")
    ap.add_argument("--folds", type=int, default=M.N_SPLITS)
    ap.add_argument("--folds-b", type=int, default=3,
                    help="folds for the Phase B relative comparisons (cheaper)")
    ap.add_argument("--iters", type=int, default=12, help="randomised search candidates")
    args = ap.parse_args()
    phases = [p.upper() for p in args.only]

    warnings.simplefilter("ignore")
    t0 = time.time()
    X, y = M.load_train()
    print(f"Stage 7 optimisation. Training rows {X.shape[0]:,}, "
          f"{args.folds}-fold stratified CV, primary metric {M.PRIMARY_METRIC}.")

    if "A" in phases:
        phase_a(X, y, args.folds)
    if "B" in phases:
        phase_b(X, y, args.folds_b)
    if "C" in phases:
        phase_c(X, y, args.folds, args.iters)
    if "D" in phases:
        phase_d(args.folds)

    print(f"\nDone in {(time.time() - t0) / 60:.1f} min. "
          f"All runs appended to reports/model_experiments.csv")


if __name__ == "__main__":
    main()
