# SkillPath: modelling and optimisation decisions

IT3051 Fundamentals of Data Mining, group KND_12 (SLIIT Kandy Uni).
Stages 6 and 7, prepared for Progress Evaluation 2.

Companion to `preprocessing_decisions.md` (Stages 3–4). Every number below comes from
`scripts/run_models.py` or `scripts/tune_models.py` and is recorded in
`reports/model_experiments.csv`; the executed notebooks are `notebooks/04_modelling.py`
and `notebooks/05_optimization.py`.

Data: Stack Overflow Annual Developer Survey 2025, ODbL v1.0.

---

## 1. The problem, restated for modelling

| | |
|---|---|
| Task | Multi-class classification |
| Target | `JobRole` — 20 specific developer roles |
| Second level | `RoleFamily` — 12 career paths, obtained by **summing** the job-role probabilities |
| Training rows | 18,457 |
| Held-out rows | 4,615 (opened once, at the very end) |
| Features | 479 (the "core" set), 403 of them binary technology flags |
| Imbalance | Full-stack 7,279 vs UX/UI 47 — about **155:1** |

Two properties of this target drive every decision in Stages 6 and 7.

**1. Severe imbalance.** Always predicting Full-stack scores 39% accuracy while knowing
nothing. Accuracy is therefore not usable as the headline metric.

**2. Genuinely overlapping classes.** EDA measured cosine similarity 0.99 between the
technology profiles of Cloud Infrastructure and DevOps engineers, and 0.97 between Data
Engineer and Data Scientist. These roles are not separable *in the data*, so no algorithm
can separate them. This sets the ceiling, and it is why the product shows **three ranked
roles plus the family total** instead of a single answer.

---

## 2. Validation strategy

`StratifiedKFold(n_splits=5, shuffle=True, random_state=42)` on the training split, for
every experiment in both stages, so every number in this report is comparable with every
other.

| Choice | Reason | Alternative rejected |
|---|---|---|
| **Stratified** | With 47 examples in the smallest class, an unstratified fold could contain almost none of it and that fold's macro-F1 would be meaningless | Plain `KFold`: rare roles become absent at random |
| **5 folds** | The smallest class still contributes ~9 respondents per fold | 10 folds leaves ~4 per fold (per-class F1 becomes noise); 3 folds holds back training data the rare roles cannot spare |
| **`shuffle=True`, fixed seed** | The rows arrive in survey order; a fixed seed makes every run reproducible | Unshuffled: any ordering effect in the survey file becomes a fold effect |
| **Preprocessor inside the estimator** | Each fold refits the vocabulary, rare pooling, medians, scaler and variance filter on its own training part | Fitting once on all training data: every validation fold would influence its own features |
| **Test split untouched** | Only `scripts/finalise_model.py` opens it, once, after the model is chosen | Re-scoring on test while iterating turns it into a second validation set |

---

## 3. Algorithm selection

Stage 6 requires at least four algorithms; **six** are compared plus a baseline. They were
chosen to span different *inductive biases* rather than to be six variations of one idea,
and all had to satisfy one product constraint.

> **Every candidate must produce `predict_proba`.** The app ranks three roles and sums
> probabilities into families. A model without usable probabilities cannot be deployed
> whatever it scores — which is why `LinearSVC` appears wrapped in `CalibratedClassifierCV`
> rather than on its own.

| Model | Inductive bias | Why it belongs in the comparison |
|---|---|---|
| **Dummy (most frequent)** | none | Fixes the floor and proves the metric choice: ~0.39 accuracy with ~0.03 macro-F1 |
| **Complement Naive Bayes** | features independent given the class | Built for imbalanced, sparse count-like data; its assumption is *known false* here (React implies JavaScript), so it measures what that assumption costs |
| **k-Nearest Neighbours** (cosine) | local similarity | Tests the product's own premise — "similar skills, similar job". Cosine because the vectors are sparse 0/1 sets of very different breadth |
| **Logistic Regression** | linear in feature space | The standard strong baseline for wide sparse data; readable coefficients ("which skill pushes which role") matter for the Stage 12 presentation |
| **Linear SVM (calibrated)** | maximum margin | Optimises margins rather than likelihood; often beats logistic loss on sparse high-dimensional data |
| **Random Forest** | axis-aligned splits, bagged | Represents skill *combinations* a linear model cannot (Terraform AND Kubernetes AND Python → AI/ML engineer) |
| **Hist Gradient Boosting** | additive boosted trees | Each round corrects the previous rounds' errors, which usually helps the rare roles; costly because 20 classes means 20 trees per round |

