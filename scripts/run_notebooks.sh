#!/usr/bin/env bash
# Convert the jupytext .py notebooks to .ipynb, execute them, and export HTML copies.
# Usage: bash scripts/run_notebooks.sh [notebook-stem ...]
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p reports/html
stems=("$@")
if [ ${#stems[@]} -eq 0 ]; then stems=(01_data_understanding 02_eda 03_preprocessing 04_modelling 05_optimization); fi
for s in "${stems[@]}"; do
  echo "== $s"
  jupytext --to ipynb --output "notebooks/$s.ipynb" "notebooks/$s.py" >/dev/null
  (cd notebooks && jupyter nbconvert --to notebook --execute --inplace --ExecutePreprocessor.timeout=900 "$s.ipynb")
  jupyter nbconvert --to html --output-dir reports/html "notebooks/$s.ipynb" >/dev/null 2>&1
done
