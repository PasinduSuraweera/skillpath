"""Stage 6: train and compare the candidate models.

    python scripts/run_models.py            # all seven candidates, 5-fold CV
    python scripts/run_models.py --fast     # skip Hist Gradient Boosting

Cross-validates every candidate on the TRAINING split only, records the results
in reports/model_experiments.csv, writes the comparison table and the figures
used in the report, and produces a per-class breakdown and a confusion matrix
for the best model from out-of-fold predictions.

The test split is not touched here. It is opened once, by
scripts/finalise_model.py, after Stage 7 has chosen the final model.
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
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import cross_val_predict

from skillpath import config as C
from skillpath import modelling as M
from skillpath import targets, viz


def plot_comparison(df: pd.DataFrame) -> None:
    """Macro-F1 and top-3 accuracy per model, with the CV spread."""
    viz.setup()
    d = df.sort_values("f1_macro")
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2))

    axes[0].barh(d["model"], d["f1_macro"], xerr=d["f1_macro_std"], color=viz.BLUE,
                 height=0.7, error_kw={"ecolor": viz.MUTED, "lw": 1})
    axes[0].set_title("Macro-F1 (job role, 20 classes)")
    axes[0].set_xlabel("mean over 5 folds (bars = 1 SD)")

    axes[1].barh(d["model"], d["top3_accuracy"], xerr=d["top3_accuracy_std"], color=viz.ORANGE,
                 height=0.7, error_kw={"ecolor": viz.MUTED, "lw": 1})
    axes[1].set_title("Top-3 accuracy (what the app shows)")
    axes[1].set_xlabel("mean over 5 folds (bars = 1 SD)")
    axes[1].set_yticklabels([])

    for ax in axes:
        ax.grid(axis="y", visible=False)
    fig.tight_layout()
    viz.save(fig, "04_model_comparison")
    plt.close(fig)


def plot_metric_disagreement(df: pd.DataFrame) -> None:
    """Accuracy and macro-F1 rank models differently: the imbalance argument."""
    viz.setup()
    d = df.sort_values("f1_macro")
    fig, ax = plt.subplots(figsize=(7.5, 4.2))
    y = np.arange(len(d))
    ax.barh(y - 0.2, d["accuracy"], height=0.38, color=viz.MUTED, label="Accuracy")
    ax.barh(y + 0.2, d["f1_macro"], height=0.38, color=viz.BLUE, label="Macro-F1")
    ax.set_yticks(y, d["model"])
    ax.grid(axis="y", visible=False)
    ax.legend(loc="lower right")
    ax.set_title("Accuracy hides what macro-F1 shows")
    ax.set_xlabel("5-fold mean. The Dummy model scores 0.39 accuracy with no skill at all.")
    fig.tight_layout()
    viz.save(fig, "04_accuracy_vs_f1")
    plt.close(fig)


def plot_confusion(cm: np.ndarray, labels, name: str) -> None:
    """Row-normalised confusion matrix for the best model."""
    viz.setup()
    short = [C.JOB_ROLE_LABEL.get(l, l) for l in labels]
    cmn = cm / np.clip(cm.sum(axis=1, keepdims=True), 1, None)
    fig, ax = plt.subplots(figsize=(9.5, 8.2))
    im = ax.imshow(cmn, cmap=viz.seq_cmap(), vmin=0, vmax=1)
    ax.set_xticks(range(len(short)), short, rotation=90, fontsize=7)
    ax.set_yticks(range(len(short)), short, fontsize=7)
    ax.set_xlabel("predicted")
    ax.set_ylabel("actual")
    ax.set_title(f"Out-of-fold confusion matrix, row-normalised ({name})")
    ax.grid(visible=False)
    fig.colorbar(im, ax=ax, shrink=0.7, label="share of the actual class")
    fig.tight_layout()
    viz.save(fig, "04_confusion_matrix")
    plt.close(fig)


def plot_per_class(rep: pd.DataFrame) -> None:
    """Per-class F1 against class size: the rare-role problem, in one chart."""
    viz.setup()
    fig, ax = plt.subplots(figsize=(7.5, 4.6))
    ax.scatter(rep["support"], rep["f1-score"], color=viz.BLUE, s=38)
    for _, r in rep.iterrows():
        ax.annotate(C.JOB_ROLE_LABEL.get(r["job_role"], r["job_role"]),
                    (r["support"], r["f1-score"]), fontsize=6.5,
                    xytext=(4, 3), textcoords="offset points", color=viz.TEXT2)
    ax.set_xscale("log")
    ax.set_xlabel("training examples for that job role (log scale)")
    ax.set_ylabel("F1")
    ax.set_title("Per-class F1 rises with class size")
    ax.grid(axis="both")
    fig.tight_layout()
    viz.save(fig, "04_per_class_f1")
    plt.close(fig)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fast", action="store_true", help="skip the slow boosting model")
    ap.add_argument("--folds", type=int, default=M.N_SPLITS)
    args = ap.parse_args()

    warnings.simplefilter("ignore")
    t0 = time.time()
    X, y = M.load_train()
    print(f"Training rows {X.shape[0]:,}  raw input columns {X.shape[1]}  "
          f"job roles {y.nunique()}  validation {args.folds}-fold stratified\n")

    cands = M.candidates(include_slow=not args.fast)
    rows = []
    for name, spec in cands.items():
        print(f"  {name:<26}", end="", flush=True)
        row = M.run_cv(name, spec["pipeline"], X, y, n_splits=args.folds,
                       note=spec["family"])
        rows.append(row)
        print(f"f1_macro {row['f1_macro']:.4f}  top3 {row['top3_accuracy']:.4f}  "
              f"family_f1 {row['family_f1_macro']:.4f}  ({row['total_seconds']:.0f}s)")

    df = M.results_table(rows)
    M.append_results(rows)
    df.to_csv(C.REPORTS_DIR / "stage6_model_comparison.csv", index=False)

    print("\n" + "=" * 100)
    print(M.summary(df).to_string(index=False))
    print("=" * 100)

    plot_comparison(df)
    plot_metric_disagreement(df)

    # --- out-of-fold diagnosis of the best model --------------------------------
    best = df.iloc[0]["model"]
    print(f"\nBest by macro-F1: {best}. Building out-of-fold predictions for diagnosis...")
    proba = cross_val_predict(cands[best]["pipeline"], X, y, cv=M.cv(args.folds),
                              method="predict_proba", n_jobs=1)
    classes = np.unique(y)
    y_pred = classes[proba.argmax(axis=1)]

    rep = pd.DataFrame(classification_report(y, y_pred, output_dict=True, zero_division=0)).T
    rep = rep.loc[list(classes)].reset_index(names="job_role")
    rep["family"] = targets.family_of(rep["job_role"])
    rep = rep.sort_values("f1-score", ascending=False)
    rep.to_csv(C.REPORTS_DIR / "stage6_per_class_report.csv", index=False)

    cm = confusion_matrix(y, y_pred, labels=classes)
    pd.DataFrame(cm, index=classes, columns=classes).to_csv(
        C.REPORTS_DIR / "stage6_confusion_matrix.csv")
    plot_confusion(cm, classes, best)
    plot_per_class(rep)

    # Which role pairs does it mix up? Evidence for the top-3 design decision.
    off = cm.astype(float).copy()
    np.fill_diagonal(off, 0)
    share = off / np.clip(cm.sum(axis=1, keepdims=True), 1, None)
    idx = np.dstack(np.unravel_index(np.argsort(-share, axis=None), share.shape))[0][:10]
    confusions = [
        {"actual": classes[i], "predicted_as": classes[j],
         "share_of_actual": round(float(share[i, j]), 3),
         "same_family": bool(C.ROLE_FAMILY[classes[i]] == C.ROLE_FAMILY[classes[j]])}
        for i, j in idx
    ]
    print("\nTop confusions (share of the actual class sent to the wrong role):")
    for c in confusions[:8]:
        tag = "same family" if c["same_family"] else "different family"
        print(f"  {c['actual']:<45} -> {c['predicted_as']:<45} {c['share_of_actual']:.2f}  ({tag})")

    summary = {
        "generated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "stage": "6 - model development",
        "training_rows": int(X.shape[0]),
        "job_roles": int(y.nunique()),
        "validation": f"StratifiedKFold({args.folds}, shuffle=True, random_state={C.RANDOM_STATE})",
        "primary_metric": M.PRIMARY_METRIC,
        "models": {r["model"]: {m: round(r[m], 4) for m in M.METRICS} for r in rows},
        "best_by_f1_macro": best,
        "top_confusions": confusions,
        "seconds": round(time.time() - t0, 1),
    }
    (C.REPORTS_DIR / "stage6_report.json").write_text(json.dumps(summary, indent=2))
    print(f"\nWrote reports/stage6_model_comparison.csv, stage6_per_class_report.csv, "
          f"stage6_confusion_matrix.csv, stage6_report.json")
    print(f"     reports/figures/04_*.png   ({time.time() - t0:.0f}s total)")


if __name__ == "__main__":
    main()