---

## 4. Evaluation metrics

| Metric | Level | Role in the report |
|---|---|---|
| **macro-F1** | job role | **Primary.** Equal weight per role, so neglecting UX/UI costs as much as neglecting Full-stack |
| balanced accuracy | job role | Mean per-class recall — "is each role found at all" |
| top-3 accuracy | job role | What the user actually sees |
| log loss | job role | Are the probabilities themselves trustworthy? The app prints them as numbers |
| family macro-F1 | family | The coarser recommendation, from the same summed probabilities |
| family top-3 accuracy | family | The career-path shortlist |
| accuracy | job role | Reported **only** to demonstrate that it misleads |

Macro-F1 is primary because the product's value is in the rare roles: a system that only
ever recognises Full-stack and Back-end developers has nothing to tell the users who most
need career guidance.

---

## 5. Stage 6 results

5-fold cross-validation on the training split. Source: `reports/stage6_model_comparison.csv`.

| Model | macro-F1 | SD | bal. acc | accuracy | top-3 | log loss | family F1 | family top-3 | fit (s) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Hist Gradient Boosting | **0.2724** | 0.0095 | 0.2477 | 0.5602 | 0.8289 | 1.474 | **0.3926** | **0.8614** | 179.5 |
| Logistic Regression | 0.2547 | 0.0031 | **0.3321** | 0.3657 | 0.7262 | 2.269 | 0.3485 | 0.7783 | 91.7 |
| Random Forest | 0.2537 | 0.0082 | 0.2404 | 0.5541 | **0.8301** | 1.608 | 0.3750 | 0.8548 | 4.3 |
| Linear SVM (calibrated) | 0.1911 | 0.0080 | 0.1776 | 0.5368 | 0.8092 | 1.535 | 0.3274 | 0.8507 | 11.6 |
| Complement Naive Bayes | 0.1786 | 0.0024 | 0.2030 | 0.4917 | 0.7210 | 2.328 | 0.1583 | 0.6320 | 2.5 |
| k-Nearest Neighbours | 0.1676 | 0.0038 | 0.1510 | 0.4997 | 0.7814 | 4.413 | 0.2822 | 0.8192 | 1.4 |
| Dummy (most frequent) | 0.0283 | 0.0000 | 0.0500 | 0.3944 | 0.4117 | 21.83 | 0.0471 | 0.6614 | 1.8 |

### Why the models rank as they do

**The Dummy row justifies the metric choice.** It always answers "Full-stack", knows
nothing, and scores **0.394 accuracy** — higher than Complement Naive Bayes and k-NN, both
of which have learned something real. Its macro-F1 of 0.028 exposes it instantly. Any
report that led with accuracy would rank a model that cannot do anything above two that can.

**Complement Naive Bayes (0.179)** is fast and well above chance, but its independence
assumption is plainly false here: React implies JavaScript, Kubernetes implies Docker. It
counts each co-occurring technology as fresh evidence and becomes over-confident, which is
visible in its poor log loss (2.33) and its very weak family-level F1 (0.158).

**k-Nearest Neighbours (0.168)** tests the product's own premise — similar skills, similar
job — and the premise holds in a weak form: top-3 accuracy is a respectable 0.781. But 479
dimensions is a hostile neighbourhood. With mostly 0/1 features, pairwise distances
concentrate and the "neighbourhood" stops being local. Its log loss of 4.41 is the worst of
any real model: the probabilities are nearly meaningless even when the ranking is not.

**Logistic Regression (0.255)** and **Linear SVM (0.191)** are both linear, but they are not
interchangeable. Logistic Regression has the **best balanced accuracy of any Stage 6 model
(0.332)** and simultaneously the **worst accuracy (0.366)**. That is `class_weight="balanced"`
doing exactly what it was asked: chase the rare roles and accept many false positives on
Full-stack. Phase A revisits this, with a surprising result.

**Random Forest (0.254)** and **Hist Gradient Boosting (0.272)** represent skill
*combinations* no linear model can (Terraform AND Kubernetes AND Python → AI/ML engineer).
Boosting takes the top macro-F1 because each round focuses on the previous rounds' errors,
which is where the rare roles live.

