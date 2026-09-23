"""Contract between the web form / API and the preprocessing pipeline.

The backend receives a JSON profile, converts it with profile_to_frame() into
a one-row DataFrame that looks exactly like a survey row, and passes it to the
same fitted pipeline used in training. No preprocessing is re-implemented in
the backend, so training and serving cannot drift apart.

Example profile
---------------
{
  "country": "Sri Lanka",
  "years_code": 5, "work_exp": 1,
  "ed_level": "Bachelor’s degree (B.A., B.S., B.Eng., etc.)",
  "tech": {
    "Language": {"have": ["Python", "SQL"], "want": ["Rust"]},
    "Database": {"have": ["PostgreSQL"], "want": []},
    "Webframe": {"none": true}
  },
  "ai": {"AISelect": "Yes, I use AI tools daily", "AIAgents": "No, but I plan to"},
  "learn_code_ai": "Yes, I learned how to use AI-enabled tools for my personal curiosity and/or hobbies",
  "context": {"OrgSize": null, "Industry": null, "RemoteWork": null, "ICorPM": null}
}

A block the user skipped is simply left out (-> "unknown"); a block where the
user ticked "I don't use any" is {"none": true} (-> a genuine zero), matching
how the survey's gate questions are encoded in training.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from . import config as C
from .data import country_region_table

AI_FIELDS = ["AISelect", "AIAgents", "AIAcc", "AISent"]
CONTEXT_FIELDS = ["OrgSize", "Industry", "RemoteWork", "ICorPM"]


def profile_to_frame(profile: dict) -> pd.DataFrame:
    """Convert one API profile into a single survey-format row."""
    row: dict = {
        "Country": profile.get("country"),
        "YearsCode": profile.get("years_code"),
        "WorkExp": profile.get("work_exp"),
        "EdLevel": profile.get("ed_level"),
        "LearnCodeAI": profile.get("learn_code_ai"),
    }
    tech = profile.get("tech") or {}
    for block, (have_col, want_col, gate_col) in C.TECH_BLOCKS.items():
        entry = tech.get(block) or {}
        have = [t for t in entry.get("have", []) if t]
        want = [t for t in entry.get("want", []) if t]
        none = bool(entry.get("none", False)) and not have and not want
        row[have_col] = C.MULTI_SEP.join(have) if have else np.nan
        row[want_col] = C.MULTI_SEP.join(want) if want else np.nan
        if gate_col:
            row[gate_col] = "No" if none else ("Yes" if (have or want) else np.nan)
    ai = profile.get("ai") or {}
    for f in AI_FIELDS:
        row[f] = ai.get(f)
    ctx = profile.get("context") or {}
    for f in CONTEXT_FIELDS:
        row[f] = ctx.get(f)
    frame = pd.DataFrame([row])
    for c in frame.columns:
        frame[c] = frame[c].astype("object").where(frame[c].notna(), np.nan)
    for c in C.NUMERIC_FEATURES:
        frame[c] = pd.to_numeric(frame[c], errors="coerce")
    return frame


def row_to_profile(row: pd.Series) -> dict:
    """Inverse of profile_to_frame for a survey row (used in parity tests)."""
    def val(x):
        return None if (x is None or (isinstance(x, float) and np.isnan(x)) or pd.isna(x)) else x

    tech = {}
    for block, (have_col, want_col, gate_col) in C.TECH_BLOCKS.items():
        have = [t for t in str(row[have_col]).split(C.MULTI_SEP)] if val(row[have_col]) else []
        want = [t for t in str(row[want_col]).split(C.MULTI_SEP)] if val(row[want_col]) else []
        entry = {"have": have, "want": want}
        if gate_col and val(row[gate_col]) == "No":
            entry["none"] = True
        if have or want or entry.get("none"):
            tech[block] = entry
    return {
        "country": val(row["Country"]),
        "years_code": val(row["YearsCode"]),
        "work_exp": val(row["WorkExp"]),
        "ed_level": val(row["EdLevel"]),
        "learn_code_ai": val(row["LearnCodeAI"]),
        "tech": tech,
        "ai": {f: val(row[f]) for f in AI_FIELDS},
        "context": {f: val(row[f]) for f in CONTEXT_FIELDS},
    }


def build_options(train: pd.DataFrame, tech_encoder=None) -> dict:
    """Everything the web form needs to render valid choices.

    Technology lists come from the TRAINING data (all technologies seen, most
    popular first), so the form only offers values the model understands.
    Ordered scales keep their semantic order.
    """
    def ordered(col):
        m = C.ORDINAL_MAPS[col]
        return sorted(m, key=lambda k: m[k])

    tech = {}
    for block, (have_col, want_col, _) in C.TECH_BLOCKS.items():
        s = pd.concat([train[have_col], train[want_col]]).dropna().str.split(C.MULTI_SEP).explode().str.strip()
        tech[block] = s.value_counts().index.tolist()

    countries = country_region_table().dropna(subset=["Region"])
    return {
        "countries": countries.sort_values("Country")[["Country", "Region"]].to_dict("records"),
        "tech": tech,
        "ed_level": ordered("EdLevel"),
        "ai": {f: ordered(f) for f in AI_FIELDS},
        "learn_code_ai": sorted(train["LearnCodeAI"].dropna().unique().tolist()),
        "context": {
            "OrgSize": ordered("OrgSize"),
            "Industry": sorted(train["Industry"].dropna().unique().tolist()),
            "RemoteWork": sorted(train["RemoteWork"].dropna().unique().tolist()),
            "ICorPM": sorted(train["ICorPM"].dropna().unique().tolist()),
        },
        "job_roles": [
            {"job_role": k, "label": C.JOB_ROLE_LABEL[k], "family": v,
             "description": C.JOB_ROLE_DESCRIPTION[k]} for k, v in C.ROLE_FAMILY.items()
        ],
        "limits": {"years_min": 0, "years_max": 50},
        "attribution": (
            "Data: Stack Overflow Annual Developer Survey 2025, licensed under the "
            "Open Database License (ODbL) v1.0. https://survey.stackoverflow.co/2025/"
        ),
    }


def save_options(options: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(options, indent=2, ensure_ascii=False))
