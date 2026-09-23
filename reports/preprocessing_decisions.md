# SkillPath: EDA and preprocessing decisions

IT3051 Fundamentals of Data Mining, group KND_12 (SLIIT Kandy Uni).
Stages 3 and 4, prepared for Progress Evaluation 1.

Every number below comes from `scripts/build_dataset.py` (see `reports/build_report.json`)
or from the executed notebooks in `notebooks/` (HTML copies in `reports/html/`).
Data: Stack Overflow Annual Developer Survey 2025, ODbL v1.0.

---

## 1. The workflow in one picture

```
raw CSV (49,123 x 170)
  │  1. deterministic row cleaning (no statistics learned)
  │     near-empty, duplicates, straight-lining, experience fixes
  ▼
usable responses (43,242)
  │  2. cohort rules (fixed, from the proposal)
  ▼
recommender cohort (23,072, 20 job roles, 12 families)
  │  3. stratified 80/20 split on JobRole, frozen by ResponseId
  ├──────────────► test (4,615)  locked away until final evaluation
  ▼
train (18,457)
  │  4. learned preprocessing, fitted on train only, inside one sklearn Pipeline
  │     vocabulary, rare pooling, imputation values, scaling, zero-variance filter
  ▼
479 model features  ──►  same fitted pipeline is loaded by the web backend

supporting datasets (all exclude the 4,615 test respondents):
  AI exposure (16,538 train rows) · AI persona inputs (26,925) · salary reference (15,545)
```

The order is the leakage protection: nothing that learns from data runs before the split.

---

## 2. Record counts

| Step | Records | Removed |
|---|---:|---:|
| Raw public file | 49,123 | |
| Remove near-empty responses (10 or fewer answered fields) | 43,329 | 5,794 |
| Remove exact duplicates (all fields except ResponseId) | 43,329 | 0 (all 1,535 duplicates were near-empty) |
| Remove straight-lined responses (ticked 90%+ of a technology list) | 43,242 | 87 |
| Keep a specific developer role (drop missing, Student, Retired, Other) | 38,036 | 5,206 |
| Keep skill-defined technical roles | 31,406 | 6,630 |
| Keep respondents who answered the main technology question | **23,072** | 8,334 |
| Train / test (stratified 80/20) | 18,457 / 4,615 | |

The proposal's cohort was 23,120. The only change is the straight-lining rule found during
EDA (48 of the 87 careless responses were in the cohort). The proposal stated that cohort
figures would be verified during EDA, so this is an evidence-based refinement, not a change of scope.

---

## 3. Target variable

* **JobRole** = the respondent's `DevType` value, restricted to the 20 skill-defined roles.
* **RoleFamily** = the 12 career paths each JobRole belongs to (`config.ROLE_FAMILY`).
* Imbalance on the training split: Full-stack 39.4% (7,279), smallest UX / UI Designer 47,
  ratio about 155:1. For families the ratio is 36.6:1 (QA/Test has 199).

**Decision: the target is the specific JobRole (20 classes).** A RoleFamily's probability is
the sum of the probabilities of the job roles inside it (`skillpath.targets.family_proba`), so
one final model gives both the top-3 job roles and the top families. This follows the proposal
title and Sections 1.2, 3.1.1 and 5 (specific job roles, each mapped to its RoleFamily); where
Sections 3.2.1 and 4.1 call RoleFamily the target, read it as "the family level of the same
prediction". The split is stratified on JobRole, which keeps RoleFamily proportions equal too.

Why job roles and not only families (EDA section 2.4):
* roles inside a family use different technologies (e.g. Data Scientist: R, Databricks;
  AI/ML Engineer: Terraform, Redis, Cursor; Data / Business Analyst: VBA, Access), so the
  finer label carries real information and gives users concrete role names;
* some roles are very close (Cloud Infrastructure vs DevOps, cosine similarity 0.99; Data
  Engineer vs Data Scientist 0.97), so the app shows the top 3 with probabilities and the
  family total rather than a single answer;
* five roles have fewer than 150 training examples, so metrics are reported at both levels.