**The headline finding is the spread, not the winner.** The top three models sit at 0.2537,
0.2547 and 0.2724 with fold standard deviations of 0.008, 0.003 and 0.010. Random Forest and
Logistic Regression differ by 0.001 — a tenth of a standard deviation, which is noise. And
the cost range is a factor of 40: Random Forest fits in 4.3 s, boosting in 179.5 s, for
0.019 macro-F1. The ceiling is set by the data, not by the algorithm, which is what the
error analysis below confirms.

---

## 6. Error analysis

Out-of-fold predictions from the best Stage 6 model, so no prediction comes from a fold
that saw that respondent. Full tables: `reports/stage6_per_class_report.csv`,
`reports/stage6_confusion_matrix.csv`. Figures: `reports/figures/04_*.png`.

### The expected error pattern was wrong

EDA predicted the damage would fall *within* families — Cloud Infrastructure confused with
DevOps (cosine similarity 0.99), Data Engineer with Data Scientist (0.97). The out-of-fold
confusions say something different, and it changes the Stage 7 priorities.

| Actual role | Predicted as | Share | Same family? |
|---|---|---:|---|
| UX, Research Ops or UI design | Developer, full-stack | 0.60 | no |
| Developer, front-end | Developer, full-stack | 0.56 | no |
| Developer, AI apps or physical AI | Developer, full-stack | 0.50 | no |
| System administrator | Developer, full-stack | 0.48 | no |
| Cybersecurity or InfoSec | Developer, full-stack | 0.42 | no |
| Developer, QA or test | Developer, full-stack | 0.40 | no |
| Developer, desktop or enterprise | Developer, full-stack | 0.39 | no |
| Cloud infrastructure engineer | Developer, back-end | 0.39 | no |

**All eight largest confusions cross family boundaries, and seven of them point at
Full-stack.** These are not neighbouring roles with similar skills. Full-stack is 39% of
the training data and behaves as a **sink** that absorbs anything the model is unsure
about; Back-end, the second largest class at 20%, is the secondary sink.

So the dominant failure mode is **class imbalance, not role overlap**. The within-family
overlap is real and appears further down the matrix, but it is the second-order problem.
This is why Phase A is the first Stage 7 experiment rather than a formality.

### Per-class F1 tracks class size almost monotonically

| Job role | F1 | training examples |
|---|---:|---:|
| Developer, full-stack | 0.706 | 7,279 |
| Developer, mobile | 0.704 | 739 |
| Developer, embedded | 0.537 | 771 |
| Developer, back-end | 0.514 | 3,750 |
| Developer, front-end | 0.476 | 1,120 |
| … | | |
| Cloud infrastructure engineer | 0.069 | 238 |
| Developer, QA or test | 0.045 | 199 |
| Cybersecurity or InfoSec | 0.040 | 220 |
| **Developer, AI apps or physical AI** | **0.000** | 116 |
| **UX, Research Ops or UI design** | **0.000** | 47 |

Two roles score **exactly zero**: the model never once predicts them correctly
out-of-fold. Mobile is the instructive exception — 739 examples but F1 0.704, as high as
Full-stack's, because mobile developers use a distinctive toolset (Swift, Kotlin, Flutter)
that nothing else uses. Where the skills are distinctive, a few hundred examples is
plenty; where they overlap with Full-stack, even a thousand is not.

---

## 7. Stage 7 experiments

Each phase answers one question from the backlog in `preprocessing_decisions.md` §7.

### Phase A — imbalance handling

Three treatments on two different algorithms, so the answer is not an artefact of one.

| Treatment | What it does | Cost |
|---|---|---|
| nothing | leaves the 155:1 distribution | — |
| `class_weight="balanced"` | re-weights the loss so a rare-role error costs as much as a common one | free |
| random oversampling to 10% | duplicates real respondents until each role reaches ≥10% of Full-stack's size | ~1.4× rows |

**SMOTE rejected on principle.** It interpolates between neighbours to invent rows; 403 of
479 features are 0/1 skill flags, so a synthetic row claims a respondent "0.4 knows React".
That is not a skill profile anyone could have. Duplicating real respondents keeps every
training row valid.

**Full balancing rejected on cost.** It copies the 47 UX/UI respondents 155 times each and
grows training to 145,580 rows — over an hour per fit, and prone to overfitting the
duplicates.

**Leakage note.** The resampling lives *inside* the estimator
(`modelling.OversampledClassifier`), so it runs on each fold's training part only.
Oversampling before the split puts copies of the same respondent on both sides of the fold
and inflates the score for no real reason. `tests/test_modelling.py` checks this.

