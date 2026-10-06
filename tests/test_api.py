"""Checks for the Stage 9 web API (app/), called over HTTP with FastAPI's TestClient.

Companion to test_preprocessing.py and test_modelling.py. These cover what the
web app relies on:

  * the three endpoints answer and describe the deployed model
  * a valid profile always gets three ranked roles, families, a full ranking,
    insights and caveats, and every probability is a probability
  * the API gives the same probabilities as the saved model for real
    held-out respondents (no preprocessing drift between training and serving)
  * every invalid answer is rejected with a 422 that names the field, and the
    message says what is wrong
  * blank and skipped answers are treated as "unknown", like skipped survey questions

Run:  pytest -q tests/test_api.py
"""
from __future__ import annotations

import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from skillpath import config as C
from skillpath.pipeline import model_input_columns
from skillpath.profile import row_to_profile

BACHELORS = "Bachelor’s degree (B.A., B.S., B.Eng., etc.)"
DAILY = "Yes, I use AI tools daily"

# Clear-cut profiles and the career family each should rank first (plus the
# job role, where one role clearly dominates). Similar to the "Try an example"
# profiles in frontend/src/samples.ts.
PERSONAS = {
    "mobile": ({
        "country": "India", "years_code": 6, "work_exp": 3, "ed_level": BACHELORS,
        "tech": {
            "Language": {"have": ["Kotlin", "Java", "TypeScript", "JavaScript"], "want": ["Swift"]},
            "Database": {"have": ["SQLite", "Firebase Realtime Database"]},
            "Platform": {"have": ["Firebase", "npm"]},
            "DevEnvs": {"have": ["Android Studio", "Visual Studio Code"]},
        },
        "ai": {"AISelect": DAILY},
    }, "Mobile", "Developer, mobile"),
    "full-stack": ({
        "country": "Sri Lanka", "years_code": 4, "work_exp": 0,
        "tech": {
            "Language": {"have": ["Java", "Python", "JavaScript", "HTML/CSS", "SQL"]},
            "Database": {"have": ["MySQL", "MongoDB"]},
            "Webframe": {"have": ["React", "Node.js", "Express", "Spring Boot"]},
        },
    }, "Full-stack", "Developer, full-stack"),
    "data": ({
        "country": "Sri Lanka", "years_code": 6, "work_exp": 2,
        "tech": {
            "Language": {"have": ["Python", "SQL", "R"]},
            "Webframe": {"none": True},
            "DevEnvs": {"have": ["Jupyter Notebook/JupyterLab", "Visual Studio Code", "PyCharm"]},
        },
    }, "Data Sci/ML", None),  # AI/ML engineer and data scientist are close; the family is clear
}


@pytest.fixture(scope="module")
def client():
    # the context manager runs the startup hook that loads the model
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def options(client):
    return client.get("/api/options").json()


def predict(client, body):
    return client.post("/api/predict", json=body)


def fields(response) -> dict[str, str]:
    assert response.status_code == 422, response.text
    body = response.json()
    assert body["error"] == "invalid_input" and body["message"]
    return {f["field"]: f["message"] for f in body["fields"]}


# --- health and options -------------------------------------------------------
def test_health_reports_the_loaded_model(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "version": r.json()["version"], "model": "Logistic Regression"}


def test_options_list_every_answer_the_form_needs(options):
    assert set(C.TECH_BLOCKS) == set(options["tech"])
    for block, values in options["tech"].items():
        assert values and len(values) == len(set(values)), block
    assert set(options["ai"]) == {"AISelect", "AIAgents", "AIAcc", "AISent"}
    assert len(options["job_roles"]) == 20
    assert options["limits"]["years_max"] == 60
    assert "ODbL" in options["attribution"]


def test_every_country_offered_has_a_region(options):
    """Salary peer groups and the region feature need it ('Nomadic' has none by design)."""
    missing = [c["Country"] for c in options["countries"] if not c["Region"] and c["Country"] != "Nomadic"]
    assert not missing


def test_education_options_exclude_the_unrankable_other_answer(options):
    """'Other (please specify):' has no place on the education scale, so it is not offered."""
    assert "Other (please specify):" not in options["ed_level"]


# --- a valid prediction -------------------------------------------------------
@pytest.mark.parametrize("name", PERSONAS)
def test_clear_cut_profiles_get_the_expected_top_family_and_role(client, name):
    profile, family, job_role = PERSONAS[name]
    r = predict(client, profile)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["families"][0]["family"] == family
    assert body["families"][0]["probability"] > 0.5
    if job_role:
        assert body["roles"][0]["job_role"] == job_role


