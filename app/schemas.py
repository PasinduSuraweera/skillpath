"""Request and response models for the SkillPath API.

Every categorical answer is checked against artifacts/options.json, which was
built from the training data, so the API only accepts values the model has
seen. A field the user skips is left out (or null) and becomes "unknown",
exactly like a skipped survey question in training.
"""
from __future__ import annotations

import json

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from skillpath import config as C

OPTIONS = json.loads((C.ARTIFACTS_DIR / "options.json").read_text())
COUNTRIES = {c["Country"] for c in OPTIONS["countries"]}
YEARS_MAX = OPTIONS["limits"]["years_max"]

EXAMPLE_PROFILE = {
    "country": "Sri Lanka",
    "years_code": 5,
    "work_exp": 1,
    "ed_level": "Bachelor’s degree (B.A., B.S., B.Eng., etc.)",
    "learn_code_ai": "Yes, I learned how to use AI-enabled tools for my personal curiosity and/or hobbies",
    "tech": {
        "Language": {"have": ["Python", "SQL"], "want": ["Rust"]},
        "Database": {"have": ["PostgreSQL"]},
        "Webframe": {"none": True},
    },
    "ai": {"AISelect": "Yes, I use AI tools daily", "AIAgents": "No, but I plan to"},
}


def _blank_to_none(v):
    return None if isinstance(v, str) and not v.strip() else v


def _one_of(value, allowed, what: str):
    if value is not None and value not in allowed:
        raise ValueError(f"'{value}' is not a valid {what}. Valid values are listed by GET /api/options.")
    return value


class TechAnswer(BaseModel):
    """One technology area: what the user has used, wants to use, or 'I don't use any'."""
    model_config = ConfigDict(extra="forbid")

    have: list[str] = Field(default_factory=list, description="Used for extensive work in the past year")
    want: list[str] = Field(default_factory=list, description="Wants to work with in the next year")
    none: bool = Field(False, description="Ticked 'I don't use any' (a true zero, not unknown)")


class AIAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")

    AISelect: str | None = Field(None, description="How often the user uses AI tools")
    AIAgents: str | None = Field(None, description="Whether the user uses AI agents")
    AIAcc: str | None = Field(None, description="Trust in the accuracy of AI tools")
    AISent: str | None = Field(None, description="Overall view of AI tools")

    @field_validator("*", mode="before")
    @classmethod
    def blank(cls, v):
        return _blank_to_none(v)

    @field_validator("*")
    @classmethod
    def valid_answer(cls, v, info):
        return _one_of(v, OPTIONS["ai"][info.field_name], f"answer for {info.field_name}")