| Model | treatment | macro-F1 | accuracy |
|---|---|---:|---:|
| Logistic Regression | **none** | **0.3003** | 0.5480 |
| Logistic Regression | `class_weight="balanced"` | 0.2535 | 0.3650 |
| Logistic Regression | oversampling to 10% | 0.2914 | 0.5123 |
| Random Forest | none | 0.1869 | 0.5411 |
| Random Forest | **`class_weight="balanced_subsample"`** | **0.2548** | 0.5535 |
| Random Forest | oversampling to 10% | 0.2153 | 0.5410 |

**This result overturned a Stage 6 assumption.** Every Stage 6 model was configured with
`class_weight="balanced"` as an obvious precaution against 155:1 imbalance. Phase A shows
that for Logistic Regression it is actively **harmful**: removing it raises macro-F1 from
0.2535 to 0.3003 — a gain of 0.047, roughly fifteen fold-standard-deviations, and larger
than any hyper-parameter effect found later. The Stage 6 Logistic Regression row was
handicapping itself.

**The two algorithms want opposite treatments**, which is exactly why the experiment was
run on two models rather than one:

* **Logistic Regression is hurt by class weighting.** Re-weighting the loss forces the
  softmax to inflate rare-class probabilities across the board. It gains recall on rare
  roles but loses far more precision — accuracy collapses from 0.548 to 0.365 — and
  macro-F1, which is the harmonic mean of both, falls.
* **Random Forest is helped by it** (0.1869 → 0.2548). Without weighting, a tree's split
  criterion barely registers 47 UX/UI respondents among 7,279 Full-stack ones, and the
  rare classes are effectively invisible. Re-weighting makes them visible without the
  precision penalty, because trees partition rather than shift a global boundary.

**Partial oversampling helps Random Forest less than class weighting (0.2153 vs 0.2548)
and does not rescue Logistic Regression (0.2914 vs 0.3003 for doing nothing).** It is also
the most expensive option. It is therefore not adopted.

The general lesson, and the one to take into the viva: *imbalance handling is a property of
the algorithm–data pair, not a universal good.* Applying `class_weight="balanced"`
reflexively — as Stage 6 did — cost this project 0.047 macro-F1 on its eventual winner.

### Phase B — feature set and feature selection

Each row changes exactly one Stage 4 decision and holds everything else fixed.

| Experiment | Question |
|---|---|
| want lists removed | Are the 223 "want to learn" columns worth their place, or a noisy copy of what people already use? |
| rare pooling 0.25% / 1% | Was the 0.5% threshold right? |
| SelectKBest chi² k ∈ {100, 200, 300, all} | Do fewer features do as well? |
| core+context (506) | Do job-context answers help? |

**Selection sits inside the pipeline.** The k best features are chosen from each fold's
training part. Selecting once on the full training set is the most common leak in a project
like this: features are chosen using the very labels the validation fold is meant to test.

**chi² needs non-negative inputs**, so this branch builds the preprocessor unscaled and puts
a `StandardScaler` back *after* selection.

**`core+context` is not adopted even if it scores higher.** The app's main users are
students with no current employer, so OrgSize, Industry, RemoteWork and ICorPM would be
blank in production. A model that needs inputs the user cannot give is worse in practice
than a slightly weaker model that works — the train/serve mismatch flagged as risk 21 in
Stage 4.

3-fold, Logistic Regression, every row against the same reference on the same folds.

| Experiment | macro-F1 | Δ vs core | top-3 |
|---|---:|---:|---:|
| core+context (506 features) | 0.2605 | **+0.0064** | 0.7413 |
| rare pooling 1% | 0.2547 | +0.0006 | 0.7299 |
| **core (reference)** | **0.2541** | — | 0.7301 |
| rare pooling 0.25% | 0.2528 | −0.0013 | 0.7296 |
| want lists removed | 0.2451 | −0.0090 | 0.7008 |
| SelectKBest chi² k=300 | 0.2353 | −0.0188 | 0.7102 |
| SelectKBest chi² k=200 | 0.2315 | −0.0226 | 0.6868 |
| SelectKBest chi² k=all | 0.2290 | −0.0251 | 0.7353 |
| SelectKBest chi² k=100 | 0.2277 | −0.0264 | 0.6489 |

**The want lists earn their place.** Removing the 223 "technologies I want to learn"
columns costs 0.009 macro-F1 and 0.029 top-3. Stage 4 kept them on the evidence that they
correlate with the have-lists but do not duplicate them (phi 0.18–0.76); this confirms
they carry independent signal. Stage 4 decision upheld.

