"""Metrics at the default decision threshold (0.5), and mean ± std across seeds (sample std, ddof = 1)."""

from __future__ import annotations

import numpy as np
from sklearn.metrics import accuracy_score, f1_score, recall_score, roc_auc_score

THRESHOLD = 0.5
METRIC_KEYS = ("accuracy", "f1", "auc", "sensitivity", "specificity", "trainTimeS", "inferenceMs")


def evaluate(y: np.ndarray, p: np.ndarray, train_s: float, infer_ms: float, threshold: float = THRESHOLD) -> dict[str, float]:
    pred = (p >= threshold).astype(int)
    return {
        "accuracy": float(accuracy_score(y, pred)),
        "f1": float(f1_score(y, pred, zero_division=0)),
        "auc": float(roc_auc_score(y, p)),
        "sensitivity": float(recall_score(y, pred, zero_division=0)),
        "specificity": float(recall_score(1 - y, 1 - pred, zero_division=0)),
        "trainTimeS": float(train_s),
        "inferenceMs": float(infer_ms),
    }


def mean_std(values: list[float]) -> dict[str, float]:
    a = np.asarray(values, dtype=float)
    return {"mean": float(a.mean()), "std": float(a.std(ddof=1)) if len(a) > 1 else 0.0}


def aggregate(per_seed: list[dict[str, float]]) -> dict[str, dict[str, float]]:
    return {k: mean_std([s[k] for s in per_seed]) for k in METRIC_KEYS}
