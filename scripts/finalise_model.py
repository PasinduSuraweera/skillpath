"""Stage 7 (end): fit the chosen model and open the test split, once.

    python scripts/finalise_model.py

Reads the decision made by scripts/tune_models.py (reports/stage7_final_selection.json
and reports/stage7_best_params.json), refits that configuration on the full
training split, and evaluates it on the 4,615 held-out respondents **one time**.

This is the only script in the project that loads data/processed/test.parquet.
Running it repeatedly while changing the model would turn the test split into a
second validation set and the final numbers would stop being an honest estimate
of how the deployed app behaves. If you need to compare models, go back to
tune_models.py and the cross-validated scores on the training split.

Outputs
    artifacts/model.joblib          the fitted Pipeline the web backend loads
    artifacts/model_card.json       what it is, how it scores, what it must not be used for
    reports/stage7_test_results.json
    reports/stage7_test_per_class.csv
    reports/figures/05_test_confusion.png
"""
from __future__ import annotations

import json
import time
import warnings

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.svm import LinearSVC

from skillpath import config as C
from skillpath import modelling as M
from skillpath import targets, viz
from skillpath.pipeline import model_input_columns
from skillpath.profile import profile_to_frame, row_to_profile

RS = C.RANDOM_STATE

BASE_ESTIMATORS = {
    # fast_lr(), not a fresh LogisticRegression: the Stage 7 search was run on
    # fast_lr's solver settings, so rebuilding with different ones would deploy a
    # model that is not the one the reported score belongs to.
    "Logistic Regression": lambda: M.fast_lr(),
    "Linear SVM (calibrated)": lambda: CalibratedClassifierCV(
        LinearSVC(random_state=RS), method="sigmoid", cv=3),
    "Random Forest": lambda: RandomForestClassifier(n_jobs=-1, random_state=RS),
    "Hist Gradient Boosting": lambda: HistGradientBoostingClassifier(
        early_stopping=True, n_iter_no_change=15, validation_fraction=0.1, random_state=RS),
}


def build_final():
    """Rebuild the winning configuration from the Stage 7 decision files."""
    decision = json.loads((C.REPORTS_DIR / "stage7_final_selection.json").read_text())
    params = json.loads((C.REPORTS_DIR / "stage7_best_params.json").read_text())
    name = decision["final_model"]
    pipe = M.make_pipeline(BASE_ESTIMATORS[name]())
    pipe.set_params(**params[name])
    return name, pipe, decision, params[name]


def check_api_parity(model, train: pd.DataFrame, n: int = 300) -> dict:
    """The deployed path must give the same answer as the training path.

    Takes real training rows, converts them to the JSON profile the web form
    will send, converts them back with profile_to_frame(), and checks the
    predictions are identical. This is what proves the backend is not quietly
    preprocessing differently from the model that was validated.
    """
    cols = model_input_columns()
    sample = train.sample(n=min(n, len(train)), random_state=RS)
    rebuilt = pd.concat([profile_to_frame(row_to_profile(r)) for _, r in sample.iterrows()],
                        ignore_index=True)[cols]
    p_direct = model.predict_proba(sample[cols])
    p_api = model.predict_proba(rebuilt)
    max_diff = float(np.abs(p_direct - p_api).max())
    same_top1 = float((p_direct.argmax(1) == p_api.argmax(1)).mean())
    return {"rows_checked": int(len(sample)), "max_probability_difference": max_diff,
            "identical_top_1_share": same_top1, "passed": bool(max_diff < 1e-9)}


def plot_test_confusion(cm, labels, name) -> None:
    viz.setup()
    short = [C.JOB_ROLE_LABEL.get(l, l) for l in labels]
    cmn = cm / np.clip(cm.sum(axis=1, keepdims=True), 1, None)
    fig, ax = plt.subplots(figsize=(9.5, 8.2))
    im = ax.imshow(cmn, cmap=viz.seq_cmap(), vmin=0, vmax=1)
    ax.set_xticks(range(len(short)), short, rotation=90, fontsize=7)
    ax.set_yticks(range(len(short)), short, fontsize=7)
    ax.set_xlabel("predicted")
    ax.set_ylabel("actual")
    ax.set_title(f"Held-out test set, row-normalised ({name})")
    ax.grid(visible=False)
    fig.colorbar(im, ax=ax, shrink=0.7, label="share of the actual class")
    fig.tight_layout()
    viz.save(fig, "05_test_confusion")
    plt.close(fig)


