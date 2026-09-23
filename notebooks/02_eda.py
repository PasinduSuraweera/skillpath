# ---
# jupyter:
#   jupytext:
#     text_representation:
#       extension: .py
#       format_name: percent
#   kernelspec:
#     display_name: Python 3
#     language: python
#     name: python3
# ---

# %% [markdown]
# # 02 · Exploratory data analysis
#
# **SkillPath** (IT3051 Fundamentals of Data Mining, group KND_12)
#
# Stage 3, part 2. Every analysis that relates features to the target uses the
# **training split only** (18,457 of 23,072 respondents). The 4,615 test respondents
# were set aside right after the deterministic cleaning and are not looked at here,
# so nothing we learn in EDA can leak into the final evaluation.
#
# Contents
# 1. Target: job roles and role families (class imbalance)
# 2. Technology features: support, breadth, role signatures (lift), have vs want
# 3. Missing values in the technology blocks: true zero vs unknown
# 4. Experience: distributions, outliers, impossible values, blank = 0
# 5. Education, region and AI usage by role
# 6. AI task matrix, AI Exposure Index and perceived AI threat
# 7. Salary: skew, implausible values, peer-group sizes
# 8. Leakage screen and redundancy checks
# 9. Findings that drive preprocessing

# %%
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib as mpl
from scipy.stats import chi2_contingency

from skillpath import config as C
from skillpath import viz
from skillpath.data import load_raw
from skillpath.features import parse_tokens

viz.setup()
pd.set_option("display.max_colwidth", 80)

train = pd.read_parquet(C.PROCESSED_DIR / "train.parquet")
raw = load_raw()
raw_tr = raw.set_index(C.ID_COL).loc[train[C.ID_COL]]  # raw (uncleaned) values of the same people
FAM, JOB = C.TARGET_FAMILY, C.TARGET_JOB
fam_order = train[FAM].value_counts().index.tolist()
print(f"training respondents: {len(train):,}")

DIVERGING = mpl.colors.LinearSegmentedColormap.from_list("bl_rd", [viz.BLUE, "#f0efec", "#e34948"])

# %% [markdown]
# ## 1. Target: job roles and role families
#
# **Target decision.** The model predicts the respondent's **specific job role**
# (`JobRole`, from `DevType`, 20 skill-defined values). Each job role belongs to one
# of 12 **role families**, and a family's probability is the sum of its job roles'
# probabilities (`skillpath.targets.family_proba`). One model therefore gives both
# the top-3 job roles and the top families, as promised in the proposal title and
# Section 5, and both levels are evaluated.

# %%
job_counts = train[JOB].value_counts()
fig, axes = plt.subplots(1, 2, figsize=(13, 5.2), gridspec_kw={"width_ratios": [1.25, 1]})
viz.barh(axes[0], [C.JOB_ROLE_LABEL[j] for j in job_counts.index], job_counts.values)
axes[0].set(title="Job role (target), training split", xlabel="respondents")
fam_counts = train[FAM].value_counts()
viz.barh(axes[1], fam_counts.index.tolist(), fam_counts.values)
axes[1].set(title="Role family", xlabel="respondents")
plt.tight_layout()
viz.save(fig, "02_target_distribution")
plt.show()

imb = pd.DataFrame({
    "classes": [train[JOB].nunique(), train[FAM].nunique()],
    "largest": [job_counts.iloc[0], fam_counts.iloc[0]],
    "smallest": [job_counts.iloc[-1], fam_counts.iloc[-1]],
    "imbalance ratio": [round(job_counts.iloc[0] / job_counts.iloc[-1], 1),
                        round(fam_counts.iloc[0] / fam_counts.iloc[-1], 1)],
    "majority share": [f"{job_counts.iloc[0] / len(train):.1%}", f"{fam_counts.iloc[0] / len(train):.1%}"],
}, index=["JobRole", "RoleFamily"])
imb

# %% [markdown]
# **Observations**
# * The target is heavily imbalanced: Full-stack is 39% of respondents and the
#   smallest job role (UX / UI Designer) has only 47 training examples, an
#   imbalance ratio of about 155:1.
# * A model that always predicts Full-stack would reach 39% accuracy while being
#   useless, so **accuracy cannot be the main metric**; macro-F1, balanced accuracy
#   and top-3 accuracy are used (proposal Section 5).
# * Imbalance also means **the train/test split must be stratified** on the job role
#   (done) and imbalance handling (class weights or resampling inside the CV folds)
#   has to be compared in Stage 6-7.
# * Stratifying on the job role (the finer label) keeps the family proportions equal
#   as well, so one split serves both levels.
# * Five job roles have fewer than 150 training examples (UX / UI Designer, Database
#   Administrator, AI Application Developer, Applied Scientist, Data / Business
#   Analyst). Their per-class scores will be noisy, which is one more reason to
#   report top-3 accuracy and family-level metrics next to per-role F1.

# %% [markdown]
# ## 2. Technology features

# %% [markdown]
# ### 2.1 How often each technology is chosen (support)

# %%
rows = []
for block, (have, want, gate) in C.TECH_BLOCKS.items():
    for kind, col in (("have", have), ("want", want)):
        s = train[col].map(parse_tokens).explode().dropna()
        vc = s.value_counts()
        rows.append({"block": block, "list": kind, "options": len(vc),
                     "median support %": round(vc.median() / len(train) * 100, 1),
                     "least chosen": vc.index[-1], "least chosen n": int(vc.iloc[-1]),
                     "options below 0.5%": int((vc < C.MIN_TOKEN_FREQUENCY * len(train)).sum())})
