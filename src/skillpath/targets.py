"""Target definition: specific job role (primary) and its role family.

The model predicts one of 20 specific job roles (the JobRole label, taken from
DevType). A role family's probability is the sum of the probabilities of the
job roles inside it, so one model gives both levels of the recommendation:

    Top-3 job roles:   Data Engineer 0.31, Back-end Developer 0.22, Data Scientist 0.12
    Top families:      Data Eng 0.33, Data Sci/ML 0.20, Backend 0.22 ...

The functions here are used by the modelling notebooks (to score family-level
metrics) and by the web backend (to build the recommendation response).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C

JOB_ROLES = list(C.ROLE_FAMILY)
FAMILIES = sorted(set(C.ROLE_FAMILY.values()))


def family_of(job_roles) -> np.ndarray:
    """Map job role labels to their role family."""
    return pd.Series(job_roles).map(C.ROLE_FAMILY).to_numpy()


def family_proba(proba: np.ndarray, classes) -> pd.DataFrame:
    """Aggregate job-role probabilities (n x 20) into family probabilities (n x 12)."""
    classes = list(classes)
    fams = family_of(classes)
    # 0/1 membership matrix (job roles x families): proba @ M sums each family
    M = np.array([[1.0 if f == g else 0.0 for g in FAMILIES] for f in fams])
    return pd.DataFrame(np.asarray(proba, dtype=float) @ M, columns=FAMILIES)


def top_k(proba_row, classes, k: int = 3) -> list[dict]:
    """Top-k job roles for one person, with label, family and probability."""
    proba_row = np.asarray(proba_row, dtype=float)
    order = np.argsort(-proba_row)[:k]
    classes = list(classes)
    return [
        {
            "job_role": classes[i],
            "label": C.JOB_ROLE_LABEL[classes[i]],
            "family": C.ROLE_FAMILY[classes[i]],
            "probability": float(proba_row[i]),
            "description": C.JOB_ROLE_DESCRIPTION[classes[i]],
        }
        for i in order
    ]


def top_k_families(proba_row, classes, k: int = 3) -> list[dict]:
    """Top-k role families for one person (summed job-role probabilities)."""
    fam = family_proba(np.asarray(proba_row)[None, :], classes).iloc[0].sort_values(ascending=False)
    return [{"family": f, "probability": float(p)} for f, p in fam.head(k).items()]


def top_k_accuracy_family(y_true_job, proba, classes, k: int = 3) -> float:
    """Top-k accuracy at family level for a job-role model."""
    fam = family_proba(proba, classes)
    y_fam = family_of(y_true_job)
    top = np.argsort(-fam.to_numpy(), axis=1)[:, :k]
    cols = fam.columns.to_numpy()
    return float(np.mean([y in cols[t] for y, t in zip(y_fam, top)]))