**The 0.5% rare-pooling threshold is at a flat optimum.** Moving to 0.25% or 1% changes
macro-F1 by 0.0013 and 0.0006 — far below the fold noise. The threshold is not critical,
which is a useful thing to know and report rather than a failed experiment.

**Feature selection does not help, and the `k=all` row explains why.** Note that `k=all`
performs *no selection at all* and still scores 0.0251 below the reference. The two
pipelines then differ in exactly one respect: `select_kbest_pipeline` builds the
preprocessor unscaled (chi² requires non-negative inputs) and applies a `StandardScaler`
to **all** 479 features afterwards, whereas the Stage 4 preprocessor deliberately leaves
the 403 binary technology columns as 0/1 and scales only the experience and ordinal
branches.

So the `k=all` row is an accidental but clean controlled experiment, and it says
**scaling the binary technology columns costs about 0.025 macro-F1.** That is direct
evidence for Stage 4 decision 14, which had been argued on interpretability grounds alone.
Against that baseline the selection itself is roughly flat (k=300 at 0.2353 is slightly
*above* k=all at 0.2290), so the honest conclusion is: selection neither helps nor hurts
much, and the apparent damage in this block comes from the scaling, not the selection.

**`core+context` scores highest and is still rejected.** The +0.0064 gain is itself inside
the fold noise, but even a real gain would not change the decision: SkillPath's main users
are students with no current employer, so OrgSize, Industry, RemoteWork and ICorPM would be
blank in production. A model that depends on inputs the user cannot supply is worse in
practice than a slightly weaker model that always works. This is the train/serve mismatch
flagged as risk 21 in Stage 4, and it is a product decision overriding a metric.

### Phase C — hyper-parameter search

**Randomised search, not grid search.** A grid over five hyper-parameters with four values
each is 1,024 fits per model; at 6–25 s a fit that is days of compute. Random search over
the same ranges finds a near-best setting in a few dozen fits, because typically only two
or three parameters matter and random sampling tries many distinct values of each instead
of a few repeated ones.

The search optimises macro-F1 with the same `StratifiedKFold`. Boosting is searched over 3
folds purely for cost, and its winner is then **re-scored over the standard 5 folds** so
every number in the final table is comparable.

| Model | budget | best hyper-parameters | tuned macro-F1 | tuned top-3 |
|---|---|---|---:|---:|
| Logistic Regression | 6 × 3 folds | `C=0.218`, `class_weight=None` | **0.3030** | 0.8387 |
| Hist Gradient Boosting | 5 × 3 folds | `lr=0.2`, `max_leaf_nodes=15`, `max_iter=200`, `min_samples_leaf=50`, `l2=1.0` | 0.2860 | 0.8309 |
| Random Forest | 16 × 5 folds | `n_estimators=300`, `min_samples_leaf=4`, `max_features=0.1`, `max_depth=40`, `class_weight="balanced"` | 0.2820 | 0.8131 |
| Linear SVM (calibrated) | 6 × 5 folds | `C=0.00355`, `class_weight="balanced"` | 0.2536 | 0.8401 |

**The search confirmed Phase A independently.** Logistic Regression's winning setting is
`class_weight=None` — the search was free to choose `"balanced"` and rejected it. Two
different experiments, run differently, reaching the same conclusion is much stronger
evidence than either alone.

**Regularisation matters more than anything else for the linear models.** Logistic
Regression moved from the default `C=1.0` to `C=0.218`, and Linear SVM all the way to
`C=0.00355` — both substantially *stronger* regularisation than the default. With 479
features and only 47 examples in the smallest class, the untuned models were overfitting;
Linear SVM gained 0.0625 macro-F1, the largest tuning gain in the project, almost entirely
from this.

**Boosting's winner is its *smallest* configuration** (`max_leaf_nodes=15`, the minimum
offered). The same conclusion from the other direction: on this data the useful signal is
mostly additive and simple, and model capacity is not the binding constraint.

### Phase D — tuned vs baseline, and the final model

| Model | baseline | tuned | gain | SD | tuned top-3 | family F1 | fit (s) |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Logistic Regression** | 0.2547 | **0.3030** | +0.0483 | 0.0082 | 0.8387 | **0.4294** | **3.3** |
| Hist Gradient Boosting | 0.2724 | 0.2860 | +0.0135 | 0.0096 | 0.8309 | 0.4030 | 12.9 |
| Random Forest | 0.2537 | 0.2820 | +0.0283 | 0.0081 | 0.8131 | 0.3585 | 4.2 |
| Linear SVM (calibrated) | 0.1911 | 0.2536 | +0.0625 | 0.0090 | **0.8401** | 0.3842 | 4.3 |