support = pd.DataFrame(rows)
support

# %% [markdown]
# Almost every technology is picked by enough people to estimate its effect. Only a
# handful fall below 0.5% of training respondents (about 92 people). **Decision:**
# technologies below 0.5% support are pooled into a per-block `OTHER` column
# instead of getting their own column. This keeps rare options from producing
# unreliable single-feature effects, and the same `OTHER` column absorbs any new
# technology a web user types that was never seen in training.

# %%
lang = train["LanguageHaveWorkedWith"].map(parse_tokens).explode().value_counts()
fig, ax = plt.subplots(figsize=(9, 6.5))
viz.barh(ax, lang.index.tolist(), (lang / len(train) * 100).round(1).tolist(), fmt="{:.1f}%")
ax.axvline(C.MIN_TOKEN_FREQUENCY * 100, color=viz.ORANGE, lw=1)
ax.set(title="Programming languages used (training split)", xlabel="% of respondents")
viz.save(fig, "02_language_support")
plt.show()

# %% [markdown]
# ### 2.2 Breadth: how many technologies people tick

# %%
breadth = pd.DataFrame({
    block: train[have].map(parse_tokens).map(len) for block, (have, _, _) in C.TECH_BLOCKS.items()
})
desc = breadth.describe(percentiles=[0.5, 0.9, 0.99]).T[["mean", "50%", "90%", "99%", "max"]].round(1)
desc["skew"] = breadth.skew().round(2)
desc

# %%
fig, axes = plt.subplots(1, 2, figsize=(11, 3.2))
tot = breadth.sum(axis=1)
axes[0].hist(tot, bins=range(0, tot.max() + 2), color=viz.BLUE)
axes[0].set(title="Technologies used (all blocks)", xlabel="count (axis cut at 100)", ylabel="respondents",
            xlim=(0, 100))
axes[1].hist(np.log1p(tot), bins=40, color=viz.BLUE)
axes[1].set(title="After log1p", xlabel="log1p(count)")
for a in axes:
    a.grid(axis="y")
plt.tight_layout()
viz.save(fig, "02_breadth")
plt.show()
print(f"skew before: {tot.skew():.2f}   after log1p: {np.log1p(tot).skew():.2f}")
print(f"max technologies ticked by one person: {tot.max()}  (people above 100: {(tot > 100).sum()})")

# %% [markdown]
# Counts are right-skewed with a long tail (after removing straight-liners, a few
# people still tick more than 100 options across all lists). The log transform
# limits their influence without deleting them. The
# breadth features are therefore **log1p-transformed**, which also puts them on a
# scale close to the 0/1 technology columns.

# %% [markdown]
# ### 2.3 Role signatures: which technologies are characteristic of each family (lift)
#
# Lift = P(technology | family) / P(technology). Lift 2 means the technology is twice
# as common in that family as overall. This is the association analysis that later
# powers the "skills that match" and "skill gap" explanations, and it shows the
# features carry real signal for the target.

# %%
H = pd.concat([
    train[have].map(parse_tokens).explode().pipe(lambda s: pd.crosstab(s.index, s)).add_prefix(f"{b}: ")
    for b, (have, _, _) in C.TECH_BLOCKS.items() if b in ("Language", "Database", "Platform", "Webframe", "DevEnvs")
], axis=1).reindex(train.index, fill_value=0).clip(upper=1)
p_tech = H.mean()
p_tech_fam = H.groupby(train[FAM]).mean()
lift = p_tech_fam / p_tech
eligible = p_tech_fam >= 0.10  # used by at least 10% of the family
top = set()
for f in lift.index:
    top |= set(lift.loc[f][eligible.loc[f]].sort_values(ascending=False).head(3).index)
top = sorted(top, key=lambda t: lift[t].idxmax())
L = np.log2(lift.loc[fam_order, top])
fig, ax = plt.subplots(figsize=(13, 5.2))
im = ax.imshow(L.values, cmap=DIVERGING, vmin=-3, vmax=3, aspect="auto")
ax.set_xticks(range(len(top)), [t.split(": ")[1] for t in top], rotation=60, ha="right", fontsize=8)
ax.set_yticks(range(len(fam_order)), fam_order)
ax.grid(False)
for i in range(L.shape[0]):
    for j in range(L.shape[1]):
        v = lift.loc[fam_order[i], top[j]]
        if v >= 2:
            ax.text(j, i, f"{v:.1f}", ha="center", va="center", fontsize=7, color="white" if v > 5 else viz.TEXT)
cb = fig.colorbar(im, ax=ax, fraction=0.02)
cb.set_ticks([-3, -2, -1, 0, 1, 2, 3], labels=["1/8", "1/4", "1/2", "1", "2", "4", "8"])
cb.set_label("lift (log scale)")
ax.set_title("Technology lift by role family (top 3 per family, training split; labels show lift >= 2)")
viz.save(fig, "02_lift_heatmap")
plt.show()

# %%
sig = {}
for f in fam_order:
    s = lift.loc[f][eligible.loc[f]].sort_values(ascending=False).head(5)
    sig[f] = ", ".join(f"{t.split(': ')[1]} ({v:.1f})" for t, v in s.items())
pd.Series(sig, name="top-5 technologies by lift (lift)").to_frame()

