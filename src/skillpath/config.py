"""Project-wide constants for SkillPath.

Every threshold used by the cleaning and preprocessing code lives here so that
the notebooks, the build script and the web backend all use the same values.
Each constant has a short note on why it has that value; the full evidence is
in reports/preprocessing_decisions.md.
"""
from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_DIR.parents[1]
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
INTERIM_DIR = DATA_DIR / "interim"
PROCESSED_DIR = DATA_DIR / "processed"
REFERENCE_DIR = DATA_DIR / "reference"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"
REPORTS_DIR = PROJECT_ROOT / "reports"
FIGURES_DIR = REPORTS_DIR / "figures"

RAW_CSV = RAW_DIR / "survey_results_public.csv"
SCHEMA_CSV = RAW_DIR / "survey_results_schema.csv"
COUNTRY_REGION_CSV = PACKAGE_DIR / "resources" / "country_region.csv"

ID_COL = "ResponseId"
RANDOM_STATE = 42

# ---------------------------------------------------------------------------
# Row-level cleaning
# ---------------------------------------------------------------------------
# A response with 10 or fewer answered fields only covers the screening block
# (MainBranch, Age, Employment, EdLevel). All 1,834 rows that belong to exact
# duplicate groups fall in this band, so this rule also removes the duplicates.
NEAR_EMPTY_MAX_ANSWERED = 10

# Upper age of each age band, used only to detect impossible experience values.
# Age itself is NOT a model feature (fairness decision in the approved proposal).
AGE_BAND_UPPER = {
    "18-24 years old": 24,
    "25-34 years old": 34,
    "35-44 years old": 44,
    "45-54 years old": 54,
    "55-64 years old": 64,
    "65 years or older": 80,
}
# Earliest plausible starting ages. Coding can start in childhood (the question
# includes education); paid work realistically starts in the mid-teens.
MIN_START_AGE_CODING = 5
MIN_START_AGE_WORK = 14
# Hard ceiling used when Age is "Prefer not to say".
MAX_YEARS_FALLBACK = 60

# ---------------------------------------------------------------------------
# Target: specific job role (DevType) and its RoleFamily
# ---------------------------------------------------------------------------
TARGET_SOURCE = "DevType"
# Primary prediction target: the specific job role (20 classes). RoleFamily is
# derived from it (sum of the job-role probabilities inside each family), so one
# model gives both levels of the recommendation. See skillpath.targets.
TARGET_JOB = "JobRole"
TARGET_FAMILY = "RoleFamily"
TARGET = TARGET_JOB

# The 20 skill-defined DevType values kept as prediction classes, grouped into
# the 12 RoleFamily career paths from the approved proposal (Section 4.1).
ROLE_FAMILY = {
    "Developer, full-stack": "Full-stack",
    "Developer, back-end": "Backend",
    "Developer, front-end": "Frontend",
    "UX, Research Ops or UI design professional": "Frontend",
    "Developer, mobile": "Mobile",
    "Developer, desktop or enterprise applications": "Desktop/Enterprise",
    "Developer, embedded applications or devices": "Embedded/Systems",
    "Developer, game or graphics": "Game/Graphics",
    "Data engineer": "Data Eng",
    "Database administrator or engineer": "Data Eng",
    "Data scientist": "Data Sci/ML",
    "AI/ML engineer": "Data Sci/ML",
    "Applied scientist": "Data Sci/ML",
    "Developer, AI apps or physical AI": "Data Sci/ML",
    "Data or business analyst": "Data Sci/ML",
    "DevOps engineer or professional": "DevOps/Cloud",
    "Cloud infrastructure engineer": "DevOps/Cloud",
    "System administrator": "DevOps/Cloud",
    "Cybersecurity or InfoSec professional": "Security",
    "Developer, QA or test": "QA/Test",
}