**Tuning changed the ranking.** Hist Gradient Boosting led Stage 6 on macro-F1 (0.2724);
after optimisation Logistic Regression leads (0.3030) and boosting is second (0.2860).
Running Stage 7 on the Stage 6 winner alone would have locked in the wrong model — the
reason Phase C tunes all four rather than just the leader.

Note also that the tuned Logistic Regression fits in **3.3 s**, down from 91.7 s, because
dropping `class_weight="balanced"` makes lbfgs converge quickly. It became both the most
accurate and the cheapest model at the same time.

---

## 8. Final model selection

The rule was written down **before** the numbers were read, so it could not be bent to fit
a favourite:

> Highest 5-fold macro-F1 on the training split. Models **within one standard deviation**
> of the best are treated as tied, and among those the cheapest to fit wins.

The tie-break exists because of what Stage 6 found: the gap between the strong models is
about the size of the fold-to-fold noise. Calling the top model "better" when it sits inside
the noise band would be reading randomness as signal. When two models are statistically
indistinguishable, the one that retrains in seconds and loads quickly in the backend is the
better engineering choice — and that reasoning, not a third decimal place, is the
justification.

### The decision

**Final model: Logistic Regression**, `C=0.218`, `class_weight=None`, `max_iter=400`,
`tol=1e-3`, on the 479-feature core set, inside the Stage 4 preprocessing pipeline.

In this case the rule did not even need its tie-break. Logistic Regression is the only
model within one standard deviation (0.0082) of the best score, because the next model is
0.017 behind — about twice the SD. It wins outright on macro-F1, and it also happens to be
the cheapest to fit (3.3 s) and the best at family level (0.4294).

| Criterion | Winner | Note |
|---|---|---|
| macro-F1 (primary) | Logistic Regression 0.3030 | only model within 1 SD of the best |
| family macro-F1 | Logistic Regression 0.4294 | the career-path recommendation |
| top-3 accuracy | Linear SVM 0.8401 | Logistic Regression 0.8387 — a 0.0014 difference, noise |
| fit cost | Logistic Regression 3.3 s | 4× faster than boosting |
| interpretability | Logistic Regression | coefficients read as "which skill pushes which role" |

Three supporting reasons beyond the primary metric:

1. **It is the most interpretable option.** Stage 12 requires explaining the system to
   non-technical stakeholders. A coefficient per technology per role answers "why did it
   suggest this?" directly; a 4,000-tree boosted ensemble does not.
2. **Its probabilities are among the best calibrated** (log loss 1.4146, the lowest of the
   tuned models). The app prints probabilities as numbers next to each role, so their
   quality is user-facing, not just a metric.
3. **It is 4× cheaper to fit and small to deploy** (108 KB `model.joblib`), which matters
   for Stage 9's backend.

Had the top two been genuinely tied, the written rule would have chosen Logistic
Regression anyway on fit cost. The rule was fixed before the numbers were read.

---

## 9. The single test evaluation

`scripts/finalise_model.py` refits the chosen configuration on all 18,457 training rows and
scores it on the 4,615 held-out respondents — **once**. It is the only script that opens
`test.parquet`.

A small gap between the cross-validated estimate and the test score is the thing to look
for: it means the validation procedure was honest and the model generalises.

The script also runs an **API parity check** — real training rows are converted into the
JSON profile the web form will send, converted back through `profile_to_frame()`, and the
predictions compared. Identical predictions prove the Stage 9 backend preprocesses exactly
like the model validated here.

| Metric | cross-validated (train) | held-out test | gap |
|---|---:|---:|---:|
| **macro-F1** | 0.3030 | **0.2845** | −0.0185 |
| balanced accuracy | 0.2826 | 0.2657 | −0.0169 |
| accuracy | — | 0.5493 | |
| **top-3 accuracy** | 0.8387 | **0.8392** | +0.0005 |
| log loss | 1.4146 | 1.4146 | 0.0000 |
| family macro-F1 | 0.4294 | 0.4149 | −0.0145 |
| family accuracy | — | 0.5757 | |
| **family top-3 accuracy** | 0.8733 | **0.8778** | +0.0045 |

4,615 held-out respondents. Source: `reports/stage7_test_results.json`.