# %% [markdown]
# Most families have a clear technology signature: Swift, Xcode and Kotlin for
# Mobile (lift 5 to 10), R and Jupyter for Data Sci/ML, Ansible, Prometheus and
# Terraform for DevOps/Cloud, Assembly and C for Embedded, Databricks and Snowflake
# for Data Eng, GDScript and C++ for Game/Graphics. Full-stack, Backend and QA/Test
# have the weakest signatures (top lift below 3) because they use the most common
# technologies, which predicts they will be the hardest classes to separate.

# %% [markdown]
# ### 2.4 Job roles inside the same family
#
# Four families contain more than one job role. Predicting the specific role only
# makes sense if roles in the same family use different technologies. Within-family
# lift = P(technology | job role) / P(technology | family): it shows what separates,
# for example, a Data Scientist from an AI/ML Engineer.

# %%
H_job = H.groupby(train[JOB]).mean()
multi_fams = [f for f in fam_order if sum(v == f for v in C.ROLE_FAMILY.values()) > 1]
rows = []
for f in multi_fams:
    p_f = p_tech_fam.loc[f]
    for job in [j for j, g in C.ROLE_FAMILY.items() if g == f]:
        p_j = H_job.loc[job]
        within = (p_j / p_f.replace(0, np.nan))[(p_j >= 0.10)].sort_values(ascending=False).head(4)
        rows.append({"family": f, "job role": C.JOB_ROLE_LABEL[job], "n (train)": int((train[JOB] == job).sum()),
                     "most distinctive within the family (within-family lift)":
                         ", ".join(f"{t.split(': ')[1]} ({v:.1f})" for t, v in within.items())})
pd.DataFrame(rows)

# %%
# Similarity of the 20 job-role technology profiles (cosine of prevalence vectors)
# order roles by family so sibling roles sit next to each other
job_order = sorted(job_counts.index, key=lambda j: (fam_order.index(C.ROLE_FAMILY[j]), -job_counts[j]))
prof = H_job.loc[job_order]
unit = prof.div(np.sqrt((prof ** 2).sum(axis=1)), axis=0)
sim = unit @ unit.T
labels = [C.JOB_ROLE_LABEL[j] for j in sim.index]
fig, ax = plt.subplots(figsize=(10.5, 8.5))
im = ax.imshow(sim.values, cmap=viz.seq_cmap(), vmin=0.65, vmax=1, aspect="auto")
ax.set_xticks(range(len(labels)), labels, rotation=60, ha="right", fontsize=8)
ax.set_yticks(range(len(labels)), labels, fontsize=8)
ax.grid(False)
fig.colorbar(im, ax=ax, fraction=0.03, label="cosine similarity of technology profiles")
ax.set_title("How similar are the job roles' technology profiles? (training split, grouped by family)")
viz.save(fig, "02_jobrole_similarity")
plt.show()

s_ = sim.where(~np.eye(len(sim), dtype=bool)).stack()
pairs_ = s_[[a < b for a, b in s_.index]].sort_values(ascending=False)
print("most similar job-role pairs:")
print(pairs_.head(8).rename(index=C.JOB_ROLE_LABEL).round(3).to_string())
print("\nleast similar pairs:")
print(pairs_.tail(4).rename(index=C.JOB_ROLE_LABEL).round(3).to_string())

# %% [markdown]
# * Roles inside a family do differ. In Data Sci/ML, Data Scientists lean on R and
#   Databricks, AI/ML Engineers on Terraform, Redis and Cursor, Applied Scientists on
#   Fortran and MATLAB, AI Application Developers on Firebase, and Data / Business
#   Analysts on VBA and Microsoft Access. System Administrators (Access, VBA,
#   WordPress) differ from Cloud Infrastructure Engineers (BigQuery, DynamoDB).
# * Front-end Developer shows lift of about 1 because it makes up almost the whole
#   Frontend family. The UX / UI Designer lifts are based on only 47 people, so
#   values such as MicroPython 12.4 are small-sample noise, not a real signature.
# * Some roles are very close: Cloud Infrastructure Engineer vs DevOps Engineer
#   (0.99), Data Engineer vs Data Scientist (0.97), DevOps vs Back-end (0.96). The
#   least similar are Embedded vs Front-end or Mobile (about 0.67). The model will
#   often confuse the close pairs. This is expected
#   and is exactly why SkillPath shows the **top 3** job roles with probabilities and
#   also the family total, instead of one hard answer.
# * Predicting job roles and summing to families loses little compared with a
#   family-only target, while giving users the specific role names they asked for.
#   Both levels will be compared in Stage 6-7.

# %% [markdown]
# ### 2.5 "Have" versus "want" lists
#
# Is the want list just a copy of the have list? If so it would be redundant.

# %%
phis = []
for b, (have, want, _) in C.TECH_BLOCKS.items():
    hv = train[have].map(parse_tokens)
    wv = train[want].map(parse_tokens)
    for t in sorted(set().union(*hv) & set().union(*wv)):
        h = hv.map(lambda s: t in s).astype(int)
        w = wv.map(lambda s: t in s).astype(int)
        if h.sum() >= 50 and w.sum() >= 50:
            phis.append({"block": b, "technology": t, "phi": np.corrcoef(h, w)[0, 1]})
phis = pd.DataFrame(phis)
print(phis["phi"].describe().round(3).to_string())
print(f"\npairs with phi > 0.8: {(phis.phi > 0.8).sum()}  (max {phis.phi.max():.2f})")

