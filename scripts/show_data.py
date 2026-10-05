"""Inspect or export the processed data files.

The .parquet files are compressed binary, so Notepad and Excel cannot open them
directly. This script reads them properly.

    python scripts/show_data.py                     list every file with its shape
    python scripts/show_data.py train               preview train.parquet
    python scripts/show_data.py train --rows 20     more rows
    python scripts/show_data.py train --cols        every column name and dtype
    python scripts/show_data.py train --describe    summary statistics
    python scripts/show_data.py train --csv         export to data/exports/train.csv
    python scripts/show_data.py --csv-all           export everything to CSV

Exports go to data/exports/ (git-ignored) so they never get committed by accident.
"""
from __future__ import annotations

import argparse

import pandas as pd

from skillpath import config as C

EXPORT_DIR = C.DATA_DIR / "exports"

# short name -> path, in the order that makes sense to a reader
FILES = {
    "train": C.PROCESSED_DIR / "train.parquet",
    "test": C.PROCESSED_DIR / "test.parquet",
    "cohort": C.PROCESSED_DIR / "role_cohort.parquet",
    "split_ids": C.PROCESSED_DIR / "split_ids.csv",
    "features_train": C.PROCESSED_DIR / "features_core_train.parquet",
    "features_test": C.PROCESSED_DIR / "features_core_test.parquet",
    "ai_exposure": C.REFERENCE_DIR / "ai_exposure_role_cohort.parquet",
    "persona": C.REFERENCE_DIR / "persona_inputs.parquet",
    "salary": C.REFERENCE_DIR / "salary_reference.parquet",
}

WHAT = {
    "train": "training respondents, survey format - models are fitted on this",
    "test": "held-out respondents - opened once, at the very end",
    "cohort": "the full recommender cohort, before the 80/20 split",
    "split_ids": "which ResponseId went to train vs test (frozen)",
    "features_train": "the transformed 479-feature matrix (exploration only)",
    "features_test": "same, for the test split",
    "ai_exposure": "AI Exposure Index per respondent",
    "persona": "AI attitude answers for the persona clustering",
    "salary": "salary benchmarks after the two-stage outlier rule",
}


def read(name: str) -> pd.DataFrame:
    path = FILES[name]
    if not path.exists():
        raise SystemExit(f"{path} is missing. Run: python scripts/build_dataset.py")
    return pd.read_csv(path) if path.suffix == ".csv" else pd.read_parquet(path)


def listing() -> None:
    print(f"{'name':<16} {'rows':>8} {'cols':>6} {'size':>9}  what it is")
    print("-" * 100)
    for name, path in FILES.items():
        if not path.exists():
            print(f"{name:<16} {'MISSING':>8}  {' ':>6} {' ':>9}  {WHAT[name]}")
            continue
        df = read(name)
        kb = path.stat().st_size / 1024
        size = f"{kb / 1024:.1f} MB" if kb > 1024 else f"{kb:.0f} KB"
        print(f"{name:<16} {len(df):>8,} {df.shape[1]:>6} {size:>9}  {WHAT[name]}")
    print("\nPreview one with:  python scripts/show_data.py <name>")


def preview(name: str, rows: int) -> None:
    df = read(name)
    print(f"\n{FILES[name]}")
    print(f"{WHAT[name]}")
    print(f"{len(df):,} rows x {df.shape[1]} columns\n")

    # Wide frames are unreadable printed in full, so show the first columns only.
    show = df if df.shape[1] <= 12 else df.iloc[:, :10]
    with pd.option_context("display.width", 200, "display.max_columns", 14):
        print(show.head(rows).to_string())
    if df.shape[1] > 12:
        print(f"\n... {df.shape[1] - 10} more columns. Use --cols to list them all.")

    if C.TARGET_JOB in df.columns:
        print(f"\nTarget ({C.TARGET_JOB}) distribution:")
        print(df[C.TARGET_JOB].value_counts().to_string())


def columns(name: str) -> None:
    df = read(name)
    print(f"{FILES[name]} - {df.shape[1]} columns\n")
    print(f"{'#':>4}  {'column':<48} {'dtype':<12} {'non-null':>9} {'missing':>8}")
    print("-" * 90)
    for i, c in enumerate(df.columns, 1):
        nn = int(df[c].notna().sum())
        print(f"{i:>4}  {str(c):<48} {str(df[c].dtype):<12} {nn:>9,} {len(df) - nn:>8,}")


def describe(name: str) -> None:
    df = read(name)
    with pd.option_context("display.width", 200, "display.max_columns", 30):
        num = df.select_dtypes("number")
        if len(num.columns):
            print("Numeric columns:\n")
            print(num.describe().T.round(3).to_string())
        obj = df.select_dtypes(exclude="number")
        if len(obj.columns):
            print("\n\nNon-numeric columns:\n")
            print(obj.describe().T.to_string())


def to_csv(name: str) -> None:
    df = read(name)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    out = EXPORT_DIR / f"{name}.csv"
    df.to_csv(out, index=False)
    mb = out.stat().st_size / 1024 / 1024
    note = ""
    if df.shape[1] > 256:
        note = "  (very wide - Excel will be slow; consider opening it in pandas instead)"
    print(f"Wrote {out}  {len(df):,} rows x {df.shape[1]} cols, {mb:.1f} MB{note}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("name", nargs="?", choices=sorted(FILES), help="which file")
    ap.add_argument("--rows", type=int, default=8, help="rows to preview (default 8)")
    ap.add_argument("--cols", action="store_true", help="list every column and dtype")
    ap.add_argument("--describe", action="store_true", help="summary statistics")
    ap.add_argument("--csv", action="store_true", help="export this file to CSV")
    ap.add_argument("--csv-all", action="store_true", help="export every file to CSV")
    args = ap.parse_args()

    if args.csv_all:
        for n in FILES:
            if FILES[n].exists():
                to_csv(n)
        return
    if not args.name:
        listing()
        return
    if args.cols:
        columns(args.name)
    elif args.describe:
        describe(args.name)
    elif args.csv:
        to_csv(args.name)
    else:
        preview(args.name, args.rows)


if __name__ == "__main__":
    main()