Metric consequences (from the imbalance): macro-F1, per-class precision and recall,
balanced accuracy, top-3 accuracy and log loss, each reported at **job-role level** and at
**family level** (family metrics use the summed probabilities). Accuracy alone is misleading
(always predicting Full-stack gives 39%).

---

## 4. Decision log

| # | Area | Decision | Evidence | Alternative rejected, and why |
|---|---|---|---|---|
| 1 | Invalid records | Drop responses with 10 or fewer answered fields | 5,794 rows contain only screening answers (MainBranch, Age, Employment, EdLevel); answered-field histogram shows a separate early-stop group | Keeping them: they have no role, skill or AI data |
| 2 | Duplicates | Drop exact duplicates (all fields except ID) | 1,834 rows in duplicate groups, **all** near-empty (identical screening answers from different people) | Treating them as repeat submissions: they are not, they just have almost no fields |
| 3 | Invalid records | Drop straight-liners: 90%+ of any technology list ticked | 99% of people tick at most 60% of any list; spike of about 70 people at exactly 100%; 87 flagged | Keeping them: "extensive work" in 40 of 42 languages is not credible and distorts role skill profiles |
| 4 | Missing (skills) | 0/1 technology columns plus `<block>_<list>_unknown` = 1 only when the list is empty and the gate answer was not "No" | Among respondents who reached the technology section, 56-82% of empty lists follow a gate "No", i.e. are true zeros (e.g. databases 74%) | Imputing technologies (cannot guess what someone uses); dropping rows with empty lists (would remove 10-45% and bias towards survey finishers) |
| 5 | Missing (experience) | Blank WorkExp with answered YearsCode set to 0 (2,919 usable rows) | Question text: "If your answer is '0', please leave blank"; minimum entered value is 1; blanks are 71% aged 18-24 with median 5 coding years (vs 12% and 15 years) | Median imputation would give new graduates 10 years of work |
| 6 | Invalid values | YearsCode / WorkExp impossible for the age band set to missing (73 / 100 usable rows), then median-imputed with an indicator | e.g. 100 years at age 25-34, 50 years of work at 18-24 | IQR trimming: would flag 173 genuine 46+ year careers |
| 7 | Not an error | WorkExp > YearsCode kept, becomes `CareerChanger` flag | WorkExp is total professional work, not coding work; 6.3% of training respondents, 24% of QA/Test vs 3% of Backend | Treating as invalid would delete a real, role-related pattern |
| 8 | Missing (other) | Ordinal and numeric gaps: training median + missing-indicator column; nominal gaps: explicit "Missing" category | Missing rates of 0.1-5% for these fields; indicators keep "did not answer" as information | Dropping rows loses respondents for little gain |
| 9 | Rare categories | Technologies chosen by < 0.5% of training respondents pooled into `<block>_<list>__OTHER` | Only 6 options affected, in 7 lists (Mojo, Datomic, Yandex Cloud, Cohere, Reka, visionOS); threshold = about 92 people, enough for about 18 per CV validation fold | One column per rare option (unstable estimates); a higher threshold (loses real signal) |
| 10 | Encoding (multi-select) | Multi-hot per technology for both have and want lists | 7 blocks, 403 technology columns after pooling | Label-encoding a multi-select field is meaningless |
| 11 | Encoding (ordinal) | Fixed semantic order to integers (EdLevel, AISelect, AIAgents, AIAcc, AISent); off-scale answers ("Other", "I don't know") become missing; "Unsure" sentiment = neutral point | These are ordered answer scales; order comes from meaning, not from data, so it cannot leak | One-hot would throw away the order |
| 12 | Encoding (nominal) | One-hot for Region and LearnCodeAI, `handle_unknown="ignore"` | Unordered categories; ignore protects the web app against unseen values | Ordinal codes would invent an order |
| 13 | High cardinality | Country mapped to 13 UN M49 based regions | 150+ countries, most with a handful of people; region keeps geographic signal (South Asia: 17% of Mobile but 3% of Embedded developers) | One-hot of 177 countries (sparse, overfits); target encoding (leak risk, harder to explain) |
| 14 | Scaling | StandardScaler on the experience and ordinal branches; technology and one-hot 0/1 columns left as 0/1 (the few indicator columns inside the scaled branches are scaled with them, which is harmless) | Needed for logistic regression and distance-based models; test means within 0.05 of 0 and SDs 0.95-1.05 (not exactly 0 and 1) show train-only fitting | Scaling binaries adds nothing and hurts interpretability |
| 15 | Skew | log1p on YearsCode, WorkExp and technology counts | Breadth skew 1.13 falls to -0.69 after log1p; long career tails | Raw counts let a few extreme values dominate linear models |
| 16 | Feature engineering | `_count` (breadth), `want_new_count` (learning direction), `unknown` flags, `OTHER`, `CareerChanger`, `Region`, `ExperienceBand` (salary), AI Exposure Index (AI outlook) | Want list is related but not a copy of have (phi 0.18-0.76, none above 0.8); Rust 18%, Go 14% wanted by non-users | |
| 17 | Feature selection (scope) | Exclude DevType/JobRole/RoleFamily (target), CompTotal/Currency (make the salary), `...Admired` (derived from have + want), free-text entries, rank questions, JobSat, Stack Overflow usage, **Age** (fairness) | Proposal Section 7.3 and 8 | |
| 18 | Feature selection (filter) | Zero-variance filter inside the pipeline drops columns constant in training (8 dropped: 7 empty OTHER columns and `Language_have_unknown`) | Constant columns cannot carry information | |
| 19 | Feature selection (relevance) | Keep all 479 for now; tune SelectKBest inside CV in Stage 7 | 431 of 479 features significant at Bonferroni alpha (chi-square / ANOVA F on train); weak single features may still help in combination | Selecting on the full training set before CV leaks into CV scores |
| 20 | Redundancy | Keep correlated pairs | Only one technology pair above r = 0.8 (Elixir and Phoenix, 0.81); YearsCode vs WorkExp r = 0.88, handled by L2 regularisation, tested as a Stage 7 experiment | Dropping one of each pair loses the part the other misses |
| 21 | Optional features | Current-job context (OrgSize, Industry, RemoteWork, ICorPM) kept out of the default "core" set, available as "core+context" (506 features) | Students, the main users, have no current employer; train/serve mismatch risk | Using them by default would make the model rely on answers most users cannot give |
| 22 | Split | Stratified 80/20 on JobRole, `random_state=42`, IDs frozen in `split_ids.csv` | Largest class-proportion difference between train and test: 0.02 percentage points; smallest role still has 12 test examples | Random unstratified split could leave rare roles almost absent from test |
| 23 | Salary outliers | Stage 1: keep $1,000 to $1,000,000; Stage 2: robust z > 3.5 on log10 salary within country (region if fewer than 30) | Raw skew about 70; US values such as $10, $80, $130 (typed in thousands or monthly); 383 dropped by stage 1, 428 by stage 2 (medians/MADs fitted on reference rows only) | IQR on raw salary (useless under this skew); a single global rule (misses country-specific typos) |
| 24 | Salary peer groups | Country, then region, then global fallback with n >= 30; show sample size | Only 82 of 2,109 country x family x experience cells have 30+ people (42.5% of respondents); region cells cover 71.8%; Sri Lanka has 39 salaried respondents | Country-only benchmarks would be noise for most users |
| 25 | AI Exposure Index | Per respondent, over rated tasks: now = mostly 1, partially 0.5; expected also counts planned use; needs 7 of 13 tasks rated | Each task appears in exactly one level column (0 conflicts); 27,768 of 31,035 matrix respondents rated all 13 | |
| 26 | AI persona inputs | Six AI questions ordinal-encoded; AIComplex "don't use / don't know" left missing (4,548) for the clustering stage to handle | | |
| 27 | Supporting-table leakage | Salary, persona and AI summaries exclude the 4,615 test respondents | Proposal Section 7.3 | |
| 28 | Target level | Predict JobRole (20); derive RoleFamily by summing job-role probabilities | Within-family technology differences; family totals from the same model; proposal title and Section 5 | Family-only model: loses the specific role names users need; two separate models: two final models to justify |
| 29 | Job-role level summaries | AI exposure, AI threat and salary are also computed per job role, with sample sizes | Every job role has at least 41 AI-matrix respondents in train | Family-only summaries would hide differences such as AI Application Developer (expected exposure 56) vs Applied Scientist |
| 30 | Salary peer fallback | Job role x country, then job role x region, then family x country, family x region, job role global, family global (always within the experience band, n >= 30) | 69% get a job-role benchmark in their own country or region, 26% need a global group, under 2% have none | Country-only groups are far too thin |