new_want = pd.Series(dtype=float)
for b, (have, want, _) in C.TECH_BLOCKS.items():
    diff = [w - h for h, w in zip(train[have].map(parse_tokens), train[want].map(parse_tokens))]
    new_want = pd.concat([new_want, pd.Series([t for s in diff for t in s]).value_counts()])
print("\nmost wanted technologies that people do NOT use yet:")
print((new_want.sort_values(ascending=False).head(10) / len(train) * 100).round(1).astype(str).add("%").to_string())

# %% [markdown]
# Have and want are related (median phi about 0.5) but never close to duplicates
# (all below 0.8), so both lists are kept. The want list adds a different signal:
# what people are moving towards (for example Rust, Go and Kubernetes are wanted by many
# who do not use them yet). An engineered feature, `want_new_count` (number of
# wanted technologies not already used), captures this learning direction.

# %% [markdown]
# ## 3. Missing values in the technology blocks
#
# This repeats the key finding from notebook 01, now on the training cohort: most empty
# technology lists are **true zeros** (the respondent answered "No" to the gate
# question), and only a minority are unknown.

# %%
rows = []
for b, (have, want, gate) in C.TECH_BLOCKS.items():
    used = train[have].notna()
    said_no = (train[gate] == "No") if gate else pd.Series(False, index=train.index)
    rows.append({"block": b, "uses (list given)": used.mean(), "said none (true zero)": (~used & said_no).mean(),
                 "unknown": (~used & ~said_no).mean()})
state = pd.DataFrame(rows).set_index("block")
fig, ax = plt.subplots(figsize=(9, 3.4))
left = np.zeros(len(state))
for col, colr in zip(state.columns, [viz.BLUE, "#9ec5f4", viz.ORANGE]):
    ax.barh(state.index, state[col] * 100, left=left, color=colr, label=col, height=0.7,
            edgecolor="white", linewidth=1)
    left += state[col].values * 100
ax.invert_yaxis()
ax.set(title="Technology blocks: used / true zero / unknown (training split)", xlabel="% of respondents")
ax.legend(ncol=3, loc="lower center", bbox_to_anchor=(0.5, -0.36))
ax.grid(axis="y", visible=False)
viz.save(fig, "02_block_state")
plt.show()
(state * 100).round(1)

# %% [markdown]
# **Decision (missing values, technology):** encode every block with 0/1 columns and
# add a `<block>_unknown` indicator that is 1 only when the list is empty *and* the
# person did not say "No". A "No" stays all zeros with unknown = 0. We do **not**
# impute technologies (we cannot guess what someone uses), and we do **not** drop
# these rows (that would remove 10-45% of the cohort and bias it towards people who
# finished the survey). SOTags has no gate question, so an empty SOTags list is
# always unknown. The web form mirrors this with an explicit "I don't use any" option.

# %% [markdown]
# ## 4. Experience

# %%
exp_raw = raw_tr[["YearsCode", "WorkExp", "Age"]].copy()
print("raw values, training split:")
print(exp_raw[["YearsCode", "WorkExp"]].describe(percentiles=[0.25, 0.5, 0.75, 0.99]).round(1).T.to_string())
print("\nskew:", exp_raw[["YearsCode", "WorkExp"]].skew().round(2).to_dict())

# %%
fig, axes = plt.subplots(1, 3, figsize=(13, 3.3))
for ax, col in zip(axes[:2], ["YearsCode", "WorkExp"]):
    ax.hist(exp_raw[col].dropna(), bins=range(0, 102, 2), color=viz.BLUE)
    ax.set(title=f"{col} (raw)", xlabel="years", ylabel="respondents")
    ax.grid(axis="y")
ax = axes[2]
hb = ax.hexbin(train["YearsCode"], train["WorkExp"], gridsize=35, cmap=viz.seq_cmap(), mincnt=1, bins="log")
ax.plot([0, 60], [0, 60], color=viz.ORANGE, lw=1)
r = train[["YearsCode", "WorkExp"]].corr().iloc[0, 1]
ax.set(title=f"YearsCode vs WorkExp (cleaned), r = {r:.2f}", xlabel="YearsCode", ylabel="WorkExp")
ax.grid(False)
plt.tight_layout()
viz.save(fig, "02_experience")
plt.show()

# %% [markdown]
# ### 4.1 Outliers and impossible values
#
# Both variables are right-skewed with a tail up to 100 years. A standard IQR rule
# would flag every senior developer (30+ years) as an outlier, which is wrong: long
# careers are real. Instead we check **plausibility against the age band**: coding
# cannot start before about age 5 and paid work before about 14.

# %%
upper = exp_raw["Age"].map(C.AGE_BAND_UPPER)
bad_code = exp_raw["YearsCode"] > (upper - C.MIN_START_AGE_CODING).fillna(C.MAX_YEARS_FALLBACK)
bad_work = exp_raw["WorkExp"] > (upper - C.MIN_START_AGE_WORK).fillna(C.MAX_YEARS_FALLBACK)
q1, q3 = exp_raw["YearsCode"].quantile([0.25, 0.75])
iqr_flag = exp_raw["YearsCode"] > q3 + 1.5 * (q3 - q1)
print(f"IQR rule would flag YearsCode > {q3 + 1.5 * (q3 - q1):.0f} years: {iqr_flag.sum():,} respondents")
print(f"impossible for age band: YearsCode {bad_code.sum()}, WorkExp {bad_work.sum()}")
print("\nexamples of impossible values:")
print(exp_raw[bad_code | bad_work].value_counts().head(8).to_string())

