"""Shared chart styling for the notebooks and the report figures."""
from __future__ import annotations

import matplotlib as mpl
import matplotlib.pyplot as plt

from . import config as C

# Validated categorical palette (fixed order) and a one-hue sequential ramp.
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]
BLUE = SERIES[0]
ORANGE = SERIES[1]
MUTED = "#8a8985"
SEQ_BLUES = ["#f4f8fd", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]
TEXT = "#0b0b0b"
TEXT2 = "#52514e"
GRID = "#e4e3df"


def setup() -> None:
    mpl.rcParams.update({
        "figure.dpi": 110,
        "savefig.dpi": 200,
        "savefig.bbox": "tight",
        "font.size": 10,
        "axes.titlesize": 11,
        "axes.titleweight": "bold",
        "axes.titlelocation": "left",
        "axes.labelcolor": TEXT2,
        "axes.edgecolor": GRID,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "axes.grid.axis": "x",
        "grid.color": GRID,
        "grid.linewidth": 0.6,
        "xtick.color": TEXT2,
        "ytick.color": TEXT2,
        "legend.frameon": False,
        "axes.prop_cycle": mpl.cycler(color=SERIES),
    })


def seq_cmap():
    return mpl.colors.LinearSegmentedColormap.from_list("skillpath_blues", SEQ_BLUES)


def save(fig, name: str) -> None:
    C.FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    fig.savefig(C.FIGURES_DIR / f"{name}.png")


def barh(ax, labels, values, color=BLUE, fmt="{:,.0f}", pad_frac=0.01):
    """Horizontal bars, largest on top, with value labels at the bar end."""
    y = range(len(labels))
    ax.barh(list(y), values, color=color, height=0.7)
    ax.set_yticks(list(y), labels)
    ax.invert_yaxis()
    ax.grid(axis="y", visible=False)
    xmax = max(values) if len(values) else 1
    for i, v in enumerate(values):
        ax.text(v + xmax * pad_frac, i, fmt.format(v), va="center", fontsize=8, color=TEXT2)
    ax.set_xlim(0, xmax * 1.15)
    return ax
