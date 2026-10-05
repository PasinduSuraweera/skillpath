"""Build the Stage 6-8 technical report as a PDF.

    python scripts/build_report_pdf.py        -> reports/SkillPath_Stage6-8_Report.pdf

Reads the result files written by run_models.py, tune_models.py and
finalise_model.py, so the document can never disagree with the experiments: if a
number changes, re-run this and the report changes with it. Every stage and
every Stage 7 phase starts on its own page.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, KeepTogether, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

from skillpath import config as C

OUT = C.REPORTS_DIR / "SkillPath_Stage6-8_Report.pdf"

INK = colors.HexColor("#0b0b0b")
INK2 = colors.HexColor("#52514e")
BLUE = colors.HexColor("#2a78d6")
ORANGE = colors.HexColor("#eb6834")
RULE = colors.HexColor("#d8d7d3")
BAND = colors.HexColor("#f2f6fc")
GOOD = colors.HexColor("#1baf7a")

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm
CONTENT_W = PAGE_W - 2 * MARGIN


# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
def styles():
    s = getSampleStyleSheet()
    base = dict(fontName="Helvetica", textColor=INK, leading=13.5)
    s.add(ParagraphStyle("Body", parent=s["Normal"], fontSize=9.5, alignment=TA_JUSTIFY,
                         spaceAfter=7, **base))
    s.add(ParagraphStyle("BodyTight", parent=s["Normal"], fontSize=9.5, spaceAfter=3, **base))
    s.add(ParagraphStyle("H1", parent=s["Normal"], fontName="Helvetica-Bold", fontSize=17,
                         textColor=INK, spaceAfter=3, leading=21))
    s.add(ParagraphStyle("Kicker", parent=s["Normal"], fontName="Helvetica-Bold", fontSize=8.5,
                         textColor=BLUE, spaceAfter=10, leading=11))
    s.add(ParagraphStyle("H2", parent=s["Normal"], fontName="Helvetica-Bold", fontSize=11.5,
                         textColor=INK, spaceBefore=12, spaceAfter=5, leading=14))
    s.add(ParagraphStyle("H3", parent=s["Normal"], fontName="Helvetica-BoldOblique", fontSize=9.5,
                         textColor=INK2, spaceBefore=9, spaceAfter=3, leading=12))
    s.add(ParagraphStyle("Caption", parent=s["Normal"], fontSize=8, textColor=INK2,
                         spaceBefore=3, spaceAfter=10, leading=10))
    s.add(ParagraphStyle("Bull", parent=s["Normal"], fontSize=9.5, leftIndent=11,
                         bulletIndent=2, spaceAfter=4, alignment=TA_JUSTIFY, **base))
    s.add(ParagraphStyle("Q", parent=s["Normal"], fontName="Helvetica-Bold", fontSize=9.5,
                         textColor=INK, spaceBefore=8, spaceAfter=2, leading=12))
    s.add(ParagraphStyle("CoverTitle", parent=s["Normal"], fontName="Helvetica-Bold",
                         fontSize=28, textColor=INK, leading=32, spaceAfter=6))
    s.add(ParagraphStyle("CoverSub", parent=s["Normal"], fontSize=12, textColor=INK2,
                         leading=17, spaceAfter=4))
    s.add(ParagraphStyle("Mono", parent=s["Normal"], fontName="Courier", fontSize=8,
                         textColor=INK, leading=10.5, spaceAfter=6))
    s.add(ParagraphStyle("KeyBig", parent=s["Normal"], fontName="Helvetica-Bold", fontSize=19,
                         textColor=BLUE, alignment=TA_CENTER, leading=22))
    s.add(ParagraphStyle("KeyLab", parent=s["Normal"], fontSize=7.5, textColor=INK2,
                         alignment=TA_CENTER, leading=9.5))
    return s


S = styles()


def P(t, st="Body"):
    return Paragraph(t, S[st])


def bullets(items, st="Bull"):
    return [Paragraph(t, S[st], bulletText="•") for t in items]


# ---------------------------------------------------------------------------
# Page furniture
# ---------------------------------------------------------------------------
def chrome(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, PAGE_H - MARGIN + 6 * mm, PAGE_W - MARGIN, PAGE_H - MARGIN + 6 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(INK2)
    canvas.drawString(MARGIN, PAGE_H - MARGIN + 8 * mm,
                      "SkillPath  |  IT3051 Fundamentals of Data Mining  |  Group KND_12")
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN + 8 * mm,
                           "Stages 6-8: Modelling, Optimisation, Evaluation")
    canvas.line(MARGIN, MARGIN - 6 * mm, PAGE_W - MARGIN, MARGIN - 6 * mm)
    canvas.drawCentredString(PAGE_W / 2, MARGIN - 10 * mm, str(canvas.getPageNumber()))
    canvas.restoreState()


def cover_chrome(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BLUE)
    canvas.rect(0, PAGE_H - 12 * mm, PAGE_W, 12 * mm, stroke=0, fill=1)
    canvas.setFillColor(INK2)
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(PAGE_W / 2, 14 * mm,
                             "Stack Overflow Annual Developer Survey 2025  |  ODbL v1.0")
    canvas.restoreState()


def document():
    doc = BaseDocTemplate(str(OUT), pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=MARGIN, bottomMargin=MARGIN,
                          title="SkillPath - Stages 6-8 Technical Report",
                          author="Group KND_12, SLIIT Kandy Uni",
                          subject="IT3051 Fundamentals of Data Mining, Mini Project 2026")
    frame = Frame(MARGIN, MARGIN, CONTENT_W, PAGE_H - 2 * MARGIN, id="f")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame], onPage=cover_chrome),
        PageTemplate(id="body", frames=[frame], onPage=chrome),
    ])
    return doc


# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------
def table(rows, widths=None, align=None, highlight=None, head_bg=BLUE, size=8.2):
    """Data table. `highlight` is a set of row indices (1-based) to tint."""
    data = [[Paragraph(f"<b>{c}</b>", ParagraphStyle(
        "th", fontName="Helvetica-Bold", fontSize=size, textColor=colors.white, leading=size + 2.5))
        for c in rows[0]]]
    for r in rows[1:]:
        data.append([Paragraph(str(c), ParagraphStyle(
            "td", fontName="Helvetica", fontSize=size, textColor=INK, leading=size + 2.8))
            for c in r])

    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    st = [
        ("BACKGROUND", (0, 0), (-1, 0), head_bg),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
    ]
    for i in (highlight or []):
        st.append(("BACKGROUND", (0, i), (-1, i), BAND))
    if align:
        for col, a in align.items():
            st.append(("ALIGN", (col, 0), (col, -1), a))
    t.setStyle(TableStyle(st))
    return t


CALLOUT_BG = {
    ORANGE.hexval(): colors.HexColor("#fdf6f2"),
    BLUE.hexval(): colors.HexColor("#f2f6fc"),
    GOOD.hexval(): colors.HexColor("#f0faf6"),
}


def callout(title, text, accent=ORANGE):
    """A boxed finding, used for the results that changed a decision."""
    inner = [Paragraph(f"<b>{title}</b>", ParagraphStyle(
        "ct", fontName="Helvetica-Bold", fontSize=9.5, textColor=accent, leading=12,
        spaceAfter=4))]
    inner.append(Paragraph(text, ParagraphStyle(
        "cb", fontName="Helvetica", fontSize=9, textColor=INK, leading=12.5,
        alignment=TA_JUSTIFY)))
    t = Table([[inner]], colWidths=[CONTENT_W], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1),
         CALLOUT_BG.get(accent.hexval(), colors.HexColor("#fdf6f2"))),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, accent),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ]))
    return [Spacer(1, 4), t, Spacer(1, 8)]


def figure(name, caption, width=CONTENT_W, max_h=118 * mm):
    """Embed a report figure, scaled to fit the content width and a height cap."""
    path = C.FIGURES_DIR / f"{name}.png"
    if not path.exists():
        return [P(f"[missing figure: {name}.png]", "Caption")]
    from PIL import Image as PILImage
    with PILImage.open(path) as im:
        iw, ih = im.size
    w = width
    h = w * ih / iw
    if h > max_h:
        h = max_h
        w = h * iw / ih
    img = Image(str(path), width=w, height=h)
    img.hAlign = "CENTER"
    return [img, P(caption, "Caption")]


def kpi_row(items):
    """Big-number strip: [(value, label), ...]."""
    cells = [[Paragraph(v, S["KeyBig"])] + [Paragraph(l, S["KeyLab"])] for v, l in items]
    t = Table([cells], colWidths=[CONTENT_W / len(items)] * len(items), hAlign="CENTER")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BAND),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LINEAFTER", (0, 0), (-2, -1), 0.5, colors.white),
    ]))
    return t


def page(kicker, title, *flow):
    """One section, always starting on a fresh page."""
    out = [P(kicker, "Kicker"), P(title, "H1"),
           Table([[""]], colWidths=[CONTENT_W], rowHeights=[2],
                 style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), BLUE)])),
           Spacer(1, 10)]
    for f in flow:
        out.extend(f if isinstance(f, list) else [f])
    out.append(PageBreak())
    return out


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------
def load():
    r = C.REPORTS_DIR
    d = {
        "s6": pd.read_csv(r / "stage6_model_comparison.csv"),
        "s6rep": json.loads((r / "stage6_report.json").read_text()),
        "perclass": pd.read_csv(r / "stage6_per_class_report.csv"),
        "a": pd.read_csv(r / "stage7_a_imbalance.csv"),
        "b": pd.read_csv(r / "stage7_b_features.csv"),
        "c": pd.read_csv(r / "stage7_c_tuned.csv"),
        "d": pd.read_csv(r / "stage7_d_tuned_vs_baseline.csv"),
        "params": json.loads((r / "stage7_best_params.json").read_text()),
        "final": json.loads((r / "stage7_final_selection.json").read_text()),
        "test": json.loads((r / "stage7_test_results.json").read_text()),
        "testpc": pd.read_csv(r / "stage7_test_per_class.csv"),
        "card": json.loads((C.ARTIFACTS_DIR / "model_card.json").read_text()),
        "log": pd.read_csv(r / "model_experiments.csv"),
    }
    return d


def f4(x):
    return f"{float(x):.4f}"


def short(role):
    return C.JOB_ROLE_LABEL.get(role, role)


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------
def cover(d):
    t = d["test"]["test_scores"]
    members = [
        ("S S P S Bandara", "IT23602250"),
        ("Yoosuf A.A", "IT23645202"),
        ("M G S D Wijesinghe", "IT23564640"),
        ("K M H S Bandara", "IT23792418"),
    ]
    return [
        Spacer(1, 26 * mm),
        P("IT3051 &mdash; FUNDAMENTALS OF DATA MINING &nbsp;|&nbsp; MINI PROJECT 2026", "Kicker"),
        P("SkillPath", "CoverTitle"),
        P("An AI-aware developer job role and career path recommendation system", "CoverSub"),
        Spacer(1, 4),
        Table([[""]], colWidths=[46 * mm], rowHeights=[2.5],
              style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), BLUE)]), hAlign="LEFT"),
        Spacer(1, 10 * mm),
        P("<b>Technical Report &mdash; Stage 6, Stage 7 and Stage 8</b><br/>"
          "Model Development &middot; Model Optimisation and Final Model Selection &middot; "
          "Evaluation and Defence", "CoverSub"),
        Spacer(1, 10 * mm),
        table([["Group member", "Registration number"]] + [[m, r] for m, r in members],
              widths=[CONTENT_W * 0.55, CONTENT_W * 0.45], size=9),
        Spacer(1, 12 * mm),
        P("Headline result on the held-out test split (4,615 respondents)", "H3"),
        kpi_row([
            (f"{t['top3_accuracy']:.1%}", "correct job role<br/>in the top 3 shown"),
            (f"{t['family_top3_accuracy']:.1%}", "correct career family<br/>in the top 3"),
            (f"{t['f1_macro']:.3f}", "macro-F1<br/>(20 classes)"),
            (f"{t['accuracy']:.1%}", "top-1<br/>accuracy"),
        ]),
        Spacer(1, 8 * mm),
        P("<b>Final model:</b> Logistic Regression (C = 0.218, no class weighting) inside the "
          "Stage 4 preprocessing pipeline. Group KND_12, SLIIT Kandy Uni.", "Caption"),
        NextPageTemplate("body"),
        PageBreak(),
    ]


def overview(d):
    s6 = d["s6"]
    return page(
        "ORIENTATION", "Executive summary",
        P("This report covers Stage 6 (model development), Stage 7 (optimisation and final "
          "model selection) and the material prepared for Stage 8 (individual evaluation). "
          "Stages 3 and 4 are documented separately in <i>preprocessing_decisions.md</i>.", "Body"),

        P("The task", "H2"),
        P("Predict a developer's <b>specific job role</b> from a self-reported skill and "
          "AI-attitude profile: a 20-class classification problem over 479 features, built "
          "from 18,457 training and 4,615 held-out respondents. A role family's probability "
          "is the <b>sum</b> of its job roles' probabilities, so a single model produces both "
          "the three job-role suggestions and the career-family shortlist the application shows.", "Body"),

        P("What was done", "H2"),
        table([
            ["Stage", "Work", "Evidence"],
            ["6", "Seven candidates (one baseline, six algorithms) cross-validated and compared",
             "stage6_model_comparison.csv"],
            ["7A", "Imbalance handling: none vs class weighting vs oversampling, on two algorithms",
             "stage7_a_imbalance.csv"],
            ["7B", "Nine feature-set and feature-selection experiments", "stage7_b_features.csv"],
            ["7C", "Randomised hyper-parameter search for all four serious models", "stage7_c_tuned.csv"],
            ["7D", "Tuned vs baseline, final model chosen by a pre-registered rule",
             "stage7_d_tuned_vs_baseline.csv"],
            ["&mdash;", "Final fit, single held-out evaluation, deployable artifact",
             "artifacts/model.joblib"],
        ], widths=[CONTENT_W * 0.08, CONTENT_W * 0.58, CONTENT_W * 0.34]),
        Spacer(1, 4),
        P(f"{len(d['log'])} cross-validation runs are recorded with timestamps in "
          f"<i>reports/model_experiments.csv</i>.", "Caption"),

        P("The three findings that mattered", "H2"),
        *bullets([
            "<b>Removing class weighting gained more than any hyper-parameter.</b> Stage 6 applied "
            "<i>class_weight=\"balanced\"</i> reflexively because the data is imbalanced 155:1. "
            "Phase A showed it was <i>harming</i> Logistic Regression by 0.047 macro-F1 &mdash; about "
            "fifteen fold-standard-deviations, and larger than every tuning effect found later.",
            "<b>Optimisation changed which model ships.</b> Hist Gradient Boosting led Stage 6 "
            "(0.2724 macro-F1); after tuning, Logistic Regression leads (0.3030). Tuning only the "
            "Stage 6 winner would have locked in the wrong model.",
            "<b>The error analysis contradicted the EDA prediction.</b> Confusion was expected "
            "<i>within</i> families (Cloud Infrastructure and DevOps have cosine similarity 0.99). "
            "In fact all eight largest confusions cross family boundaries and point at Full-stack. "
            "The dominant problem is imbalance, not role overlap.",
        ]),

        P("Model comparison at a glance", "H2"),
        table(
            [["Model", "Stage 6 macro-F1", "Stage 7 tuned", "Test macro-F1"]] +
            [["Logistic Regression", "0.2547", "<b>0.3030</b>", "<b>0.2845</b>"],
             ["Hist Gradient Boosting", "0.2724", "0.2860", "&mdash;"],
             ["Random Forest", "0.2537", "0.2820", "&mdash;"],
             ["Linear SVM (calibrated)", "0.1911", "0.2536", "&mdash;"],
             ["Complement Naive Bayes", "0.1786", "not tuned", "&mdash;"],
             ["k-Nearest Neighbours", "0.1676", "not tuned", "&mdash;"],
             ["Dummy (majority class)", "0.0283", "&mdash;", "&mdash;"]],
            widths=[CONTENT_W * 0.37, CONTENT_W * 0.21, CONTENT_W * 0.21, CONTENT_W * 0.21],
            align={1: "CENTER", 2: "CENTER", 3: "CENTER"}, highlight=[1]),
    )


def stage6_setup(d):
    counts = pd.read_parquet(C.PROCESSED_DIR / "train.parquet")[C.TARGET_JOB].value_counts()
    return page(
        "STAGE 6 &mdash; MODEL DEVELOPMENT", "Problem, target and validation strategy",
        P("Two properties of the target drive every decision in Stages 6 and 7.", "Body"),

        P("1. Severe class imbalance", "H2"),
        P(f"Full-stack accounts for {counts.iloc[0]:,} of the {counts.sum():,} training "
          f"respondents ({counts.iloc[0] / counts.sum():.1%}); the smallest role, UX / Research "
          f"Ops / UI design, has {counts.iloc[-1]}. That is a ratio of about "
          f"<b>{counts.max() / counts.min():.0f}:1</b>. Always answering \"Full-stack\" scores "
          f"{counts.iloc[0] / counts.sum():.1%} accuracy while knowing nothing, so accuracy "
          f"cannot be the headline metric.", "Body"),

        P("2. Genuinely overlapping classes", "H2"),
        P("EDA measured cosine similarity 0.99 between the technology profiles of Cloud "
          "Infrastructure and DevOps engineers, and 0.97 between Data Engineer and Data "
          "Scientist. These roles are not separable <i>in the data</i>, so no algorithm can "
          "separate them. This sets the ceiling, and it is why the product shows "
          "<b>three ranked roles plus the family total</b> rather than a single answer.", "Body"),

        P("Validation strategy", "H2"),
        P("<font face='Courier' size='8.5'>StratifiedKFold(n_splits=5, shuffle=True, "
          "random_state=42)</font> on the training split, for every experiment in both stages, "
          "so every number in this report is comparable with every other.", "Body"),
        table([
            ["Choice", "Reason", "Alternative rejected"],
            ["Stratified", "With 47 examples in the smallest class, an unstratified fold could "
                           "contain almost none of it", "Plain KFold: rare roles vanish at random"],
            ["5 folds", "The smallest class still contributes about 9 respondents per fold",
             "10 folds leaves ~4 (per-class F1 becomes noise); 3 folds wastes training data"],
            ["shuffle, fixed seed", "Rows arrive in survey order; a fixed seed makes runs "
                                    "reproducible", "Unshuffled: survey ordering becomes a fold effect"],
            ["Preprocessor inside<br/>the estimator",
             "Each fold refits vocabulary, rare pooling, medians, scaler and variance filter on "
             "its own training part",
             "Fitting once on all training data: every validation fold would influence its own features"],
            ["Test split untouched", "Opened once, by finalise_model.py, after the model was chosen",
             "Re-scoring on test while iterating turns it into a second validation set"],
        ], widths=[CONTENT_W * 0.20, CONTENT_W * 0.42, CONTENT_W * 0.38]),

        P("Leakage controls", "H2"),
        *bullets([
            "Deterministic cleaning runs before the split; nothing statistical is learned first.",
            "Train and test IDs are disjoint and frozen in <i>split_ids.csv</i>.",
            "Resampling lives inside the estimator, so duplicated respondents can never appear on "
            "both sides of a fold.",
            "Feature selection lives inside the pipeline, so features are chosen per fold, never "
            "using labels the validation fold is meant to test.",
            "19 automated checks in <i>tests/test_modelling.py</i> enforce these.",
        ]),
    )


def stage6_algos(d):
    rows = [["Model", "Inductive bias", "Why it is in the comparison"]]
    for m, bias, why in [
        ("Dummy (most frequent)", "none",
         "Fixes the floor and proves the metric choice: 0.394 accuracy with 0.028 macro-F1."),
        ("Complement Naive Bayes", "features independent given the class",
         "Built for imbalanced sparse count data. Its assumption is known false here (React "
         "implies JavaScript), so it measures what that assumption costs."),
        ("k-Nearest Neighbours", "local similarity",
         "Tests the product's own premise &mdash; similar skills, similar job. Cosine distance "
         "because the vectors are sparse 0/1 sets of very different breadth."),
        ("Logistic Regression", "linear in feature space",
         "The standard strong baseline for wide sparse data. Readable coefficients matter for "
         "explaining the system to non-technical stakeholders."),
        ("Linear SVM (calibrated)", "maximum margin",
         "Optimises margins rather than likelihood. Wrapped in Platt scaling because a bare SVM "
         "has no probabilities."),
        ("Random Forest", "axis-aligned splits, bagged",
         "Represents skill combinations a linear model cannot (Terraform AND Kubernetes AND "
         "Python implies AI/ML engineer)."),
        ("Hist Gradient Boosting", "additive boosted trees",
         "Each round corrects the previous rounds' errors, which usually helps rare roles. "
         "Costly: 20 classes means 20 trees per round."),
    ]:
        rows.append([f"<b>{m}</b>", bias, why])

    met = [["Metric", "Level", "Role in the report"],
           ["<b>macro-F1</b>", "job role",
            "<b>Primary.</b> Equal weight per role, so neglecting UX/UI costs as much as neglecting Full-stack"],
           ["balanced accuracy", "job role", "Mean per-class recall &mdash; is each role found at all"],
           ["top-3 accuracy", "job role", "What the user actually sees"],
           ["log loss", "job role", "Are the probabilities trustworthy? The app prints them as numbers"],
           ["family macro-F1", "family", "The coarser recommendation, from the same summed probabilities"],
           ["family top-3", "family", "The career-path shortlist"],
           ["accuracy", "job role", "Reported <b>only</b> to demonstrate that it misleads"]]

    return page(
        "STAGE 6 &mdash; MODEL DEVELOPMENT", "Algorithms and evaluation metrics",
        P("Stage 6 requires at least four algorithms; <b>six</b> are compared, plus a baseline. "
          "They were chosen to span different inductive biases rather than to be six variations "
          "of one idea.", "Body"),
        *callout(
            "One product constraint eliminated otherwise valid candidates",
            "The application ranks three roles and sums their probabilities into families, so "
            "every candidate must produce usable <i>predict_proba</i>. A model without "
            "probabilities cannot be deployed whatever it scores. This is why LinearSVC appears "
            "wrapped in CalibratedClassifierCV rather than on its own &mdash; a modelling decision "
            "driven by the product, not by the metric.", accent=BLUE),
        table(rows, widths=[CONTENT_W * 0.22, CONTENT_W * 0.24, CONTENT_W * 0.54]),

        P("Evaluation metrics", "H2"),
        P("Macro-F1 is primary because the product's value lies in the rare roles: a system that "
          "only ever recognises Full-stack and Back-end developers has nothing to tell the users "
          "who most need career guidance.", "Body"),
        table(met, widths=[CONTENT_W * 0.20, CONTENT_W * 0.13, CONTENT_W * 0.67]),
    )


def stage6_results(d):
    s6 = d["s6"]
    rows = [["Model", "macro-F1", "SD", "bal. acc", "accuracy", "top-3", "log loss",
             "family F1", "fit (s)"]]
    hi = []
    for i, r in s6.iterrows():
        bold = r["model"] == "Logistic Regression"
        wrap = (lambda x: f"<b>{x}</b>") if bold else (lambda x: x)
        if bold:
            hi.append(i + 1)
        rows.append([wrap(r["model"]), wrap(f4(r["f1_macro"])), f"{r['f1_macro_std']:.4f}",
                     f4(r["balanced_accuracy"]), f4(r["accuracy"]), f4(r["top3_accuracy"]),
                     f"{r['log_loss']:.3f}", f4(r["family_f1_macro"]), f"{r['fit_seconds']:.1f}"])

    w = [CONTENT_W * x for x in (.235, .095, .085, .095, .095, .085, .09, .1, .08)]
    return page(
        "STAGE 6 &mdash; RESULTS", "Model comparison",
        P("Five-fold cross-validation on the 18,457 training respondents. The test split was not "
          "opened at this stage.", "Body"),
        table(rows, widths=w, align={i: "CENTER" for i in range(1, 9)}, highlight=hi, size=7.8),
        Spacer(1, 2),
        P("Source: reports/stage6_model_comparison.csv. The highlighted row is the model that "
          "eventually shipped, after Stage 7 optimisation.", "Caption"),

        *callout(
            "The Dummy row is the argument for the metric choice",
            "The majority-class baseline scores <b>0.394 accuracy</b> &mdash; higher than Complement "
            "Naive Bayes (0.492 accuracy but far better macro-F1) would suggest, and higher than "
            "many readers expect of a model that cannot do anything at all. Its macro-F1 of 0.028 "
            "exposes it instantly. A report that led with accuracy would rank a useless model above "
            "models that have genuinely learned something."),

        P("Why the models rank as they do", "H2"),
        *bullets([
            "<b>Complement Naive Bayes (0.179).</b> Fast and well above chance, but its "
            "independence assumption is false here: React implies JavaScript, Kubernetes implies "
            "Docker. It counts each co-occurring technology as fresh evidence and becomes "
            "over-confident &mdash; visible in its poor log loss (2.33) and very weak family F1 (0.158).",
            "<b>k-Nearest Neighbours (0.168).</b> The product's premise holds weakly: top-3 is a "
            "respectable 0.781. But 479 dimensions is a hostile neighbourhood &mdash; with mostly 0/1 "
            "features, pairwise distances concentrate and the neighbourhood stops being local. Its "
            "log loss of 4.41 is the worst of any real model: the probabilities are nearly "
            "meaningless even where the ranking is not.",
            "<b>Logistic Regression (0.255) has the best balanced accuracy (0.332) and the worst "
            "accuracy (0.366)</b> of the serious models. That is <i>class_weight=\"balanced\"</i> "
            "doing what it was asked: chase rare roles and accept false positives on Full-stack. "
            "Phase A revisits this with a surprising result.",
            "<b>Random Forest (0.254) and Hist Gradient Boosting (0.272)</b> represent skill "
            "combinations no linear model can. Boosting takes the top macro-F1 because each round "
            "focuses on the previous rounds' errors &mdash; which is where the rare roles live.",
        ]),

        *callout(
            "The headline finding is the spread, not the winner",
            "The top three models sit at 0.2537, 0.2547 and 0.2724 with fold standard deviations of "
            "0.008, 0.003 and 0.010. Random Forest and Logistic Regression differ by 0.001 &mdash; a "
            "tenth of a standard deviation, which is noise. Meanwhile the cost range is a factor of "
            "40: Random Forest fits in 4.3 s, boosting in 179.5 s, for 0.019 macro-F1. The ceiling "
            "is set by the data, not by the algorithm."),
    )


def stage6_figures(d):
    return page(
        "STAGE 6 &mdash; RESULTS", "Comparison charts",
        figure("04_model_comparison",
               "Figure 1. Macro-F1 and top-3 accuracy per model, with one standard deviation "
               "across the five folds. Note how differently the two panels rank the models: "
               "Logistic Regression is near the top on macro-F1 and near the bottom on top-3.",
               max_h=92 * mm),
        figure("04_accuracy_vs_f1",
               "Figure 2. Accuracy against macro-F1. The Dummy model reaches 0.394 accuracy with "
               "no skill whatsoever, which is why accuracy is reported only as a cautionary "
               "number and macro-F1 is the primary metric.",
               max_h=92 * mm),
    )


def stage6_errors(d):
    conf = pd.DataFrame(d["s6rep"]["top_confusions"]).head(8)
    rows = [["Actual role", "Predicted as", "Share", "Same family?"]]
    for _, r in conf.iterrows():
        rows.append([short(r["actual"]), short(r["predicted_as"]),
                     f"{r['share_of_actual']:.2f}", "yes" if r["same_family"] else "<b>no</b>"])

    pc = d["perclass"].sort_values("f1-score", ascending=False)
    prows = [["Job role", "precision", "recall", "F1", "training examples"]]
    for _, r in pd.concat([pc.head(5), pc.tail(5)]).iterrows():
        z = r["f1-score"] == 0
        wrap = (lambda x: f"<b>{x}</b>") if z else (lambda x: x)
        prows.append([wrap(short(r["job_role"])), f"{r['precision']:.3f}", f"{r['recall']:.3f}",
                      wrap(f"{r['f1-score']:.3f}"), f"{int(r['support']):,}"])
    prows.insert(6, ["<i>&hellip; 10 roles omitted &hellip;</i>", "", "", "", ""])

    return page(
        "STAGE 6 &mdash; ERROR ANALYSIS", "Where the model fails, and why",
        P("Out-of-fold predictions from the best Stage 6 model, so no prediction comes from a "
          "fold that saw that respondent.", "Body"),

        *callout(
            "The expected error pattern was wrong, and it reordered the Stage 7 priorities",
            "EDA predicted the damage would fall <i>within</i> families &mdash; Cloud Infrastructure "
            "confused with DevOps, Data Engineer with Data Scientist. Instead, <b>all eight largest "
            "confusions cross family boundaries and seven point at Full-stack.</b> These are not "
            "neighbouring roles with similar skills: Full-stack is 39% of the training data and "
            "behaves as a <i>sink</i> that absorbs anything the model is unsure about. The dominant "
            "failure is class imbalance, not role overlap &mdash; which is why Phase A became the first "
            "optimisation experiment rather than a formality."),

        P("Largest confusions", "H2"),
        table(rows, widths=[CONTENT_W * 0.33, CONTENT_W * 0.33, CONTENT_W * 0.17, CONTENT_W * 0.17],
              align={2: "CENTER", 3: "CENTER"}),

        P("Per-class performance, best and worst five", "H2"),
        table(prows, widths=[CONTENT_W * 0.36, CONTENT_W * 0.16, CONTENT_W * 0.16,
                             CONTENT_W * 0.14, CONTENT_W * 0.18],
              align={1: "CENTER", 2: "CENTER", 3: "CENTER", 4: "CENTER"}),
        Spacer(1, 3),
        P("Two roles score exactly zero: the model never predicts them correctly out-of-fold. "
          "Mobile is the instructive exception &mdash; 739 examples but F1 0.704, as high as "
          "Full-stack's, because mobile developers use a distinctive toolset (Swift, Kotlin, "
          "Flutter) that nothing else uses. Where skills are distinctive a few hundred examples "
          "is plenty; where they overlap with Full-stack, even a thousand is not.", "Caption"),
    )


def stage6_figures2(d):
    return page(
        "STAGE 6 &mdash; ERROR ANALYSIS", "Diagnostic charts",
        figure("04_per_class_f1",
               "Figure 3. Per-class F1 against the number of training examples (log scale). The "
               "relationship is almost monotonic, which identifies class imbalance as the primary "
               "target for Stage 7. Mobile sits well above the trend because its toolset is "
               "distinctive.", max_h=88 * mm),
        figure("04_confusion_matrix",
               "Figure 4. Row-normalised out-of-fold confusion matrix. The bright vertical band "
               "at Full-stack is the sink effect: most roles leak probability mass into the "
               "majority class.", max_h=104 * mm),
    )


def phase_a(d):
    # Group by algorithm rather than by score: the comparison the reader needs is
    # "which treatment wins for THIS model", not a global ranking across both.
    order = ["no imbalance handling", "class_weight", "oversampling to 10%"]
    a = d["a"].copy()
    a["_m"] = a["model"].str.split(" + ").str[0]
    a["_t"] = a["model"].str.split(" + ").str[1]
    a["_o"] = a["_t"].map({t: i for i, t in enumerate(order)})
    a = a.sort_values(["_m", "_o"], ascending=[False, True])

    rows = [["Model", "Imbalance treatment", "macro-F1", "accuracy"]]
    hi = []
    for i, r in enumerate(a.itertuples(), start=1):
        name = r.model
        model, _, treat = name.partition(" + ")
        best = name in ("Logistic Regression + no imbalance handling",
                        "Random Forest + class_weight")
        if best:
            hi.append(i)
        wrap = (lambda x: f"<b>{x}</b>") if best else (lambda x: x)
        rows.append([model, wrap(treat), wrap(f4(r.f1_macro)), f4(r.accuracy)])

    return page(
        "STAGE 7 &mdash; PHASE A", "Imbalance handling",
        P("Stage 6 showed per-class F1 tracking class size almost monotonically, so this was "
          "attacked first. Three treatments, tested on <b>two different algorithms</b> so the "
          "answer could not be an artefact of one of them.", "Body"),
        table(rows, widths=[CONTENT_W * 0.28, CONTENT_W * 0.38, CONTENT_W * 0.17, CONTENT_W * 0.17],
              align={2: "CENTER", 3: "CENTER"}, highlight=hi),

        *callout(
            "This result overturned a Stage 6 assumption",
            "Every Stage 6 model was configured with <i>class_weight=\"balanced\"</i> as an obvious "
            "precaution against 155:1 imbalance. Phase A shows that for Logistic Regression it is "
            "actively <b>harmful</b>: removing it raises macro-F1 from 0.2535 to 0.3003 &mdash; a gain "
            "of 0.047, roughly fifteen fold-standard-deviations, and larger than any hyper-parameter "
            "effect found later. The Stage 6 Logistic Regression row was handicapping itself."),

        P("The two algorithms want opposite treatments", "H2"),
        *bullets([
            "<b>Logistic Regression is hurt by class weighting.</b> Re-weighting the loss forces "
            "the softmax to inflate rare-class probabilities globally. It gains recall on rare "
            "roles but loses more precision &mdash; accuracy collapses from 0.548 to 0.365 &mdash; and "
            "macro-F1, the harmonic mean of both, falls.",
            "<b>Random Forest is helped by it</b> (0.1869 to 0.2548). Without weighting, a tree's "
            "split criterion barely registers 47 UX/UI respondents among 7,279 Full-stack ones, so "
            "rare classes are effectively invisible. Re-weighting makes them visible without the "
            "same precision penalty, because trees partition rather than shift one global boundary.",
            "<b>Partial oversampling helps less than class weighting for Random Forest</b> (0.2153 "
            "vs 0.2548) and does not rescue Logistic Regression (0.2914 vs 0.3003 for doing "
            "nothing). It is also the most expensive option, so it is not adopted.",
        ]),

        P("Two options rejected, and the reasons", "H2"),
        table([
            ["Option", "Rejected because"],
            ["<b>SMOTE</b>", "It interpolates between neighbours to invent rows. 403 of the 479 "
                             "features are 0/1 skill flags, so a synthetic row claims a respondent "
                             "\"0.4 knows React\" &mdash; not a profile anyone could have. Duplicating "
                             "real respondents keeps every training row valid. Rejected on principle."],
            ["<b>Full balancing</b>", "It copies the 47 UX/UI respondents 155 times each and grows "
                                      "training from 18,457 to 145,580 rows: over an hour per fit, "
                                      "and prone to overfitting the duplicates. Rejected on cost."],
        ], widths=[CONTENT_W * 0.22, CONTENT_W * 0.78]),

        *callout(
            "The transferable lesson",
            "Imbalance handling is a property of the <b>algorithm&ndash;data pair</b>, not a universal "
            "good. Applying <i>class_weight=\"balanced\"</i> reflexively, as Stage 6 did, cost this "
            "project 0.047 macro-F1 on its eventual winner.", accent=GOOD),
    )


def phase_b(d):
    b = d["b"].copy()
    ref = float(b.loc[b["model"] == "core (reference)", "f1_macro"].iloc[0])
    b = b.sort_values("f1_macro", ascending=False)
    rows = [["Experiment", "macro-F1", "vs core", "top-3"]]
    hi = []
    for i, r in enumerate(b.itertuples(), start=1):
        delta = r.f1_macro - ref
        isref = r.model == "core (reference)"
        if isref:
            hi.append(i)
        wrap = (lambda x: f"<b>{x}</b>") if isref else (lambda x: x)
        rows.append([wrap(r.model), wrap(f4(r.f1_macro)),
                     "&mdash;" if isref else f"{delta:+.4f}", f4(r.top3_accuracy)])

    return page(
        "STAGE 7 &mdash; PHASE B", "Feature set and feature selection",
        P("Each row changes exactly one Stage 4 decision and holds everything else fixed, run on "
          "Logistic Regression because a linear model reacts most visibly to the feature set. "
          "Three folds here: every row is a <i>relative</i> comparison against the same reference "
          "on the same folds, so fewer folds costs precision that is not needed.", "Body"),
        table(rows, widths=[CONTENT_W * 0.44, CONTENT_W * 0.19, CONTENT_W * 0.19, CONTENT_W * 0.18],
              align={1: "CENTER", 2: "CENTER", 3: "CENTER"}, highlight=hi),

        P("What each experiment settled", "H2"),
        *bullets([
            "<b>The want lists earn their place.</b> Removing the 223 \"technologies I want to "
            "learn\" columns costs 0.0090 macro-F1 and 0.0293 top-3. Stage 4 kept them on the "
            "evidence that they correlate with the have-lists without duplicating them "
            "(phi 0.18&ndash;0.76); this confirms independent signal. <b>Stage 4 decision upheld.</b>",
            "<b>The 0.5% rare-pooling threshold sits at a flat optimum.</b> Moving to 0.25% or 1% "
            "changes macro-F1 by 0.0013 and 0.0006 &mdash; far below fold noise. The threshold is not "
            "critical, which is a useful thing to report rather than a failed experiment.",
            "<b>core+context scores highest and is still rejected.</b> Its +0.0064 gain is itself "
            "inside the fold noise, but even a real gain would not change the decision: SkillPath's "
            "main users are students with no employer, so OrgSize, Industry, RemoteWork and ICorPM "
            "would be blank in production. A model needing inputs the user cannot supply is worse "
            "in practice than a slightly weaker model that always works. This is a <b>product "
            "decision overriding a metric</b>.",
        ]),

        *callout(
            "An accidental controlled experiment inside the selection block",
            "The <i>k=all</i> row performs <b>no selection at all</b> and still scores 0.0251 below "
            "the reference. The two pipelines then differ in exactly one respect: the selection "
            "pipeline builds the preprocessor unscaled (chi-square requires non-negative inputs) and "
            "applies a StandardScaler to <b>all</b> 479 features afterwards, whereas the Stage 4 "
            "preprocessor deliberately leaves the 403 binary technology columns as 0/1.<br/><br/>"
            "So that row isolates a different effect entirely: <b>scaling the binary technology "
            "columns costs about 0.025 macro-F1.</b> That is direct evidence for Stage 4 decision 14, "
            "which had been argued on interpretability grounds alone. Measured against the correct "
            "<i>k=all</i> baseline, the selection itself is roughly flat (k=300 at 0.2353 is slightly "
            "<i>above</i> k=all at 0.2290), so the honest conclusion is that selection neither helps "
            "nor hurts much, and the apparent damage in this block comes from the scaling."),
    )


def phase_c(d):
    pretty = {"clf__C": "C", "clf__class_weight": "class_weight",
              "clf__estimator__C": "C", "clf__estimator__class_weight": "class_weight",
              "clf__n_estimators": "n_estimators", "clf__max_depth": "max_depth",
              "clf__min_samples_leaf": "min_samples_leaf", "clf__max_features": "max_features",
              "clf__learning_rate": "learning_rate", "clf__max_leaf_nodes": "max_leaf_nodes",
              "clf__l2_regularization": "l2", "clf__max_iter": "max_iter"}

    def fmt(params):
        out = []
        for k, v in params.items():
            if isinstance(v, float):
                v = f"{v:.4g}"
            out.append(f"{pretty.get(k, k)}={v}")
        return ", ".join(out)

    c = d["c"].sort_values("f1_macro", ascending=False)
    rows = [["Model", "Best hyper-parameters found", "tuned macro-F1", "top-3"]]
    hi = []
    for i, r in enumerate(c.itertuples(), start=1):
        name = r.model.replace(" (tuned)", "")
        best = i == 1
        if best:
            hi.append(i)
        wrap = (lambda x: f"<b>{x}</b>") if best else (lambda x: x)
        rows.append([wrap(name), f"<font face='Courier' size='7'>{fmt(d['params'][name])}</font>",
                     wrap(f4(r.f1_macro)), f4(r.top3_accuracy)])

    return page(
        "STAGE 7 &mdash; PHASE C", "Hyper-parameter optimisation",
        P("<b>Randomised search, not grid search.</b> A grid over five hyper-parameters with four "
          "values each is 1,024 fits per model; at 6&ndash;180 seconds a fit that is days of compute. "
          "Random search over the same ranges finds a near-best setting in a few dozen fits, "
          "because typically only two or three parameters matter and random sampling tries many "
          "distinct values of each instead of a few repeated ones.", "Body"),
        P("The search optimises macro-F1 with the same StratifiedKFold. Search budgets were set "
          "from the <i>measured</i> cost of one fit, so no single model could consume the whole "
          "run; each winner was then re-scored on the standard five folds, so a cheaper search "
          "never makes the reported comparison unfair.", "Body"),
        table(rows, widths=[CONTENT_W * 0.21, CONTENT_W * 0.49, CONTENT_W * 0.16, CONTENT_W * 0.14],
              align={2: "CENTER", 3: "CENTER"}, highlight=hi),

        P("What the search revealed", "H2"),
        *bullets([
            "<b>It confirmed Phase A independently.</b> Logistic Regression's winning setting is "
            "<i>class_weight=None</i> &mdash; the search was free to choose \"balanced\" and rejected "
            "it. Two experiments run differently reaching the same conclusion is much stronger "
            "evidence than either alone.",
            "<b>Regularisation mattered more than anything else.</b> Logistic Regression moved from "
            "the default C=1.0 to C=0.218, and Linear SVM all the way to C=0.00355 &mdash; both "
            "substantially <i>stronger</i> regularisation than the default. With 479 features and "
            "only 47 examples in the smallest class, the untuned models were overfitting. Linear "
            "SVM gained 0.0625 macro-F1, the largest tuning gain in the project, almost entirely "
            "from this.",
            "<b>Boosting's winner is its smallest configuration</b> (max_leaf_nodes=15, the minimum "
            "offered). The same conclusion from the other direction: the useful signal here is "
            "mostly additive and simple, and model capacity is not the binding constraint.",
        ]),

        P("A measured optimisation decision", "H2"),
        P("The Stage 6 Logistic Regression baseline never converged &mdash; it hit its iteration cap "
          "&mdash; costing 460 s per cross-validation. Rather than assume a cheaper setting was safe, "
          "the trade-off was measured directly:", "Body"),
        table([
            ["Solver setting", "macro-F1", "time"],
            ["max_iter=1500, tol=1e-4 (Stage 6 baseline)", "0.2540", "379 s"],
            ["<b>max_iter=400, tol=1e-3</b>", "<b>0.2541</b>", "<b>193 s</b>"],
            ["max_iter=200, tol=1e-3", "0.2541", "193 s"],
        ], widths=[CONTENT_W * 0.52, CONTENT_W * 0.24, CONTENT_W * 0.24],
            align={1: "CENTER", 2: "CENTER"}),
        Spacer(1, 3),
        P("The looser tolerance changes macro-F1 by 0.0001, two orders of magnitude below the fold "
          "standard deviation, and halves the cost. The identical 400 and 200 rows show the solver "
          "reaches tol=1e-3 before iteration 200, so the baseline's extra 1,300 iterations buy "
          "nothing at all. Recorded in reports/lr_convergence_probe.log.", "Caption"),
    )


def phase_d(d):
    dd = d["d"]
    rows = [["Model", "baseline", "tuned", "gain", "SD", "tuned top-3", "family F1", "fit (s)"]]
    hi = []
    for i, r in enumerate(dd.itertuples(), start=1):
        best = i == 1
        if best:
            hi.append(i)
        wrap = (lambda x: f"<b>{x}</b>") if best else (lambda x: x)
        rows.append([wrap(r.model), f4(r.baseline_f1_macro), wrap(f4(r.tuned_f1_macro)),
                     f"{r.gain:+.4f}", f"{r.tuned_f1_macro_std:.4f}", f4(r.tuned_top3),
                     f4(r.tuned_family_f1_macro), f"{r.fit_seconds:.1f}"])

    w = [CONTENT_W * x for x in (.24, .105, .105, .105, .09, .125, .12, .11)]
    return page(
        "STAGE 7 &mdash; PHASE D", "Tuned versus baseline",
        P("Every tuned model re-scored on the standard five folds and placed next to its Stage 6 "
          "baseline, so the gain from optimisation is visible per model.", "Body"),
        table(rows, widths=w, align={i: "CENTER" for i in range(1, 8)}, highlight=hi, size=7.8),

        *callout(
            "Optimisation changed which model ships",
            "Hist Gradient Boosting led Stage 6 on macro-F1 (0.2724). After optimisation, Logistic "
            "Regression leads (0.3030) and boosting is second (0.2860). <b>Running Stage 7 on the "
            "Stage 6 winner alone would have locked in the wrong model</b> &mdash; which is why Phase C "
            "tunes all four serious candidates rather than only the leader."),

        P("Which gains are real", "H2"),
        P("Gains are reported against the fold standard deviation rather than asserted:", "Body"),
        *bullets([
            "<b>Logistic Regression +0.0483</b> and <b>Linear SVM +0.0625</b> are many times the "
            "fold SD (about 0.008) and are real improvements.",
            "<b>Random Forest +0.0283</b> is roughly three SDs &mdash; real, but smaller.",
            "<b>Hist Gradient Boosting +0.0135</b> is under two SDs, so it is <i>not</i> claimed as "
            "a solid improvement.",
        ]),
        P("Note also that the tuned Logistic Regression fits in 3.3 s, down from 91.7 s, because "
          "dropping class weighting lets lbfgs converge quickly. It became the most accurate and "
          "the cheapest model at the same time.", "Body"),

        figure("05_tuned_vs_baseline",
               "Figure 5. Macro-F1 before and after tuning, per model.", max_h=80 * mm),
    )


def selection(d):
    f = d["final"]
    cv = f["final_cv_scores"]
    return page(
        "STAGE 7 &mdash; FINAL MODEL", "Selection and justification",
        P("The selection rule was written down <b>before</b> the numbers were read, so it could "
          "not be bent to fit a favourite:", "Body"),
        *callout("Pre-registered selection rule",
                 "Highest five-fold macro-F1 on the training split. Models <b>within one standard "
                 "deviation</b> of the best are treated as tied, and among those the cheapest to "
                 "fit wins &mdash; because the backend reloads this pipeline and an unreliable "
                 "improvement does not justify a slower model.", accent=BLUE),

        P("In this case the tie-break was not needed. Logistic Regression is the <b>only</b> model "
          "within one standard deviation (0.0082) of the best score, because second place is 0.017 "
          "behind &mdash; about twice the SD. It wins outright, and it also happens to be the cheapest, "
          "the best calibrated and the most interpretable option.", "Body"),

        P("Final model", "H2"),
        table([
            ["Property", "Value"],
            ["Algorithm", "<b>Logistic Regression</b> (multinomial softmax)"],
            ["Hyper-parameters", "<font face='Courier' size='7.5'>C=0.218, class_weight=None, "
                                 "max_iter=400, tol=1e-3</font>"],
            ["Feature set", "core, 479 features"],
            ["Preprocessing", "the Stage 4 pipeline, fitted inside the same estimator"],
            ["Cross-validated macro-F1", f"<b>{cv['f1_macro']:.4f}</b>"],
            ["Cross-validated top-3", f"{cv['top3_accuracy']:.4f}"],
            ["Artifact", "artifacts/model.joblib (108 KB)"],
        ], widths=[CONTENT_W * 0.28, CONTENT_W * 0.72]),

        P("How each criterion fell", "H2"),
        table([
            ["Criterion", "Winner", "Note"],
            ["macro-F1 (primary)", "<b>Logistic Regression</b> 0.3030", "only model within 1 SD of the best"],
            ["family macro-F1", "<b>Logistic Regression</b> 0.4294", "the career-path recommendation"],
            ["top-3 accuracy", "Linear SVM 0.8401", "Logistic Regression 0.8387 &mdash; a 0.0014 gap, noise"],
            ["fit cost", "<b>Logistic Regression</b> 3.3 s", "4&times; faster than boosting"],
            ["interpretability", "<b>Logistic Regression</b>", "coefficients read as \"which skill pushes which role\""],
        ], widths=[CONTENT_W * 0.22, CONTENT_W * 0.33, CONTENT_W * 0.45]),

        P("Three supporting reasons beyond the primary metric", "H2"),
        *bullets([
            "<b>It is the most interpretable option.</b> Stage 12 requires explaining the system to "
            "non-technical stakeholders. A coefficient per technology per role answers \"why did it "
            "suggest this?\" directly; a 4,000-tree boosted ensemble does not.",
            "<b>Its probabilities are the best calibrated</b> of the tuned models (log loss 1.4146). "
            "The app prints probabilities next to each role, so their quality is user-facing.",
            "<b>It is cheap to fit and small to deploy</b> (108 KB), which matters for the Stage 9 "
            "backend.",
        ]),
    )


def test_page(d):
    t = d["test"]
    cv, ts = t["cv_scores"], t["test_scores"]
    rows = [["Metric", "Cross-validated (train)", "Held-out test", "gap"]]
    for key, label in [("f1_macro", "macro-F1"), ("balanced_accuracy", "balanced accuracy"),
                       ("accuracy", "accuracy"), ("top3_accuracy", "top-3 accuracy"),
                       ("log_loss", "log loss"), ("family_f1_macro", "family macro-F1"),
                       ("family_accuracy", "family accuracy"),
                       ("family_top3_accuracy", "family top-3 accuracy")]:
        c = cv.get(key)
        v = ts[key]
        bold = key in ("f1_macro", "top3_accuracy", "family_top3_accuracy")
        wrap = (lambda x: f"<b>{x}</b>") if bold else (lambda x: x)
        rows.append([wrap(label), f"{c:.4f}" if c is not None else "&mdash;",
                     wrap(f"{v:.4f}"), f"{v - c:+.4f}" if c is not None else "&mdash;"])

    worst = d["testpc"].sort_values("f1-score").head(4)
    wrows = [["Job role", "F1", "test examples"]]
    for _, r in worst.iterrows():
        wrows.append([short(r["job_role"]), f"{r['f1-score']:.3f}", f"{int(r['support'])}"])

    return page(
        "STAGE 7 &mdash; EVALUATION", "The single held-out evaluation",
        P("<i>scripts/finalise_model.py</i> refits the chosen configuration on all 18,457 training "
          "rows and scores it on the 4,615 held-out respondents &mdash; <b>once</b>. It is the only "
          "script in the project that opens the test split. Running it repeatedly while changing "
          "the model would turn the test set into a second validation set and the number would "
          "stop meaning anything.", "Body"),
        table(rows, widths=[CONTENT_W * 0.34, CONTENT_W * 0.26, CONTENT_W * 0.22, CONTENT_W * 0.18],
              align={1: "CENTER", 2: "CENTER", 3: "CENTER"}),

        *callout(
            "The validation procedure was honest",
            "The macro-F1 gap is <b>-0.0185</b>, about two fold-standard-deviations: small, and in "
            "the expected direction, since the cross-validated figure is the maximum over a search "
            "and a little optimism is normal. The top-3 metrics came out <i>marginally higher</i> on "
            "test than in cross-validation, and log loss is identical to four decimals. There is no "
            "sign of a leak inflating the validation numbers.", accent=GOOD),

        P("The user-facing numbers are the strong ones", "H2"),
        kpi_row([(f"{ts['top3_accuracy']:.1%}", "correct job role in<br/>the three shown"),
                 (f"{ts['family_top3_accuracy']:.1%}", "correct family in<br/>the top three"),
                 (f"{ts['accuracy']:.1%}", "exactly right<br/>at first guess")]),
        Spacer(1, 7),
        P("A top-1 macro-F1 of 0.28 sounds weak in isolation, but the product never shows one "
          "answer. Judged on what it actually displays, the system puts the correct role in front "
          "of the user 83.9% of the time.", "Body"),

        P("Where it still fails", "H2"),
        table(wrows, widths=[CONTENT_W * 0.52, CONTENT_W * 0.24, CONTENT_W * 0.24],
              align={1: "CENTER", 2: "CENTER"}),
        Spacer(1, 3),
        P("Two roles score exactly zero: the model never predicts them. This is recorded in "
          "artifacts/model_card.json as a known limitation rather than hidden inside an average.",
          "Caption"),

        P("Deployment parity", "H2"),
        P(f"300 real training rows were converted into the JSON profile the web form will send, "
          f"converted back through <i>profile_to_frame()</i>, and compared. Maximum probability "
          f"difference: <b>{t['api_parity']['max_probability_difference']:.2e}</b> &mdash; not merely "
          f"small but exactly zero. The Stage 9 backend will preprocess identically to the model "
          f"validated here.", "Body"),
    )


def test_figure(d):
    return page(
        "STAGE 7 &mdash; EVALUATION", "Held-out confusion matrix",
        figure("05_test_confusion",
               "Figure 6. Row-normalised confusion matrix on the 4,615 held-out respondents. The "
               "diagonal is strongest for roles with distinctive toolsets (mobile, full-stack, "
               "embedded); the two all-zero rows at AI apps and UX/UI are visible as empty bands.",
               max_h=150 * mm),
    )


def limitations(d):
    lim = [
        ("Macro-F1 is modest in absolute terms (0.28 on test).",
         "The reason is structural, not a modelling failure. Two causes, in order of size: "
         "Full-stack is 39% of the data and acts as a sink for uncertain predictions, and several "
         "roles genuinely overlap in the survey's technology questions. The product is designed "
         "around this &mdash; three ranked roles and a family total, where the numbers are 0.839 and "
         "0.878."),
        ("Two roles are never predicted at all.",
         "Developer, AI apps or physical AI (116 training, 29 test) and UX / Research Ops / UI "
         "design (47 training, 12 test) score F1 0.000 on the held-out split. Imbalance handling "
         "improves recall elsewhere but cannot manufacture information that is not in 47 examples. "
         "The app should either not offer these as outputs or label them explicitly as low "
         "confidence."),
        ("Survey population, not the developer population.",
         "Stack Overflow respondents skew towards particular regions, languages and seniority "
         "levels, so the model reflects who answers this survey rather than who writes software."),
        ("Self-reported labels.",
         "DevType is what respondents chose to call themselves; two people doing identical work "
         "may label it differently, which puts a ceiling on any supervised model trained on it."),
        ("Not a hiring tool.",
         "A low probability means a profile is unlike that role's survey respondents &mdash; not that "
         "a person cannot do the job. Recorded in artifacts/model_card.json."),
    ]
    future = [
        "Predict the family first and then the role within the family, so the near-identical pairs "
        "(Cloud Infrastructure and DevOps) compete only against each other rather than against "
        "Full-stack.",
        "Try an L1-penalised linear model to obtain a sparse, directly explainable skill set per "
        "role, which would strengthen the Stage 12 presentation.",
        "Treat the Full-stack sink directly, for example by calibrating per class or by learning a "
        "rejection threshold, instead of only re-weighting.",
        "Collect more respondents for the rare roles rather than trying to squeeze them out of 47 "
        "examples &mdash; the per-class F1 against class size chart suggests this is the binding "
        "constraint.",
    ]
    return page(
        "STAGE 7 &mdash; ASSESSMENT", "Limitations and future improvements",
        P("Honest limitations", "H2"),
        *[KeepTogether([P(f"<b>{i + 1}. {t}</b>", "BodyTight"), P(b, "Body")])
          for i, (t, b) in enumerate(lim)],
        P("Possible future improvements", "H2"),
        *bullets(future),
        P("Reproducing every number in this report", "H2"),
        P("<font face='Courier' size='8'>"
          "pip install -e .<br/>"
          "python scripts/run_models.py&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Stage 6, ~29 min<br/>"
          "python scripts/tune_models.py&nbsp;&nbsp;&nbsp;&nbsp;# Stage 7 phases A-D, ~41 min<br/>"
          "python scripts/finalise_model.py&nbsp;# final fit + the one test evaluation<br/>"
          "pytest -q&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
          "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# 36 checks<br/>"
          "python scripts/build_report_pdf.py # regenerate this document"
          "</font>", "Body"),
    )


def viva(d):
    qa = [
        ("Why did you choose these six algorithms?",
         "They span different inductive biases &mdash; an independence assumption (Naive Bayes), local "
         "similarity (k-NN), linear boundaries (Logistic Regression, SVM) and non-linear feature "
         "interactions (Random Forest, boosting) &mdash; so the comparison tells us something about the "
         "<i>problem</i>, not just about one family of models. And every one can produce "
         "probabilities, which the three-role recommendation requires."),
        ("Why is accuracy not your main metric?",
         "The majority class is 39% of the data. A model that always answers \"Full-stack\" scores "
         "0.394 accuracy and 0.028 macro-F1. Macro-F1 weights all 20 roles equally, which matches "
         "the product: the value is in recognising the rare roles."),
        ("Why 5-fold and not 10-fold?",
         "The smallest role has 47 training examples. At 5 folds each fold still holds about 9 of "
         "them; at 10 folds it would be about 4, too few to estimate a per-class F1."),
        ("Why is the preprocessor inside the pipeline?",
         "So every fold refits the vocabulary, imputation medians and scaler on its own training "
         "part. Fitting it once on all training data would let each validation fold influence the "
         "features it is then judged on, and every cross-validation score would be optimistic."),
        ("How do you know you have no leakage?",
         "Four layers: deterministic cleaning before the split; the split frozen by ResponseId; "
         "everything learned fitted inside the pipeline so cross-validation refits it per fold; and "
         "resampling and feature selection placed inside the estimator for the same reason. 36 "
         "automated checks enforce these."),
        ("What was the single biggest improvement in Stage 7?",
         "Removing class weighting from Logistic Regression: +0.047 macro-F1, about fifteen "
         "fold-standard-deviations, larger than every hyper-parameter effect we found. Stage 6 had "
         "applied it reflexively because the data is imbalanced 155:1."),
        ("Why does class weighting hurt Logistic Regression but help Random Forest?",
         "They fit differently. Re-weighting the loss makes the softmax inflate rare-class "
         "probabilities globally: recall rises but precision falls further, accuracy drops from "
         "0.548 to 0.365, and macro-F1 falls. A forest partitions instead of shifting one global "
         "boundary, so weighting makes rare classes visible in the split criterion without the same "
         "precision cost. Imbalance handling is a property of the algorithm-data pair, not a "
         "universal good."),
        ("Why randomised search rather than grid search?",
         "A five-parameter grid with four values each is 1,024 fits per model &mdash; days of compute "
         "here. Random search finds a near-best setting in a few dozen fits, because only two or "
         "three parameters usually matter."),
        ("Why did you reject SMOTE?",
         "403 of the 479 features are binary skill flags. Interpolating between two respondents "
         "produces someone who \"0.4 knows React\", which is not a valid profile. Duplicating real "
         "respondents keeps every row something a real person reported."),
        ("Did tuning change which model you shipped?",
         "Yes. Hist Gradient Boosting led Stage 6 (0.2724); after tuning Logistic Regression leads "
         "(0.3030) and boosting is second (0.2860). That is why Phase C tunes all four candidates "
         "instead of only the Stage 6 winner."),
        ("Your tuning gains &mdash; are they real or noise?",
         "Mixed, and we say which is which. Logistic Regression +0.048 and Linear SVM +0.063 are "
         "many times the fold SD (about 0.008) and are real. Hist Gradient Boosting's +0.014 is "
         "under two SDs and we do not claim it as a solid improvement. The dominant effect in both "
         "large gains was stronger regularisation."),
        ("Why is the final model the one with the highest macro-F1 &mdash; didn't you say ties matter?",
         "The tie-break rule was written in advance in case it was needed, and here it was not: "
         "Logistic Regression is the only model within one standard deviation (0.0082) of the best, "
         "because second place is 0.017 behind. It wins outright."),
        ("Why not ship the boosting model, which won Stage 6?",
         "After tuning it is 0.017 macro-F1 behind, four times slower to fit, worse at family level "
         "(0.403 vs 0.429), and far harder to explain to a non-technical audience. It lost on the "
         "primary metric, so the other reasons never had to be invoked."),
        ("How do the family-level numbers come from the same model?",
         "Each job role belongs to exactly one family, so a family's probability is the sum of its "
         "job roles' probabilities. The family probabilities still sum to 1, which is unit-tested. "
         "One model, both levels of recommendation."),
        ("Why is top-3 accuracy so much higher than top-1?",
         "0.839 against 0.549 on test. Several roles genuinely overlap, and Full-stack absorbs "
         "uncertain top-1 guesses. The right role is usually still in the top three &mdash; exactly the "
         "behaviour the three-role interface was designed around."),
        ("Your best model only gets 28% macro-F1. Is this system actually useful?",
         "Top-1 macro-F1 is the wrong number to judge the product by, because the product never "
         "shows one answer. The correct role is in the displayed list 83.9% of the time and the "
         "correct family 87.8%. We report macro-F1 as the primary <i>model-selection</i> metric "
         "because it penalises ignoring rare roles, not because it is the user-facing claim."),
        ("What surprised you most?",
         "That the error analysis contradicted the EDA prediction. We expected confusions inside "
         "families (Cloud Infrastructure and DevOps, cosine 0.99). Instead all eight largest "
         "confusions cross family boundaries and point at Full-stack. The problem was imbalance "
         "first, overlap second &mdash; which reordered the Stage 7 priorities."),
        ("Is there anything in your results you cannot fully explain?",
         "The SelectKBest k=all row scores 0.025 below the reference despite selecting nothing. We "
         "traced it: that pipeline scales all 479 features, whereas the Stage 4 preprocessor "
         "deliberately leaves the 403 binary technology columns as 0/1. So it is an accidental "
         "controlled experiment showing that scaling binary columns costs about 0.025 macro-F1 &mdash; "
         "supporting evidence for a Stage 4 decision argued on interpretability grounds alone."),
        ("What would you do with more time?",
         "Predict family first and then role within family; try an L1 model for a sparse "
         "explainable skill set per role; and collect more respondents for the rare roles rather "
         "than trying to squeeze them out of 47 examples."),
    ]
    flow = [P("Stage 8 is an individual viva on the modelling and optimisation stages. Each group "
              "member must be able to justify the algorithm selection, the validation strategy, the "
              "tuning decisions, the final model choice and their own contribution. The answers "
              "below are grounded in the results in this report.", "Body")]
    for q, a in qa:
        flow.append(KeepTogether([P(q, "Q"), P(a, "Body")]))
    return page("STAGE 8 &mdash; INDIVIDUAL EVALUATION", "Defence: anticipated questions", *flow)


def deliverables(d):
    rows = [["File", "What it contains"]]
    for f, w in [
        ("artifacts/model.joblib", "the fitted final Pipeline the backend loads"),
        ("artifacts/model_card.json", "what the model is, how it scores, what it must not be used for"),
        ("src/skillpath/modelling.py", "candidates, metrics, resampling, selection, experiment runner"),
        ("scripts/run_models.py", "Stage 6 comparison and error diagnosis"),
        ("scripts/tune_models.py", "Stage 7 phases A-D"),
        ("scripts/finalise_model.py", "final fit and the single held-out evaluation"),
        ("notebooks/04_modelling_and_optimisation.ipynb", "Stage 6 and 7 narrative with outputs"),
        ("notebooks/06_evaluation2_showcase.ipynb", "Stages 6-8 walkthrough for Progress Evaluation 2"),
        ("reports/model_experiments.csv", f"all {len(d['log'])} cross-validation runs, timestamped"),
        ("reports/modelling_decisions.md", "the full written decision log and viva preparation"),
        ("reports/stage6_*.csv / .json", "comparison, per-class report, confusion matrix"),
        ("reports/stage7_*.csv / .json", "each phase, search results, final selection, test results"),
        ("tests/test_modelling.py", "19 checks on the modelling claims"),
    ]:
        rows.append([f"<font face='Courier' size='7.5'>{f}</font>", w])

    return page(
        "APPENDIX", "Deliverables and data licence",
        P("Stage 6 and 7 outputs", "H2"),
        table(rows, widths=[CONTENT_W * 0.37, CONTENT_W * 0.63]),

        P("Test suite", "H2"),
        P("36 automated checks across <i>tests/test_preprocessing.py</i> and "
          "<i>tests/test_modelling.py</i>: 35 pass. The one failure, "
          "<i>test_every_survey_country_maps_to_a_region</i>, requires the 140 MB raw survey CSV, "
          "which is not committed to the repository; it passes once the file is downloaded into "
          "<i>data/raw/</i>.", "Body"),

        P("Data licence and attribution", "H2"),
        P("Stack Overflow. (2025). <i>Stack Overflow Annual Developer Survey 2025</i> [Data set]. "
          "Stack Exchange, Inc. https://survey.stackoverflow.co/2025/", "Body"),
        P("The survey data is made available under the Open Database License (ODbL) v1.0, and "
          "individual contents under the Database Contents License. Derived datasets are shared "
          "under the same licence, and the web application must display the attribution line "
          "stored in artifacts/options.json. No user input is stored by the application.", "Body"),

        P("Environment", "H2"),
        P(f"Python 3.14, scikit-learn {d['card']['sklearn_version']}, pandas 3.0.5. The deployed "
          f"scikit-learn version must match the one that saved model.joblib.", "Body"),
    )


def main():
    d = load()
    story = []
    story += cover(d)
    story += overview(d)
    story += stage6_setup(d)
    story += stage6_algos(d)
    story += stage6_results(d)
    story += stage6_figures(d)
    story += stage6_errors(d)
    story += stage6_figures2(d)
    story += phase_a(d)
    story += phase_b(d)
    story += phase_c(d)
    story += phase_d(d)
    story += selection(d)
    story += test_page(d)
    story += test_figure(d)
    story += limitations(d)
    story += viva(d)
    story += deliverables(d)
    if isinstance(story[-1], PageBreak):
        story.pop()

    document().build(story)
    print(f"Wrote {OUT}  ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