# %% [markdown]
# **Decision (outliers, experience):** keep long careers; set only the values that
# are impossible for the respondent's age band to missing (they are then imputed
# with the training median), and apply a log1p transform to reduce the skew. Age is
# used for this check only, it is not a model input.
#
# `WorkExp > YearsCode` is **not** an error: `WorkExp` is total professional work,
# which includes years in another field before learning to code. These career
# changers become an engineered flag, `CareerChanger`.

# %%
changer = (train["WorkExp"] > train["YearsCode"])
print(f"career changers in training split: {changer.sum():,} ({changer.mean():.1%})")
print(pd.crosstab(train[FAM], changer, normalize="index")[True].sort_values(ascending=False).round(3)
      .rename("share of career changers").to_string())

# %% [markdown]
# ### 4.2 Blank WorkExp means zero years
#
# The question says: *"If your answer is '0', please leave blank."* No respondent
# entered 0 (the minimum is 1). The people who left it blank look like new entrants:

# %%
blank = exp_raw["WorkExp"].isna() & exp_raw["YearsCode"].notna()
cmp = pd.DataFrame({
    "blank WorkExp": [blank.sum(), exp_raw.loc[blank, "YearsCode"].median(),
                      (exp_raw.loc[blank, "Age"] == "18-24 years old").mean()],
    "WorkExp given": [(~blank).sum(), exp_raw.loc[~blank, "YearsCode"].median(),
                      (exp_raw.loc[~blank, "Age"] == "18-24 years old").mean()],
}, index=["respondents", "median YearsCode", "share aged 18-24"])
cmp.round(2)

# %% [markdown]
# **Decision (missing values, experience):** a blank `WorkExp` with an answered
# `YearsCode` is set to **0**, following the survey instruction. Imputing the median
# (10 years) would turn students into mid-career professionals. Remaining gaps
# (both fields blank, or impossible values) are imputed with the training median
# plus a missing-indicator column.

# %% [markdown]
# ## 5. Education, region and AI usage by role family
#
# Cramér's V measures association between two categorical variables (0 = none,
# 1 = perfect). Values shown for the training split.

# %%
def cramers_v(x, y):
    t = pd.crosstab(x, y)
    chi2 = chi2_contingency(t, correction=False)[0]
    return float(np.sqrt(chi2 / (t.values.sum() * (min(t.shape) - 1))))

cats = ["EdLevel", "Region", "LearnCodeAI", "AISelect", "AIAgents", "AIAcc", "AISent",
        "OrgSize", "Industry", "RemoteWork", "ICorPM", "Age", "MainBranch"]
assoc = pd.Series({c: cramers_v(train[c].fillna("Missing"), train[FAM]) for c in cats}).sort_values(ascending=False)
assoc.round(3).rename("Cramér's V with RoleFamily").to_frame()

# %%
def share_heatmap(col, order, title, fname):
    tab = pd.crosstab(train[FAM], train[col], normalize="index").reindex(index=fam_order, columns=order) * 100
    fig, ax = plt.subplots(figsize=(1.0 + 0.85 * len(order), 4.8))
    im = ax.imshow(tab.values, cmap=viz.seq_cmap(), aspect="auto")
    ax.set_xticks(range(len(order)), [o[:34] for o in order], rotation=40, ha="right", fontsize=8)
    ax.set_yticks(range(len(fam_order)), fam_order)
    ax.grid(False)
    for i in range(tab.shape[0]):
        for j in range(tab.shape[1]):
            v = tab.values[i, j]
            ax.text(j, i, f"{v:.0f}", ha="center", va="center", fontsize=7,
                    color="white" if v > tab.values.max() * 0.6 else viz.TEXT)
    ax.set_title(title)
    viz.save(fig, fname)
    plt.show()

regions = train["Region"].value_counts().index.tolist()
share_heatmap("Region", regions, "Region mix within each role family (% of family)", "02_region_by_family")

# %%
ai_order = sorted(C.ORDINAL_MAPS["AISelect"], key=C.ORDINAL_MAPS["AISelect"].get)
share_heatmap("AISelect", ai_order, "AI tool use frequency within each role family (%)", "02_aiselect_by_family")

# %% [markdown]
# * Education and region are weakly related to role (V around 0.1): useful context
#   but far weaker than the technologies.
# * **Country has 150+ values in the cohort**, many with only a handful of people. It
#   is mapped to 13 UN M49 based regions, which keeps the geographic signal
#   (for example South Asia supplies 17% of Mobile and 12% of Frontend developers
#   but only 3% of Embedded developers) without one column per tiny country.
# * AI usage differs by family: about 55% of Frontend, Mobile and Data Sci/ML
#   developers use AI tools daily versus under 30% of Game/Graphics and Embedded
#   developers, so the four AI usage questions are kept as ordinal features.
# * Age is associated with role but is **excluded as a feature** (fairness decision
#   in the proposal). MainBranch is a screening variable, not a user input.

# %% [markdown]
# ## 6. AI task matrix, AI Exposure Index and AI threat
#
# For 13 development tasks, respondents said whether they do it mostly/partially
# with AI now, plan to, or do not plan to. Each task appears in exactly one of the
# five level columns per person (verified: 0 conflicts), so the matrix can be turned
# into one level per task.