# Short, user-facing names for the web app.
JOB_ROLE_LABEL = {
    "Developer, full-stack": "Full-stack Developer",
    "Developer, back-end": "Back-end Developer",
    "Developer, front-end": "Front-end Developer",
    "UX, Research Ops or UI design professional": "UX / UI Designer",
    "Developer, mobile": "Mobile Developer",
    "Developer, desktop or enterprise applications": "Desktop / Enterprise Developer",
    "Developer, embedded applications or devices": "Embedded Developer",
    "Developer, game or graphics": "Game / Graphics Developer",
    "Data engineer": "Data Engineer",
    "Database administrator or engineer": "Database Administrator / Engineer",
    "Data scientist": "Data Scientist",
    "AI/ML engineer": "AI / ML Engineer",
    "Applied scientist": "Applied Scientist",
    "Developer, AI apps or physical AI": "AI Application Developer",
    "Data or business analyst": "Data / Business Analyst",
    "DevOps engineer or professional": "DevOps Engineer",
    "Cloud infrastructure engineer": "Cloud Infrastructure Engineer",
    "System administrator": "System Administrator",
    "Cybersecurity or InfoSec professional": "Cybersecurity Specialist",
    "Developer, QA or test": "QA / Test Engineer",
}

# One-line descriptions shown on the job role cards in the web app.
JOB_ROLE_DESCRIPTION = {
    "Developer, full-stack": "Builds both the user-facing and server side of web applications.",
    "Developer, back-end": "Builds server-side logic, APIs, databases and integrations.",
    "Developer, front-end": "Builds the parts of web applications that users see and interact with.",
    "UX, Research Ops or UI design professional": "Designs interfaces and user experiences, often prototyping in code.",
    "Developer, mobile": "Builds apps for Android and iOS devices.",
    "Developer, desktop or enterprise applications": "Builds desktop software and large internal business systems.",
    "Developer, embedded applications or devices": "Writes software that runs on hardware, devices and microcontrollers.",
    "Developer, game or graphics": "Builds games, game engines and graphics or rendering software.",
    "Data engineer": "Builds the pipelines and platforms that move and store data at scale.",
    "Database administrator or engineer": "Designs, runs and tunes databases for reliability and performance.",
    "Data scientist": "Uses statistics and machine learning to find insight in data.",
    "AI/ML engineer": "Builds, trains and deploys machine learning and AI models.",
    "Applied scientist": "Turns research methods into working models and products.",
    "Developer, AI apps or physical AI": "Builds applications on top of AI models, LLMs and agents.",
    "Data or business analyst": "Analyses data and reports insight to support business decisions.",
    "DevOps engineer or professional": "Automates building, testing, deploying and running software.",
    "Cloud infrastructure engineer": "Designs and manages cloud platforms and infrastructure as code.",
    "System administrator": "Keeps servers, networks and internal systems running.",
    "Cybersecurity or InfoSec professional": "Protects systems and data from attacks and finds vulnerabilities.",
    "Developer, QA or test": "Designs and automates tests to keep software quality high.",
}

# DevType values removed from the recommender cohort, with the reason.
EXCLUDED_ROLES = {
    "Student": "not a job role",
    "Retired": "not a job role",
    "Other (please specify):": "undefined role",
    "Architect, software or solutions": "seniority level, not a skill path",
    "Engineering manager": "management level, not a skill path",
    "Senior executive (C-suite, VP, etc.)": "management level, not a skill path",
    "Founder, technology or otherwise": "business role, not a skill path",
    "Project manager": "management role, not a skill path",
    "Product manager": "management role, not a skill path",
    "Academic researcher": "research role outside the technical career paths",
    "Financial analyst or engineer": "non-developer role",
    "Support engineer or analyst": "non-developer role",
}