---

## 5. Model inputs (what the web form must collect)

| Input | Survey column(s) | Type | Treatment |
|---|---|---|---|
| Technologies used / wanted (7 areas) | `...HaveWorkedWith`, `...WantToWorkWith` | multi-select | multi-hot, OTHER, log1p count, want_new_count |
| "I don't use any" per area | `...Choice` gates | Yes/No | only used to build the `unknown` flags |
| Years coding | YearsCode | numeric | age-plausibility check, log1p, median impute + indicator, scale |
| Years of professional work | WorkExp | numeric | blank = 0, same as above, CareerChanger |
| Education | EdLevel | ordinal (7 levels) | integer, median impute + indicator, scale |
| AI use frequency, agents, trust, sentiment | AISelect, AIAgents, AIAcc, AISent | ordinal | same as education |
| Learned AI tooling last year | LearnCodeAI | nominal (5) | one-hot, Missing category |
| Country | Country | nominal (177) | mapped to 13 regions, one-hot |
| (optional context) | OrgSize, Industry, RemoteWork, ICorPM | ordinal / nominal | Stage 7 experiment only |

Full list of the 479 output features with source and transformation: `reports/feature_dictionary.csv`.

---

## 6. Leakage prevention (all checked by code in `tests/test_preprocessing.py`)