# %%
ai = pd.read_parquet(C.REFERENCE_DIR / "ai_exposure_role_cohort.parquet")
ai = ai[ai["split"] == "train"]
task_cols = [c for c in ai.columns if c.startswith("task: ")]
levels = ["mostly_now", "partially_now", "plan_mostly", "plan_partially", "no_plan"]
dist = pd.DataFrame({t.replace("task: ", ""): ai[t].value_counts(normalize=True) for t in task_cols}).T[levels] * 100
dist = dist.sort_values(["mostly_now", "partially_now"], ascending=False)
fig, ax = plt.subplots(figsize=(10, 4.8))
left = np.zeros(len(dist))
colors = ["#184f95", "#5598e7", "#eb6834", "#f5b08f", "#d3d1c7"]
for lev, colr in zip(levels, colors):
    ax.barh(dist.index, dist[lev], left=left, color=colr, label=lev.replace("_", " "), height=0.7,
            edgecolor="white", linewidth=1)
    left += dist[lev].values
ax.invert_yaxis()
ax.grid(axis="y", visible=False)
ax.set(title="How developers use AI for each task (training split)", xlabel="% of respondents who rated the task")
ax.legend(ncol=5, loc="lower center", bbox_to_anchor=(0.45, -0.28), fontsize=8)
viz.save(fig, "02_ai_task_matrix")
plt.show()

# %%
print(f"rated at least {C.AI_MIN_TASKS_ANSWERED} of 13 tasks: {ai['ai_exposure_now'].notna().sum():,} "
      f"of {(ai['ai_tasks_rated'] > 0).sum():,} matrix respondents")
exp_fam = ai.groupby(FAM)[["ai_exposure_now", "ai_exposure_expected"]].mean().sort_values("ai_exposure_expected")
threat = ai.groupby(FAM)["AIThreat"].apply(lambda s: (s == "Yes").sum() / s.notna().sum() * 100)
fig, axes = plt.subplots(1, 2, figsize=(13, 4.2), gridspec_kw={"width_ratios": [1.3, 1]})
ax = axes[0]
y = np.arange(len(exp_fam))
ax.hlines(y, exp_fam["ai_exposure_now"], exp_fam["ai_exposure_expected"], color=viz.GRID, lw=3)
ax.plot(exp_fam["ai_exposure_now"], y, "o", color=viz.BLUE, ms=8, label="now")
ax.plot(exp_fam["ai_exposure_expected"], y, "o", color=viz.ORANGE, ms=8, label="expected")
ax.set_yticks(y, exp_fam.index)
ax.set(title="AI Exposure Index by family (0-100)", xlabel="index")
ax.legend(loc="lower right")
ax.grid(axis="y", visible=False)
viz.barh(axes[1], threat.loc[exp_fam.index[::-1]].index.tolist(), threat.loc[exp_fam.index[::-1]].round(1).tolist(),
         fmt="{:.1f}%")
axes[1].set(title='Say AI is a threat to their job ("Yes")', xlabel="% of family")
plt.tight_layout()
viz.save(fig, "02_ai_exposure_threat")
plt.show()

# %% [markdown]
# * AI use is concentrated in low-risk tasks (searching, learning, generating
#   content). Deployment, project planning and code review are mostly "no plan".
# * Expected exposure is higher than current exposure for every family, most for
#   Data Sci/ML, Mobile and Frontend; lowest for Embedded and Game/Graphics.
# * Perceived threat is low overall (roughly 9-19% say "Yes") and follows exposure
#   only loosely, which supports showing exposure and perceived threat as two
#   separate measures in the app.
# * 13 tasks is too few to need rare-level grouping, and each task is a 5-level
#   ordered scale, which is why a weighted index (mostly = 1, partially = 0.5) is a
#   sensible summary.

# %% [markdown]
# The app shows the AI outlook for each recommended **job role**, so the same
# measures are needed at job-role level, with the number of respondents behind each.

# %%
by_job = ai.groupby(JOB).agg(
    n=("ai_exposure_now", "count"),
    exposure_now=("ai_exposure_now", "mean"),
    exposure_expected=("ai_exposure_expected", "mean"),
    threat_yes_pct=("AIThreat", lambda s: (s == "Yes").sum() / s.notna().sum() * 100),
).round(1).sort_values("exposure_expected", ascending=False)
by_job.insert(0, "family", by_job.index.map(C.ROLE_FAMILY))
by_job.index = by_job.index.map(C.JOB_ROLE_LABEL)
by_job

# %% [markdown]
# Every job role has at least about 40 respondents behind its AI figures in the
# training split, so job-role level AI summaries are usable; for the smallest roles
# the app should show the sample size and the family figure alongside.

# %% [markdown]
# ## 7. Salary (supporting component)
#
# Salary cohort: employed or self-employed professional developers with a reported
# salary, excluding the recommender test respondents.

# %%
from skillpath.cleaning import drop_near_empty, drop_exact_duplicates, drop_straightliners, clean_experience
from skillpath.cohorts import build_salary_cohort