# ---------------------------------------------------------------------------
# Technology blocks (multi-select questions)
# ---------------------------------------------------------------------------
# block name -> (have column, want column, gate column or None)
# The gate ("...Choice") question records whether the respondent worked with
# that technology area at all. Gate == "No" means the empty list is a TRUE zero
# (uses none); an empty list with any other gate value is UNKNOWN (skipped or
# dropped out). This is the main missing-value decision for the skill features.
TECH_BLOCKS = {
    "Language": ("LanguageHaveWorkedWith", "LanguageWantToWorkWith", "LanguageChoice"),
    "Database": ("DatabaseHaveWorkedWith", "DatabaseWantToWorkWith", "DatabaseChoice"),
    "Platform": ("PlatformHaveWorkedWith", "PlatformWantToWorkWith", "PlatformChoice"),
    "Webframe": ("WebframeHaveWorkedWith", "WebframeWantToWorkWith", "WebframeChoice"),
    "DevEnvs": ("DevEnvsHaveWorkedWith", "DevEnvsWantToWorkWith", "DevEnvsChoice"),
    "AIModels": ("AIModelsHaveWorkedWith", "AIModelsWantToWorkWith", "AIModelsChoice"),
    "SOTags": ("SOTagsHaveWorkedWith", "SOTagsWantToWorkWith", None),
}
MULTI_SEP = ";"
# Number of answer options per "have" list in the 2025 questionnaire.
TECH_OPTION_COUNTS = {"Language": 42, "Database": 30, "Platform": 42, "Webframe": 28,
                      "DevEnvs": 27, "AIModels": 17, "SOTags": 20}
# Careless "tick everything" answers: selecting 90%+ of a block's options (for
# example 38 of 42 languages) as "extensive development work in the past year" is
# not credible. 87 usable respondents do this; they are removed as invalid.
STRAIGHTLINE_SHARE = 0.90
# A technology becomes its own column only if at least 0.5% of TRAINING
# respondents selected it (about 92 people). Rarer ones are pooled into a
# per-block "Other" column. Tunable in Stage 7.
MIN_TOKEN_FREQUENCY = 0.005

# ---------------------------------------------------------------------------
# Ordinal encodings (ordered answer scales)
# ---------------------------------------------------------------------------
ORDINAL_MAPS = {
    "EdLevel": {
        "Primary/elementary school": 0,
        "Secondary school (e.g. American high school, German Realschule or Gymnasium, etc.)": 1,
        "Some college/university study without earning a degree": 2,
        "Associate degree (A.A., A.S., etc.)": 3,
        "Bachelor’s degree (B.A., B.S., B.Eng., etc.)": 4,
        "Master’s degree (M.A., M.S., M.Eng., MBA, etc.)": 5,
        "Professional degree (JD, MD, Ph.D, Ed.D, etc.)": 6,
        # "Other (please specify):" has no position on the scale -> missing
    },
    "OrgSize": {
        "Just me - I am a freelancer, sole proprietor, etc.": 0,
        "Less than 20 employees": 1,
        "20 to 99 employees": 2,
        "100 to 499 employees": 3,
        "500 to 999 employees": 4,
        "1,000 to 4,999 employees": 5,
        "5,000 to 9,999 employees": 6,
        "10,000 or more employees": 7,
        # "I don’t know" -> missing
    },
    "AISelect": {
        "No, and I don't plan to": 0,
        "No, but I plan to soon": 1,
        "Yes, I use AI tools monthly or infrequently": 2,
        "Yes, I use AI tools weekly": 3,
        "Yes, I use AI tools daily": 4,
    },
    "AIAgents": {
        "No, and I don't plan to": 0,
        "No, but I plan to": 1,
        "No, I use AI exclusively in copilot/autocomplete mode": 2,
        "Yes, I use AI agents at work monthly or infrequently": 3,
        "Yes, I use AI agents at work weekly": 4,
        "Yes, I use AI agents at work daily": 5,
    },
    "AIAcc": {
        "Highly distrust": 0,
        "Somewhat distrust": 1,
        "Neither trust nor distrust": 2,
        "Somewhat trust": 3,
        "Highly trust": 4,
    },
    "AISent": {
        "Very unfavorable": 0,
        "Unfavorable": 1,
        "Indifferent": 2,
        "Unsure": 2,  # no stance -> treated as the neutral point
        "Favorable": 3,
        "Very favorable": 4,
    },
    "AIComplex": {
        "Very poor at handling complex tasks": 0,
        "Bad at handling complex tasks": 1,
        "Neither good or bad at handling complex tasks": 2,
        "Good, but not great at handling complex tasks": 3,
        "Very well at handling complex tasks": 4,
        # "I don't use AI tools for complex tasks / I don't know" -> missing
    },
    "AIAgentChange": {
        "Not at all or minimally": 0,
        "No, but my development work has changed somewhat due to non-AI factors": 0,
        "No, but my development work has significantly changed due to non-AI factors": 0,
        "Yes, somewhat": 1,
        "Yes, to a great extent": 2,
    },
}