def test_response_has_three_ranked_roles_with_every_section(client):
    body = predict(client, PERSONAS["full-stack"][0]).json()
    roles = body["roles"]
    assert [r["rank"] for r in roles] == [1, 2, 3]
    assert [r["probability"] for r in roles] == sorted((r["probability"] for r in roles), reverse=True)
    for r in roles:
        assert r["label"] and r["family"] and r["description"]
        assert r["ai_outlook"]["n"] >= C.MIN_PEER_N
        assert "all_roles" in r["ai_outlook"]
        assert isinstance(r["low_confidence"], bool)
        assert set(r["skill_gap"]) == {"role_n", "typical_count", "matched", "missing"}
    assert len(body["families"]) == 3
    assert body["model"]["classes"] == 20
    assert body["notes"] and "ODbL" in body["attribution"]


def test_ranking_covers_all_20_roles_and_sums_to_one(client):
    body = predict(client, PERSONAS["data"][0]).json()
    ranking = body["ranking"]
    assert len({r["job_role"] for r in ranking}) == 20
    probs = [r["probability"] for r in ranking]
    assert all(0 <= p <= 1 for p in probs)
    assert probs == sorted(probs, reverse=True)
    assert sum(probs) == pytest.approx(1, abs=1e-9)
    # the three cards are the top of the same ranking
    assert [r["job_role"] for r in body["roles"]] == [r["job_role"] for r in ranking[:3]]


def test_family_probabilities_add_up_from_the_ranking(client):
    body = predict(client, PERSONAS["mobile"][0]).json()
    for fam in body["families"]:
        total = sum(r["probability"] for r in body["ranking"] if r["family"] == fam["family"])
        assert fam["probability"] == pytest.approx(total, abs=1e-9)


def test_skill_gap_never_suggests_something_the_user_has(client):
    profile = PERSONAS["data"][0]
    have = {t for a in profile["tech"].values() for t in a.get("have", [])}
    for role in predict(client, profile).json()["roles"]:
        gap = role["skill_gap"]
        assert not have & {s["technology"] for s in gap["missing"]}
        assert set(gap["matched"]) <= have
        assert len(gap["missing"]) <= 5


def test_skill_gap_marks_technologies_the_user_wants(client):
    profile = {"tech": {"DevEnvs": {"want": ["Jupyter Notebook/JupyterLab"]}}, "years_code": 3}
    body = predict(client, profile).json()
    hits = [s for r in body["roles"] for s in r["skill_gap"]["missing"]
            if s["technology"] == "Jupyter Notebook/JupyterLab"]
    assert hits and all(s["wanted"] for s in hits)


def test_salary_uses_the_users_country_when_the_group_is_large_enough(client):
    body = predict(client, {**PERSONAS["full-stack"][0], "country": "United States of America", "work_exp": 8}).json()
    salary = body["roles"][0]["salary"]
    assert salary["available"] and salary["local"]
    assert salary["n"] >= C.MIN_PEER_N
    assert salary["p25"] <= salary["median"] <= salary["p75"]
    assert salary["experience_band"] == "6-10"
    assert salary["peer_group"].startswith("Full-stack Developers in United States of America")


def test_salary_falls_back_to_worldwide_for_a_small_local_group(client):
    """US mobile developers with 6-10 years are fewer than 30, so the worldwide group is used."""
    body = predict(client, {**PERSONAS["mobile"][0], "country": "United States of America", "work_exp": 8}).json()
    salary = body["roles"][0]["salary"]
    assert salary["available"] and not salary["local"]
    assert salary["level"] == "JobRole x Global x experience"
    assert any("worldwide" in n for n in body["notes"])


def test_salary_needs_work_experience(client):
    salary = predict(client, {"tech": PERSONAS["mobile"][0]["tech"]}).json()["roles"][0]["salary"]
    assert not salary["available"] and "experience" in salary["reason"]


def test_response_echoes_how_the_profile_was_read(client):
    body = predict(client, PERSONAS["data"][0]).json()
    assert body["profile"] == {
        "region": "South Asia",
        "experience_band": "0-2",
        "tech_areas_answered": ["Language", "Webframe", "DevEnvs"],
    }


# --- training/serving parity --------------------------------------------------
def test_api_matches_the_saved_model_for_held_out_respondents(client, options):
    """Real test-split rows sent as JSON must get exactly the model's probabilities."""
    test = pd.read_parquet(C.PROCESSED_DIR / "test.parquet").sample(150, random_state=7)
    model = joblib.load(C.ARTIFACTS_DIR / "model.joblib")
    expected = model.predict_proba(test[model_input_columns()])
    for i, (_, row) in enumerate(test.iterrows()):
        profile = row_to_profile(row)
        profile.pop("context")  # not a model input of the final (core) feature set
        for k in ("years_code", "work_exp"):
            if profile[k] is not None:
                profile[k] = int(profile[k])
        if profile["ed_level"] not in options["ed_level"]:
            profile["ed_level"] = None  # 'Other (please specify):' is encoded as missing in training too
        r = predict(client, profile)
        assert r.status_code == 200, r.text
        got = {x["job_role"]: x["probability"] for x in r.json()["ranking"]}
        np.testing.assert_allclose([got[c] for c in model.classes_], expected[i], atol=1e-9)