test_ids = set(pd.read_parquet(C.PROCESSED_DIR / "test.parquet")[C.ID_COL])
clean, _ = drop_near_empty(raw)
clean, _ = drop_exact_duplicates(clean)
clean, _ = drop_straightliners(clean)
clean, _ = clean_experience(clean)
sal, _ = build_salary_cohort(clean)
sal = sal[~sal[C.ID_COL].isin(test_ids)]
y = sal[C.SALARY_COL]
print(f"salary respondents: {len(sal):,}")
print(y.describe(percentiles=[0.01, 0.05, 0.5, 0.95, 0.99]).round(0).to_string())
print(f"skew raw: {y.skew():.1f}   skew log10: {np.log10(y).skew():.2f}")

# %%
ref = pd.read_parquet(C.REFERENCE_DIR / "salary_reference.parquet")
fig, axes = plt.subplots(1, 2, figsize=(13, 3.4))
bins = np.linspace(0, 8.5, 103)
axes[0].hist(np.log10(y), bins=bins, color=viz.MUTED, label="all reported")
axes[0].hist(ref["log10_salary"], bins=bins, color=viz.BLUE, label="kept after cleaning")
for b in (C.SALARY_MIN, C.SALARY_MAX):
    axes[0].axvline(np.log10(b), color=viz.ORANGE, lw=1)
axes[0].set_xticks(range(0, 9), ["$1", "$10", "$100", "$1k", "$10k", "$100k", "$1M", "$10M", "$100M"])
axes[0].set(title="Annual compensation (USD, log scale)", ylabel="respondents")
axes[0].legend()
axes[0].grid(axis="y")
us = sal[sal["Country"] == "United States of America"][C.SALARY_COL]
axes[1].hist(np.log10(us), bins=60, color=viz.BLUE)
axes[1].set_xticks(range(0, 8), ["$1", "$10", "$100", "$1k", "$10k", "$100k", "$1M", "$10M"])
axes[1].set(title="United States only: values like $130 are typed in thousands")
axes[1].grid(axis="y")
plt.tight_layout()
viz.save(fig, "02_salary")
plt.show()
print("lowest US values:", np.sort(us.values)[:12])

# %%
rep = pd.read_csv(C.REPORTS_DIR / "salary_reference_attrition.csv")
rep

# %% [markdown]
# * Salary is extremely skewed (skew about 70 raw, far smaller in log10), so all
#   salary work uses **log10 salary** and percentiles, never the mean.
# * Two-stage outlier rule: (1) keep $1,000 to $1,000,000 per year; (2) within each
#   country (or region if the country has fewer than 30 respondents) drop values
#   whose robust z-score on log salary is above 3.5. Stage 2 catches values that are
#   plausible globally but not for that country (US "$130" = 130k typed without
#   zeros). Medians and MADs are learned on these reference rows only.

# %%
ref["cell"] = ref["Country"].astype(str) + " | " + ref[FAM].astype(str) + " | " + ref["ExperienceBand"].astype(str)
cells = ref[ref[FAM].notna()].groupby("cell").size()
print(f"country x family x experience cells: {len(cells):,}; with >= {C.MIN_PEER_N} people: {(cells >= C.MIN_PEER_N).sum()} "
      f"(covering {cells[cells >= C.MIN_PEER_N].sum() / cells.sum():.1%} of respondents)")
reg = ref[ref[FAM].notna()].groupby(["Region", FAM, "ExperienceBand"]).size()
print(f"region x family x experience cells: {len(reg)}; with >= {C.MIN_PEER_N}: {(reg >= C.MIN_PEER_N).sum()} "
      f"(covering {reg[reg >= C.MIN_PEER_N].sum() / reg.sum():.1%})")
print("Sri Lanka respondents in the salary reference:", int((ref["Country"] == "Sri Lanka").sum()))

# %% [markdown]
# Country-level peer groups are too thin for most people, which confirms the
# proposal's **hierarchical fallback** (country, then region, then global) and the
# low-confidence warning for small groups such as Sri Lanka.
#
# Because recommendations are job roles, the benchmark first tries the **job role**
# and falls back to the **family** when the job-role group is too small. For every
# salaried respondent in the recommender roles we find the most specific level whose
# group (always within the same experience band) has at least 30 people:

# %%
r = ref[ref[JOB].notna()].copy()
r["level used"] = None
for role_col, geo in C.PEER_GROUP_LEVELS:
    keys = [role_col, "ExperienceBand"] + ([geo] if geo else [])
    size = r.groupby(keys)[C.SALARY_COL].transform("size")
    name = f"{role_col} x {geo or 'global'} x experience"
    r.loc[r["level used"].isna() & (size >= C.MIN_PEER_N), "level used"] = name
r["level used"] = r["level used"].fillna("no group with 30+ (show wide range only)")
cov = r["level used"].value_counts().rename("respondents").to_frame()
cov["share"] = (cov["respondents"] / len(r) * 100).round(1).astype(str) + "%"
cov

# %% [markdown]
# About 72% of people get a benchmark within their own country or region (69% at
# job-role level), about 26% need a global job-role or family group, and under 2%
# have no group of 30+ (the app then shows only a wide range with a warning). The
# app will always state which level was used and how many people are in it.

# %% [markdown]
# ## 8. Leakage screen and redundancy
#
# ### 8.1 Is any candidate column suspiciously close to the target?
#
# A column that almost determines the job role (V near 1) would suggest leakage,
# for example an answer that restates the job title. We screen every single-choice
# column and every technology option on the training split.