1. Target and target-derived columns, CompTotal, Currency, Admired columns and Age are never inputs.
2. Split before anything is learned; train and test IDs are disjoint and frozen.
3. Vocabulary, rare pooling, medians, scalers and the variance filter are fitted on train only
   (test scaled features have means within 0.05 of 0, not exactly 0, which shows this).
4. In Stage 6-7 the preprocessor sits inside the model `Pipeline`, so every CV fold refits it.
5. Salary, persona and AI tables exclude test respondents; the salary outlier thresholds are
   learned from those reference rows only.
6. The web backend uses the saved fitted pipeline and `profile_to_frame()`; a test sends 300
   training rows through the API format and checks the features are identical.
7. Screening: no candidate column has a suspicious association with the job role
   (maximum Cramér's V = 0.42, for Swift).

---

## 7. Stage 7 experiment backlog (created by preprocessing decisions)

* Imbalance: none vs `class_weight="balanced"` vs SMOTE/random oversampling inside the folds
* `min_frequency` 0.25% / 0.5% / 1%
* With and without the want lists; with and without AI model / SO tag blocks
* core vs core+context feature set
* SelectKBest (chi-square) with k in {100, 200, 300, all}, inside CV
* Drop YearsCode or WorkExp (collinearity check)
* JobRole model aggregated to families vs a direct RoleFamily model (family-level scores of both)

---

## 8. What this means for the public web app

* The backend imports the `skillpath` package and loads `artifacts/preprocessor_core.joblib`
  (later the full model pipeline). No preprocessing is rewritten in the backend.
* `skillpath.profile.profile_to_frame()` is the API contract: JSON profile in, survey-format row out.
  A skipped section becomes "unknown"; an "I don't use any" tick becomes a true zero, exactly as in training.
* `artifacts/options.json` lists every valid choice (countries with regions, technologies per block,
  ordered answer scales, job role labels and families, the ODbL attribution line). The form should
  be generated from it so it can never offer a value the model has not seen.
* Unknown or new technologies are pooled into OTHER (or ignored where OTHER was constant),
  unknown categories are ignored, and an empty profile still produces a valid feature row.
* Artifacts are small (the preprocessor is about 33 KB); the raw survey file is not needed at
  runtime and should not be deployed. Aggregated tables shown publicly must credit Stack Overflow
  and stay under ODbL.
* No user input is stored (proposal Section 8). Pin `scikit-learn` in deployment to the version used to save the model.

---

## 9. Likely viva questions and short answers

**Why did you remove 5,794 rows?** They answered 10 or fewer fields, only the screening
questions, so they have no role, skill, AI or salary information. All 1,535 duplicate rows
were among them.

**Why not remove all rows with missing values?** Most gaps are structural or due to drop-out.
In the technology blocks most empty lists are genuine zeros after a gate "No". Dropping would
remove a large, non-random part of the cohort and bias it towards people who finished the survey.

**How do you tell "doesn't use databases" from "didn't answer"?** The gate question. Empty list
plus gate "No" means none (all zeros). Empty list otherwise sets a `Database_have_unknown` flag.

**Why is blank WorkExp set to 0 and not the median?** The survey told respondents to leave it
blank for 0. The blanks are mostly 18-24 year olds with 5 years of coding, so the median of 10
years would be wrong for them.

**Why not an IQR rule for experience outliers?** Long careers are real. IQR would flag 173
people with 46+ years. We only remove values that are impossible for the age band.

**Why was Age not used?** Fairness: recommending careers by age would reproduce age bias. Age
is only used to detect impossible experience values.

**Why regions instead of countries?** 150+ countries, most with very few people. Thirteen
UN-based regions keep the signal without hundreds of sparse columns.

**Why is the split stratified and why on JobRole?** The target is very imbalanced (155:1).
Stratifying on the finest label keeps both JobRole and RoleFamily proportions equal
(largest difference 0.02 percentage points).

**How do you avoid data leakage?** Deterministic cleaning, then split, then everything learned
is fitted on train only and sits inside the model pipeline, so each CV fold refits it. Test
respondents are excluded from salary, persona and AI tables. Leaky columns are excluded and
unit-tested.

**Why scale only some features?** Only continuous and ordinal features have different scales;
0/1 columns are already comparable. Scaling helps logistic regression and distance-based models
and does not affect trees.

**Why log1p?** Years and counts are right-skewed; log1p reduces skew (1.13 to -0.69 for breadth)
and handles zeros.

**What feature engineering did you do?** Breadth counts, learning direction (`want_new_count`),
unknown flags, rare OTHER columns, CareerChanger, Region, experience bands for salary peers, and
the AI Exposure Index.

**Did you do feature selection?** Yes, in three layers: scope (leaky, derived, sensitive and
out-of-scope columns removed), a support and zero-variance filter inside the pipeline, and
univariate relevance tests (431 of 479 significant). The final k is tuned inside CV in Stage 7
to avoid selection leakage.

**Why keep correlated features?** Only one technology pair exceeds r = 0.8; YearsCode and WorkExp
(0.88) mean different things. L2 regularisation handles it, and dropping one is a Stage 7 test.

**How are salary outliers handled?** Two stages: plausible global range ($1k to $1M), then a
robust z-score on log salary within each country or region to catch typos such as "$130" in
the US. Thresholds are learned without test respondents.

**Why predict the specific job role and not just the family?** The proposal promises specific
job roles, and EDA shows roles inside a family use different technologies (Data Scientists R and
Databricks, AI/ML Engineers Terraform and Cursor, analysts VBA and Access). Summing the job-role
probabilities gives the family probability, so one model serves both levels.

**What if two job roles are almost the same?** Some are (Cloud Infrastructure vs DevOps, 0.99
similarity). That is why the app shows the top 3 roles with probabilities and the family total,
and why we report top-3 accuracy and family-level metrics as well as per-role F1.

**Why did the cohort change from 23,120 to 23,072?** EDA found 87 careless "tick everything"
responses; 48 were in the cohort. Removing them is an evidence-based cleaning rule.

**How will the web app use the same preprocessing?** The fitted pipeline is saved with joblib and
the custom transformers live in the `skillpath` package, so the backend loads exactly the same
object. A test proves a profile sent through the API format gives identical features.