**The gap is −0.0185 on macro-F1, about two fold-standard-deviations.** Small and in the
expected direction: the cross-validated figure is chosen as the maximum over a search, so
a little optimism is normal and is exactly what the held-out split exists to measure. The
top-3 metrics actually came out *marginally higher* on test than in CV, and log loss is
identical to four decimals. There is no sign of a leak inflating the validation numbers.

**The user-facing numbers are the strong ones.** Top-1 macro-F1 of 0.28 sounds weak in
isolation, but the product does not show one role:

* **83.9%** of the time the correct job role is in the three the app displays.
* **87.8%** of the time the correct career family is in the top three.

**Rare roles remain weak on test, and two score zero.** `Developer, AI apps or physical AI`
(29 test examples) and `UX, Research Ops or UI design` (12 test examples) get F1 0.000 —
the model never predicts them. This is reported in `artifacts/model_card.json` as a known
limitation rather than hidden in an average.

**API parity: max probability difference 0.00e+00 across 300 profiles.** Not merely small —
exactly zero. Real training rows converted into the web form's JSON format and back through
`profile_to_frame()` produce bit-identical predictions, so the Stage 9 backend will
preprocess exactly like the model validated here.

Outputs: `artifacts/model.joblib`, `artifacts/model_card.json`,
`reports/stage7_test_results.json`, `reports/stage7_test_per_class.csv`.

---

## 10. Honest limitations

1. **Macro-F1 is modest in absolute terms (0.28 on test).** The reason is structural, not a
   modelling failure. Two causes, in order of size: Full-stack is 39% of the data and acts
   as a sink for uncertain predictions, and several roles genuinely overlap in the survey's
   technology questions. The product is designed around this — three ranked roles and a
   family total, where the numbers are 0.839 and 0.878.
2. **Two roles are never predicted at all.** `Developer, AI apps or physical AI` (116
   training, 29 test) and `UX, Research Ops or UI design` (47 training, 12 test) score F1
   0.000 on the held-out split. Imbalance handling improves recall elsewhere but cannot
   manufacture information that is not in 47 examples. The app should either not offer
   these as possible outputs or label them explicitly as low-confidence.
3. **Survey population, not the developer population.** Stack Overflow respondents skew
   towards particular regions, languages and seniority levels.
4. **Self-reported labels.** `DevType` is what respondents chose to call themselves; two
   people doing identical work may label it differently.
5. **Not a hiring tool.** A low probability means a profile is unlike that role's survey
   respondents — not that a person cannot do the job. Recorded in `artifacts/model_card.json`.

---

## 11. Likely viva questions and short answers

**Why did you choose these six algorithms?** They span different inductive biases —
independence assumption (NB), local similarity (k-NN), linear boundaries (LogReg, SVM),
and non-linear feature interactions (Random Forest, boosting) — so the comparison tells us
something about the *problem*, not just about one family of models. And every one of them
can produce probabilities, which the three-role recommendation requires.

**Why is accuracy not your main metric?** The majority class is 39% of the data. A model
that always answers "Full-stack" scores 0.39 accuracy and ~0.03 macro-F1. Macro-F1 weights
all 20 roles equally, which matches the product: the value is in recognising the rare roles.

**Why 5-fold and not 10-fold?** The smallest role has 47 training examples. At 5 folds each
fold still holds ~9 of them; at 10 folds it would be ~4, too few to estimate a per-class F1.

**Why is the preprocessor inside the pipeline?** So every fold refits the vocabulary,
imputation medians and scaler on its own training part. Fitting it once on all training data
would let each validation fold influence the features it is then judged on, and every CV
score would be optimistic.

**How do you know you have no leakage?** Four layers: deterministic cleaning before the
split; the split frozen by `ResponseId`; everything learned fitted inside the pipeline so CV
refits it per fold; and resampling and feature selection placed inside the estimator for the
same reason. `tests/test_preprocessing.py` and `tests/test_modelling.py` check these.

**Why randomised search rather than grid search?** A five-parameter grid with four values
each is 1,024 fits per model — days of compute here. Random search finds a near-best setting
in a few dozen fits, because only two or three parameters usually matter.

**Why did you reject SMOTE?** 403 of the 479 features are binary skill flags. Interpolating
between two respondents produces someone who "0.4 knows React", which is not a valid profile.
Duplicating real respondents keeps every row something a real person reported.

**Why did you not use the full-balancing oversampler?** It would copy the 47 UX/UI
respondents 155 times and grow training to 145,580 rows — over an hour per fit, and it tends
to overfit the duplicates. Partial oversampling gets most of the benefit at a fraction of
the cost, and the table reports the trade-off.

