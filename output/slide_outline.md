# SkillPath final presentation: slide outline

IT3051 – Fundamentals of Data Mining · Sri Lanka Institute of Information Technology (SLIIT) · Group KND_12

13 slides: one shared introduction, then three slides per member.

## Member allocation

| Member | Name | Registration no. | Section | Slides |
|---|---|---|---|---|
| 1 | S S P S Bandara | IT23602250 | Problem, Objectives & Dataset | 2–4 |
| 2 | Yoosuf A.A | IT23645202 | Methodology, Preprocessing & Features | 5–7 |
| 3 | M G S D Wijesinghe | IT23564640 | Models, Optimisation & Results | 8–10 |
| 4 | K M H S Bandara | IT23792418 | System, Testing & Conclusion | 11–13 |

Slide 1 is shared. The allocation is who presents each section; it does not claim who built which part.

## Slides

### Slide 1: SkillPath: AI-Aware Developer Career Recommendation System

- **Presenter:** Shared (all members)
- **Key message:** Shared introduction: what SkillPath is, the module, the institution and the four presenters.
- **On the slide:** Real start-page screenshot; member cards; four headline figures

### Slide 2: Problem Statement and Motivation

- **Presenter:** S S P S Bandara
- **Key message:** Developer careers have split into many specialised roles, guidance is generic, and AI is changing each role differently. SkillPath predicts the roles a profile resembles and backs each one with evidence.
- **On the slide:** Three problem cards, three evidence cards, problem-statement banner

### Slide 3: Aim, Objectives and Scope

- **Presenter:** S S P S Bandara
- **Key message:** One aim, six objectives that map onto the rest of the talk, and a scope of 20 skill-defined roles in 12 families for students and early-career developers.
- **On the slide:** Aim banner, six numbered objectives, in-scope and out-of-scope cards

### Slide 4: Dataset and Exploratory Data Analysis

- **Presenter:** S S P S Bandara
- **Key message:** 49,123 responses and 170 attributes. EDA found a 155:1 class imbalance and near-identical roles, and each finding drove a later design decision.
- **On the slide:** Native bar chart of the 20 roles; role-similarity heatmap from notebook 02; finding-to-consequence strip

### Slide 5: CRISP-DM Methodology

- **Presenter:** Yoosuf A.A
- **Key message:** The project follows the six CRISP-DM phases, each mapped to real project stages and artefacts, with four design principles that keep the results trustworthy.
- **On the slide:** Six-phase chevron flow mapped to project stages and artefacts; four design principles

### Slide 6: Data Cleaning and Preprocessing

- **Presenter:** Yoosuf A.A
- **Key message:** Documented, deterministic rules take 49,123 raw responses to a 23,072-respondent cohort, split 80/20 before anything is learned, so nothing leaks.
- **On the slide:** Cohort attrition bars (49,123 to 23,072); train/test split bar; three rule cards

### Slide 7: Feature Engineering and Supporting Insights

- **Presenter:** Yoosuf A.A
- **Key message:** One scikit-learn pipeline turns survey answers into 479 features, separating "uses none" from "did not answer", and three supporting datasets supply the evidence shown with each role.
- **On the slide:** Pipeline diagram (survey row to 479 features to model); “none” vs “not answered”; three insight cards

### Slide 8: Classification Algorithms and Validation

- **Presenter:** M G S D Wijesinghe
- **Key message:** A 20-class supervised problem, six algorithms with different inductive biases plus a dummy baseline, compared by stratified 5-fold cross-validation with macro-F1 as the primary metric.
- **On the slide:** Native chart: macro-F1 against accuracy for the seven models

### Slide 9: Model Optimisation and Final Model Selection

- **Presenter:** M G S D Wijesinghe
- **Key message:** Four experiment phases: class weighting was found to harm Logistic Regression, and tuning changed the winner from Gradient Boosting to Logistic Regression, selected by a rule fixed in advance.
- **On the slide:** Four phase cards; native chart: baseline against tuned macro-F1; selection-rule banner

### Slide 10: Final Model Evaluation

- **Presenter:** M G S D Wijesinghe
- **Key message:** Evaluated once on 4,615 held-out respondents: the correct role is among the three shown 83.9% of the time, with an honest account of modest top-1 performance and weak rare roles.
- **On the slide:** Five metric tiles; cross-validation vs test table; native chart of F1 per role

### Slide 11: System Architecture and Technology Stack

- **Presenter:** K M H S Bandara
- **Key message:** A React web app calls a FastAPI service that reuses the shared skillpath package and the saved pipeline, so training and serving use exactly the same preprocessing.
- **On the slide:** Architecture diagram (online row, offline workflow); seven-step prediction flow

### Slide 12: Application Demonstration and Testing

- **Presenter:** K M H S Bandara
- **Key message:** Real screenshots of the questionnaire, the three explained recommendations and the what-if comparison, verified by 178 automated tests at five levels including a zero-difference training–serving parity check.
- **On the slide:** Four real application screenshots; testing panel with the five levels

### Slide 13: Limitations, Future Work and Conclusion

- **Presenter:** K M H S Bandara
- **Key message:** What was achieved, where the system is honestly limited, what comes next, and the conclusion.
- **On the slide:** Achievements, limitations and future work columns; conclusion; thank-you panel