# %%
single = []
for col in train.columns:
    if col in (C.ID_COL, JOB, FAM, "DevType", "split"):
        continue
    s = train[col]
    if pd.api.types.is_numeric_dtype(s) or s.astype(str).str.contains(";", regex=False).any():
        continue
    if 2 <= s.nunique() <= 60:
        single.append((col, round(cramers_v(s.fillna("Missing"), train[JOB]), 3)))
single = pd.DataFrame(single, columns=["column", "V with JobRole"]).sort_values("V with JobRole", ascending=False)

toks = []
for b, (have, want, _) in C.TECH_BLOCKS.items():
    for kind, col in (("have", have), ("want", want)):
        sets = train[col].map(parse_tokens)
        for t, n in sets.explode().value_counts().items():
            if n >= C.MIN_TOKEN_FREQUENCY * len(train):
                toks.append((f"{b} {kind}: {t}", round(cramers_v(sets.map(lambda s: t in s), train[JOB]), 3)))
toks = pd.DataFrame(toks, columns=["technology", "V with JobRole"]).sort_values("V with JobRole", ascending=False)
print("strongest single-choice columns:"); print(single.head(8).to_string(index=False))
print("\nstrongest technology options:"); print(toks.head(8).to_string(index=False))
print(f"\nmax V overall: {max(single['V with JobRole'].max(), toks['V with JobRole'].max()):.2f}")

# %% [markdown]
# No column comes close to determining the role (maximum V = 0.42, for Swift). The
# strongest single-choice columns are the technology gates (people who build no web
# apps are rarely web developers, V = 0.33), which is a legitimate signal, and the
# strongest technologies are exactly what we expect (Swift, JavaScript, HTML/CSS, C).
# MainBranch (V = 0.26) is a cohort/screening variable and is not a model input. **No hidden leakage was found.** The known leakage risks
# are handled by design:
#
# | Risk | Handling |
# |---|---|
# | DevType, JobRole, RoleFamily as inputs | never in `model_input_columns()` (unit-tested) |
# | CompTotal, Currency produce the salary | excluded everywhere |
# | `...Admired` columns are derived from have + want | excluded |
# | Test rows influencing preprocessing | split first; vocabularies, medians, scalers fitted on train only |
# | Test rows in supporting tables | salary and persona tables exclude test IDs |
# | CV folds influencing each other | whole preprocessing is inside the sklearn Pipeline, refitted per fold |

# %% [markdown]
# ### 8.2 Redundancy between technologies

# %%
M = H.loc[:, H.mean() >= 0.02]
corr = M.corr().abs().to_numpy(copy=True)
np.fill_diagonal(corr, 0)
iu = np.triu_indices_from(corr, 1)
pairs = pd.DataFrame({"a": M.columns[iu[0]], "b": M.columns[iu[1]], "abs r": corr[iu]}).sort_values("abs r", ascending=False)
print(pairs.head(8).round(3).to_string(index=False))
print(f"\npairs above 0.8: {(pairs['abs r'] > 0.8).sum()}")

# %% [markdown]
# The strongest overlaps are natural pairs (Elixir with its framework Phoenix, Ruby
# with Rails, Supabase listed as both a database and a platform). Only one pair
# goes above 0.8 (Elixir and Phoenix, r = 0.81), and each column still carries people
# the other misses, so no technology column is dropped for redundancy. `YearsCode` and `WorkExp` are
# strongly correlated (r = 0.88 on the cleaned training data). Both are kept: they mean different things (total
# coding vs professional work), tree models are unaffected, and the linear models
# use L2 regularisation, which handles correlated inputs. Dropping one is listed as
# a Stage 7 feature-selection experiment.

# %% [markdown]
# ## 9. Findings that drive preprocessing
#
# | # | Finding (evidence) | Preprocessing decision |
# |---|---|---|
# | 1 | Target very imbalanced, 39% Full-stack, ratio about 155:1 | stratified split; macro-F1, balanced accuracy, top-3; imbalance handling tested inside CV |
# | 2 | Most empty technology lists are true zeros (gate = No) | 0/1 columns + `unknown` flag only when not "No"; no imputation, no row deletion |
# | 3 | A few technologies chosen by < 0.5% | pooled into per-block `OTHER` (also catches unseen web inputs) |
# | 4 | Breadth counts right-skewed | log1p breadth features |
# | 5 | Want list differs from have list (all phi < 0.8) | keep both; engineered `want_new_count` |
# | 6 | Blank WorkExp = 0 per survey instruction; blanks are young / new | set to 0, not median |
# | 7 | Some experience values impossible for the age band; long careers are real | impossible values to NaN, median impute + indicator, log1p; no IQR trimming |
# | 8 | WorkExp > YearsCode for about 1 in 15 people (career changers) | keep, engineered `CareerChanger` flag |
# | 9 | Country has 150+ sparse values | map to 13 regions, one-hot |
# | 10 | Ordered answer scales (education, AI frequency/trust/sentiment) | ordinal integers in their natural order, median impute + indicator, scaled |
# | 11 | No column with suspicious association to the target | leakage handled by design (table 8.1) |
# | 12 | Salary skew ~70, implausible values, sparse country cells | log10, two-stage outlier rule on reference rows, job role to family and country to region to global fallback |
# | 13 | Job roles in the same family have different technology signatures, but some roles are very similar | target = specific job role; family = sum of job-role probabilities; report top-3 and family-level metrics |
# | 14 | Five job roles have < 150 training examples | stratified split on JobRole; per-class metrics read with care; imbalance handling tested in CV |