**What was the single biggest improvement in Stage 7?** Removing `class_weight="balanced"`
from Logistic Regression: +0.047 macro-F1, about fifteen fold-standard-deviations, and
larger than every hyper-parameter effect we found. Stage 6 had applied class weighting
reflexively because the data is imbalanced 155:1. Phase A showed it was handicapping the
model that eventually won.

**Why does class weighting hurt Logistic Regression but help Random Forest?** They respond
differently because they fit differently. Re-weighting the loss makes the softmax inflate
rare-class probabilities globally; recall on rare roles rises but precision falls further,
and accuracy drops from 0.548 to 0.365, so macro-F1 falls. A forest partitions instead of
shifting one global boundary: without weighting, 47 UX/UI respondents barely register in a
split criterion against 7,279 Full-stack ones, so weighting makes them visible without the
same precision cost. The lesson is that imbalance handling is a property of the
algorithm–data pair, not a universal good.

**Did tuning change which model you shipped?** Yes. Hist Gradient Boosting led Stage 6
(0.2724); after tuning Logistic Regression leads (0.3030) and boosting is second (0.2860).
That is precisely why Phase C tunes all four candidates instead of only the Stage 6 winner
— tuning the leader alone would have locked in the wrong model.

**Your tuning gains — are they real or noise?** Mixed, and we say which is which. Logistic
Regression +0.048 and Linear SVM +0.063 are many times the fold SD (~0.008) and are real.
Hist Gradient Boosting's +0.014 is under two SDs and we do not claim it as a solid
improvement. The dominant effect in both large gains was **stronger regularisation**
(`C` 1.0 → 0.218 and 1.0 → 0.00355), which makes sense with 479 features and 47 examples in
the smallest class.

**Why is the final model the one with the highest macro-F1 — didn't you say ties matter?**
The tie-break rule was written in advance in case it was needed, and here it was not:
Logistic Regression is the only model within one standard deviation (0.0082) of the best,
because second place is 0.017 behind — roughly two SDs. It wins outright, and it also
happens to be the cheapest, best-calibrated and most interpretable option.

**Why not ship the boosting model, which won Stage 6?** After tuning it is 0.017 macro-F1
*behind* Logistic Regression, four times slower to fit, worse at family level (0.403 vs
0.429), and far harder to explain to the non-technical audience in Stage 12. It lost on
the primary metric, so the other reasons never had to be invoked.

**How do the family-level numbers come from the same model?** Each job role belongs to
exactly one family, so a family's probability is the sum of its job roles' probabilities
(`skillpath.targets.family_proba`). The family probabilities still sum to 1, which
`tests/test_modelling.py` checks. One model, both levels of recommendation.

**Why is top-3 accuracy so much higher than top-1?** 0.839 against 0.549 on test. Because
several roles genuinely overlap, and because Full-stack absorbs uncertain top-1 guesses.
The right role is usually still in the top three — which is exactly the behaviour the
three-role interface was designed around, and the reason top-3 is reported as a headline
number rather than a footnote.

**Your best model only gets 28% macro-F1. Is this system actually useful?** Top-1 macro-F1
is the wrong number to judge the product by, because the product never shows one answer.
It shows three roles and a career family: the correct role is in that list 83.9% of the
time, and the correct family 87.8%. For a guidance tool that is useful. We report macro-F1
as the primary *model-selection* metric because it is the one that penalises ignoring rare
roles, not because it is the user-facing claim.

**What surprised you most?** That the error analysis contradicted the EDA prediction. We
expected confusions inside families (Cloud Infrastructure ↔ DevOps, cosine 0.99). Instead
all eight largest confusions cross family boundaries and point at Full-stack. The problem
was imbalance first, overlap second — which reordered the Stage 7 priorities.

**Is there anything in your results you cannot fully explain?** The `SelectKBest k=all` row
scores 0.025 below the reference despite selecting nothing. We traced it: that pipeline
scales all 479 features, whereas the Stage 4 preprocessor deliberately leaves the 403
binary technology columns as 0/1. So it is an accidental controlled experiment showing that
scaling binary columns costs ~0.025 macro-F1 — supporting evidence for a Stage 4 decision
that had been argued on interpretability grounds alone.

**What would you do with more time?** Group the near-identical roles into a hierarchy and
predict family first, then role within family; try a linear model with L1 to get a sparse,
explainable skill set per role; and collect more respondents for the rare roles rather than
trying to squeeze them out of the existing 47.
