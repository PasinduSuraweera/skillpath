"""The recommendation service: final model + shared preprocessing + insights.

No preprocessing is re-implemented here. A validated profile goes through
skillpath.profile.profile_to_frame() into the saved Pipeline (Stage 4
preprocessor + Logistic Regression), the same path verified by the API parity
check in finalise_model.py (300 rows, identical probabilities).
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import joblib
import sklearn

from skillpath import config as C
from skillpath import insights, targets
from skillpath.pipeline import model_input_columns
from skillpath.profile import profile_to_frame

log = logging.getLogger("skillpath")

TOP_K = 3


class Recommender:
    def __init__(self, artifacts_dir: Path = C.ARTIFACTS_DIR):
        self.model = joblib.load(artifacts_dir / "model.joblib")
        self.card = json.loads((artifacts_dir / "model_card.json").read_text())
        self.options = json.loads((artifacts_dir / "options.json").read_text())
        self.tables = insights.load_tables(artifacts_dir / "insights.json")
        self.columns = model_input_columns()
        if sklearn.__version__ != self.card["sklearn_version"]:
            log.warning("scikit-learn %s differs from %s used to save the model; predictions may change",
                        sklearn.__version__, self.card["sklearn_version"])

    def info(self) -> dict:
        s = self.card["test_scores"]
        return {
            "name": self.card["model"],
            "classes": len(self.model.classes_),
            "test_top3_accuracy": s["top3_accuracy"],
            "test_family_top3_accuracy": s["family_top3_accuracy"],
            "test_rows": self.card["test_rows"],
            "intended_use": self.card["intended_use"],
        }

    def recommend(self, profile: dict) -> dict:
        """Top job roles and families for one validated profile (Profile.model_dump())."""
        row = profile_to_frame(profile)[self.columns]
        proba = self.model.predict_proba(row)[0]
        classes = self.model.classes_

        roles = []
        for rank, r in enumerate(targets.top_k(proba, classes, k=TOP_K), start=1):
            job = r["job_role"]
            roles.append({
                "rank": rank,
                **r,
                "low_confidence": self.tables["roles"][job]["low_confidence"],
                "ai_outlook": insights.ai_outlook(self.tables, job),
                "salary": insights.salary_benchmark(self.tables, job, profile.get("country"),
                                                    profile.get("work_exp")),
                "skill_gap": insights.skill_gap(self.tables, job, profile.get("tech")),
            })

        answered = [b for b, a in (profile.get("tech") or {}).items() if a.get("have") or a.get("want") or a.get("none")]
        return {
            "roles": roles,
            "families": targets.top_k_families(proba, classes, k=TOP_K),
            # every job role, so the frontend can compare two answers ("what if")
            "ranking": [{k: r[k] for k in ("job_role", "label", "family", "probability")}
                        for r in targets.top_k(proba, classes, k=len(classes))],
            "notes": self._notes(roles, answered),
            "profile": {
                "region": insights.region_of(profile.get("country")),
                "experience_band": insights.band_of(profile.get("work_exp")),
                "tech_areas_answered": answered,
            },
            "model": self.info(),
            "attribution": self.options["attribution"],
        }

    @staticmethod
    def _notes(roles: list[dict], answered: list[str]) -> list[str]:
        notes = []
        if not answered:
            notes.append("You did not answer any technology questions, so these suggestions rely on your "
                         "experience and AI answers only and are much less personal.")
        if any(r["low_confidence"] for r in roles):
            notes.append("A role marked low confidence is one the model rarely identifies correctly because "
                         "the survey has few people in it. Treat it as a weaker suggestion.")
        if any(r["salary"]["available"] and not r["salary"]["local"] for r in roles):
            notes.append("Some salary figures are worldwide because fewer than 30 people in your country or "
                         "region share that role and experience level. Local pay may be very different.")
        notes.append("These are suggestions based on the skills of developers in the Stack Overflow 2025 "
                     "survey. A low score means your profile is unlike that role's respondents, not that you "
                     "cannot do the job. Do not use this for hiring or salary decisions.")
        return notes