# --- skipped and blank answers ------------------------------------------------
def test_an_empty_profile_is_valid_and_says_it_is_not_personal(client):
    r = predict(client, {})
    assert r.status_code == 200
    body = r.json()
    assert len(body["roles"]) == 3
    assert body["notes"][0].startswith("You did not answer any technology questions")
    assert body["profile"] == {"region": None, "experience_band": None, "tech_areas_answered": []}


def test_blank_text_answers_count_as_skipped(client):
    blank = predict(client, {"country": "  ", "ed_level": "", "ai": {"AISelect": ""}}).json()
    skipped = predict(client, {}).json()
    assert blank["ranking"] == skipped["ranking"]


def test_blank_work_experience_means_zero_when_years_coding_is_given(client):
    """The survey said 'if 0, leave blank'; training applied the same rule."""
    blank = predict(client, {"years_code": 5}).json()
    zero = predict(client, {"years_code": 5, "work_exp": 0}).json()
    assert blank["ranking"] == zero["ranking"]
    assert blank["profile"]["experience_band"] == "0-2"


def test_none_is_different_from_skipping_a_technology_area(client):
    """'I don't use any' is a true zero; a skipped area is unknown."""
    none = predict(client, {"years_code": 5, "tech": {"Webframe": {"none": True}}}).json()
    skipped = predict(client, {"years_code": 5}).json()
    assert none["profile"]["tech_areas_answered"] == ["Webframe"]
    assert none["ranking"] != skipped["ranking"]


def test_duplicate_technologies_are_ignored(client):
    once = predict(client, {"tech": {"Language": {"have": ["Python"]}}}).json()
    twice = predict(client, {"tech": {"Language": {"have": ["Python", "Python"]}}}).json()
    assert once["ranking"] == twice["ranking"]


# --- invalid input ------------------------------------------------------------
@pytest.mark.parametrize("body, field, words", [
    ({"years_code": -1}, "years_code", "greater than or equal to 0"),
    ({"years_code": 61}, "years_code", "less than or equal to 60"),
    ({"work_exp": 2.5}, "work_exp", "integer"),
    ({"years_code": "five"}, "years_code", "integer"),
    ({"country": "Atlantis"}, "country", "not a valid country"),
    ({"ed_level": "PhD-ish"}, "ed_level", "not a valid education level"),
    ({"learn_code_ai": "maybe"}, "learn_code_ai", "not a valid answer"),
    ({"ai": {"AISelect": "sometimes"}}, "ai.AISelect", "not a valid answer for AISelect"),
    ({"ai": {"Mood": "happy"}}, "ai.Mood", "Extra inputs are not permitted"),
    ({"salary": 100000}, "salary", "Extra inputs are not permitted"),
    ({"tech": {"Foo": {"have": []}}}, "tech", "'Foo' is not a valid technology area"),
    ({"tech": {"Language": {"have": ["Cobol++"]}}}, "tech", "Language.have: unknown technologies ['Cobol++']"),
    ({"tech": {"Database": {"want": ["Excel"]}}}, "tech", "Database.want: unknown technologies"),
    ({"tech": {"Language": {"have": ["Python"], "none": True}}}, "tech", "cannot be combined"),
    ({"tech": {"Language": {"used": ["Python"]}}}, "tech.Language.used", "Extra inputs are not permitted"),
])
def test_invalid_answers_are_rejected_with_the_field_named(client, body, field, words):
    errors = fields(predict(client, body))
    assert field in errors, errors
    assert words in errors[field]


def test_ticking_almost_every_technology_is_rejected(client, options):
    """Same straight-lining rule that removed careless survey answers from training."""
    langs = options["tech"]["Language"]
    limit = int(np.ceil(C.STRAIGHTLINE_SHARE * C.TECH_OPTION_COUNTS["Language"]))
    assert predict(client, {"tech": {"Language": {"have": langs[:limit - 1]}}}).status_code == 200
    errors = fields(predict(client, {"tech": {"Language": {"have": langs[:limit]}}}))
    assert errors["tech"].startswith(f"Language.have: {limit} of 42 options selected")


def test_every_problem_is_reported_at_once(client):
    errors = fields(predict(client, {"years_code": -1, "country": "Atlantis", "ai": {"AIAcc": "?"}}))
    assert set(errors) == {"years_code", "country", "ai.AIAcc"}


def test_malformed_json_gets_a_readable_error(client):
    r = client.post("/api/predict", content="{not json", headers={"Content-Type": "application/json"})
    assert fields(r) == {"body": "JSON decode error"}


def test_wrong_method_and_unknown_path(client):
    assert client.get("/api/predict").status_code == 405
    assert client.get("/api/nothing").status_code == 404