def main() -> None:
    warnings.simplefilter("ignore")
    t0 = time.time()
    name, pipe, decision, best_params = build_final()
    print(f"Final model from Stage 7: {name}")
    print(f"  hyper-parameters : {best_params}")
    print(f"  CV macro-F1      : {decision['final_cv_scores']['f1_macro']}")
    print(f"  selection rule   : {decision['selection_rule']}\n")

    X, y = M.load_train()
    print(f"Fitting on all {len(X):,} training rows...", flush=True)
    pipe.fit(X, y)
    fit_seconds = time.time() - t0

    print("Opening the held-out test split (once)...")
    Xt, yt = M.load_test()
    proba = pipe.predict_proba(Xt)
    scores = M.score_all(yt, proba, pipe.classes_)

    print("\n" + "=" * 60)
    print(f"{'HELD-OUT TEST RESULTS':<40}{len(Xt):>8,} respondents")
    print("=" * 60)
    for k, v in scores.items():
        print(f"  {k:<28}{v:>10.4f}")
    print("=" * 60)

    cv_scores = decision["final_cv_scores"]
    gap = scores["f1_macro"] - cv_scores["f1_macro"]
    print(f"\n  CV macro-F1 {cv_scores['f1_macro']:.4f} -> test {scores['f1_macro']:.4f} "
          f"(gap {gap:+.4f})")
    print("  A small gap means the cross-validated estimate was honest and the model "
          "generalises.\n" if abs(gap) < 0.03 else
          "  A large gap needs explaining in the report.\n")

    classes = pipe.classes_
    y_pred = classes[proba.argmax(axis=1)]
    rep = pd.DataFrame(classification_report(yt, y_pred, output_dict=True, zero_division=0)).T
    rep = rep.loc[list(classes)].reset_index(names="job_role")
    rep["family"] = targets.family_of(rep["job_role"])
    rep.sort_values("f1-score", ascending=False).to_csv(
        C.REPORTS_DIR / "stage7_test_per_class.csv", index=False)

    cm = confusion_matrix(yt, y_pred, labels=classes)
    plot_test_confusion(cm, classes, name)

    train_df = pd.read_parquet(C.PROCESSED_DIR / "train.parquet")
    parity = check_api_parity(pipe, train_df)
    print(f"  API parity check : {parity['rows_checked']} profiles through the web format, "
          f"max probability difference {parity['max_probability_difference']:.2e} "
          f"-> {'PASS' if parity['passed'] else 'FAIL'}\n")

    C.ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, C.ARTIFACTS_DIR / "model.joblib")

    card = {
        "generated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "model": name,
        "hyperparameters": best_params,
        "task": "20-class job-role classification; role-family probabilities are the sum of "
                "the job-role probabilities inside each family",
        "target": C.TARGET_JOB,
        "feature_set": "core (479 features)",
        "training_rows": int(len(X)),
        "test_rows": int(len(Xt)),
        "validation": decision["validation"],
        "selection_rule": decision["selection_rule"],
        "cv_scores_training_split": cv_scores,
        "test_scores": {k: round(float(v), 4) for k, v in scores.items()},
        "api_parity_check": parity,
        "fit_seconds": round(fit_seconds, 1),
        "sklearn_version": sklearn.__version__,
        "intended_use": "Suggest three plausible developer job roles and their career families "
                        "from a self-reported skill and AI-attitude profile, as guidance.",
        "not_for": [
            "hiring, screening or any decision about an individual",
            "salary setting -- the salary figures in the app are cohort benchmarks, not predictions",
            "any claim that a person is unsuited to a role: a low probability means the profile "
            "is unlike that role's survey respondents, not that the person cannot do the job",
        ],
        "known_limitations": [
            "Trained on Stack Overflow 2025 respondents, who are not a random sample of developers",
            "Full-stack is 39% of the training data; rare roles such as UX/UI (47 examples) are "
            "predicted far less reliably -- see reports/stage7_test_per_class.csv",
            "Some roles are genuinely close (Cloud Infrastructure vs DevOps), which is why the "
            "app shows three ranked roles and the family total rather than one answer",
            "Age is deliberately not a feature; the model still reflects the survey population's "
            "regional and experience mix",
        ],
        "data": "Stack Overflow Annual Developer Survey 2025, ODbL v1.0",
    }
    (C.ARTIFACTS_DIR / "model_card.json").write_text(json.dumps(card, indent=2))
    (C.REPORTS_DIR / "stage7_test_results.json").write_text(json.dumps({
        "model": name, "hyperparameters": best_params,
        "cv_scores": cv_scores, "test_scores": card["test_scores"],
        "cv_to_test_gap_f1_macro": round(float(gap), 4),
        "api_parity": parity,
    }, indent=2))

    size_kb = (C.ARTIFACTS_DIR / "model.joblib").stat().st_size / 1024
    print(f"Wrote artifacts/model.joblib ({size_kb:,.0f} KB) and artifacts/model_card.json")
    print(f"     reports/stage7_test_results.json, stage7_test_per_class.csv")
    print(f"     reports/figures/05_test_confusion.png   ({time.time() - t0:.0f}s total)")


if __name__ == "__main__":
    main()