# ---------------------------------------------------------------------------
# Feature sets for the recommender
# ---------------------------------------------------------------------------
NUMERIC_FEATURES = ["YearsCode", "WorkExp"]
# AI usage inputs the web form asks for (proposal: frequency, agent use, trust,
# sentiment). AIComplex and AIAgentChange are used for personas instead.
ORDINAL_FEATURES_CORE = ["EdLevel", "AISelect", "AIAgents", "AIAcc", "AISent"]
NOMINAL_FEATURES_CORE = ["Region", "LearnCodeAI"]
# Current-job context. Students (the main users) have no current employer, so
# these are kept as an optional group and tested as a Stage 7 experiment.
ORDINAL_FEATURES_CONTEXT = ["OrgSize"]
NOMINAL_FEATURES_CONTEXT = ["Industry", "RemoteWork", "ICorPM"]

# Columns that must never be model inputs (target, target-derived or leaky).
LEAKY_OR_EXCLUDED = [
    "DevType", TARGET_JOB, TARGET_FAMILY,  # target and target-derived
    "CompTotal", "Currency",               # directly produce ConvertedCompYearly
    "Age",                                 # fairness: not a recommendation input
]

# ---------------------------------------------------------------------------
# Train / test split
# ---------------------------------------------------------------------------
TEST_SIZE = 0.20
# Stratify on the finest label so both JobRole and RoleFamily proportions are
# preserved in train and test.
STRATIFY_ON = TARGET_JOB

# ---------------------------------------------------------------------------
# Supporting analyses
# ---------------------------------------------------------------------------
AI_TOOL_COLUMNS = {
    "AIToolCurrently mostly AI": ("now", 1.0),
    "AIToolCurrently partially AI": ("now", 0.5),
    "AIToolPlan to mostly use AI": ("plan", 1.0),
    "AIToolPlan to partially use AI": ("plan", 0.5),
    "AIToolDon't plan to use AI for this task": ("none", 0.0),
}
AI_TASKS = [
    "Search for answers",
    "Generating content or synthetic data",
    "Learning new concepts or technologies",
    "Documenting code",
    "Creating or maintaining documentation",
    "Learning about a codebase",
    "Debugging or fixing code",
    "Testing code",
    "Writing code",
    "Predictive analytics",
    "Project planning",
    "Committing and reviewing code",
    "Deployment and monitoring",
]
# The exposure index is only computed when a respondent rated a majority of
# the 13 tasks (27,768 of 31,035 matrix respondents rated all 13).
AI_MIN_TASKS_ANSWERED = 7

PERSONA_FEATURES = ["AISelect", "AIAgents", "AIAcc", "AISent", "AIComplex", "AIAgentChange"]

SALARY_COL = "ConvertedCompYearly"
SALARY_EMPLOYMENT = ["Employed", "Independent contractor, freelancer, or self-employed"]
SALARY_MAIN_BRANCH = "I am a developer by profession"
# Stage 1: hard plausibility bounds for an annual full-time pay figure in USD.
SALARY_MIN, SALARY_MAX = 1_000, 1_000_000
# Stage 2: robust z-score on log10(salary) within each country (or region when
# the country has fewer than SALARY_MIN_GROUP_N reference respondents).
SALARY_ROBUST_Z = 3.5
SALARY_MIN_GROUP_N = 30
EXPERIENCE_BANDS = [0, 2, 5, 10, 20, 100]
EXPERIENCE_BAND_LABELS = ["0-2", "3-5", "6-10", "11-20", "20+"]
MIN_PEER_N = 30
# Salary peer groups, most specific first. The benchmark uses the first level
# whose group (always within the same experience band) has at least MIN_PEER_N
# reference respondents, and reports which level was used.
PEER_GROUP_LEVELS = [
    ("JobRole", "Country"),
    ("JobRole", "Region"),
    ("RoleFamily", "Country"),
    ("RoleFamily", "Region"),
    ("JobRole", None),
    ("RoleFamily", None),
]