class Profile(BaseModel):
    """A user's answers. Every field is optional; skipped fields count as unknown."""
    model_config = ConfigDict(extra="forbid", json_schema_extra={"examples": [EXAMPLE_PROFILE]})

    country: str | None = Field(None, description="Country of residence (mapped to one of 13 regions)")
    years_code: int | None = Field(None, ge=0, le=YEARS_MAX, description="Years coding, including education")
    work_exp: int | None = Field(None, ge=0, le=YEARS_MAX,
                                 description="Years of professional work (0 if none; blank means 0 when years_code is given)")
    ed_level: str | None = Field(None, description="Highest level of formal education")
    learn_code_ai: str | None = Field(None, description="Whether the user learned AI tooling in the past year")
    tech: dict[str, TechAnswer] = Field(default_factory=dict, description="Technology areas, keyed by block name")
    ai: AIAnswers = Field(default_factory=AIAnswers)

    @field_validator("country", "ed_level", "learn_code_ai", mode="before")
    @classmethod
    def blank(cls, v):
        return _blank_to_none(v)

    @field_validator("country")
    @classmethod
    def valid_country(cls, v):
        return _one_of(v, COUNTRIES, "country")

    @field_validator("ed_level")
    @classmethod
    def valid_education(cls, v):
        return _one_of(v, OPTIONS["ed_level"], "education level")

    @field_validator("learn_code_ai")
    @classmethod
    def valid_learning(cls, v):
        return _one_of(v, OPTIONS["learn_code_ai"], "answer for learn_code_ai")

    @field_validator("tech")
    @classmethod
    def valid_tech(cls, tech: dict[str, TechAnswer]):
        for block, answer in tech.items():
            _one_of(block, OPTIONS["tech"], "technology area")
            allowed = set(OPTIONS["tech"][block])
            for kind in ("have", "want"):
                unknown = [t for t in getattr(answer, kind) if t not in allowed]
                if unknown:
                    raise ValueError(f"{block}.{kind}: unknown technologies {unknown}. "
                                     "Valid values are listed by GET /api/options.")
                # duplicates carry no extra meaning; keep the first occurrence
                setattr(answer, kind, list(dict.fromkeys(getattr(answer, kind))))
            if answer.none and (answer.have or answer.want):
                raise ValueError(f"{block}: 'I don't use any' cannot be combined with selected technologies.")
            # same rule that removed careless "tick everything" survey answers from training
            limit = C.STRAIGHTLINE_SHARE * C.TECH_OPTION_COUNTS[block]
            if len(answer.have) >= limit:
                raise ValueError(f"{block}.have: {len(answer.have)} of {C.TECH_OPTION_COUNTS[block]} options "
                                 "selected. Select only what you have used for extensive work.")
        return tech

    @model_validator(mode="after")
    def work_exp_blank_means_zero(self):
        # Survey instruction: "If your answer is 0, please leave blank". Training
        # applied this rule in cleaning.clean_experience, so the API does too.
        if self.work_exp is None and self.years_code is not None:
            self.work_exp = 0
        return self


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------
class AIStats(BaseModel):
    n: int = Field(description="Respondents behind the exposure figures")
    exposure_now: float = Field(description="AI Exposure Index today, 0-100")
    exposure_expected: float = Field(description="AI Exposure Index including planned AI use, 0-100")
    threat_yes_pct: float = Field(description="% who say AI is a threat to their current job")
    threat_n: int


class AIOutlook(AIStats):
    level: str = Field(description="'job role', or 'role family' when the role has too few respondents")
    all_roles: AIStats = Field(description="The same figures for all 20 job roles, for comparison")


class SalaryBenchmark(BaseModel):
    available: bool
    reason: str | None = None
    n: int | None = Field(None, description="Salaried respondents in the peer group")
    p25: int | None = None
    median: int | None = None
    p75: int | None = None
    currency: str | None = None
    experience_band: str | None = None
    level: str | None = Field(None, description="Peer-group level used (see config.PEER_GROUP_LEVELS)")
    local: bool | None = Field(None, description="True when the group is the user's country or region")
    peer_group: str | None = Field(None, description="Plain-English description of the peer group")


class SkillSuggestion(BaseModel):
    technology: str
    area: str = Field(description="Technology area (block name)")
    share_pct: float = Field(description="% of people in this role who used it in the past year")
    lift: float = Field(description="How many times more common it is in this role than across all roles")
    wanted: bool = Field(description="The user already listed it as something they want to learn")


class SkillGap(BaseModel):
    role_n: int = Field(description="Training respondents in this role")
    typical_count: int = Field(description="Distinctive technologies stored for this role")
    matched: list[str] = Field(description="Distinctive technologies the user already has")
    missing: list[SkillSuggestion] = Field(description="Most distinctive ones the user has not used yet")


class RoleRecommendation(BaseModel):
    rank: int
    job_role: str = Field(description="Survey DevType value (model class)")
    label: str
    family: str
    probability: float
    description: str
    low_confidence: bool = Field(description="Model rarely identifies this role correctly (test recall < 0.10)")
    ai_outlook: AIOutlook
    salary: SalaryBenchmark
    skill_gap: SkillGap


class FamilyRecommendation(BaseModel):
    family: str
    probability: float = Field(description="Sum of the job-role probabilities in this family")


class RankedRole(BaseModel):
    job_role: str
    label: str
    family: str
    probability: float


class Recommendation(BaseModel):
    roles: list[RoleRecommendation]
    families: list[FamilyRecommendation]
    ranking: list[RankedRole] = Field(description="All 20 job roles, most likely first")
    notes: list[str] = Field(description="Caveats to show with the result")
    profile: dict = Field(description="What the model used: region, experience band, answered sections")
    model: dict = Field(description="Final model name and its held-out test performance")
    attribution: str
