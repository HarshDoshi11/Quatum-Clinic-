"""Classical baselines, all seeded. Library defaults except where noted; nothing tuned on the test split."""

from __future__ import annotations

from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from xgboost import XGBClassifier

CLASSICAL = ("logreg", "svm", "rf", "xgboost")


def make_classical(name: str, seed: int):
    if name == "logreg":
        return LogisticRegression(max_iter=2000, random_state=seed)
    if name == "svm":
        # probability=True: Platt scaling (internal 5-fold CV) so AUC and calibration use probabilities.
        return SVC(kernel="rbf", C=1.0, gamma="scale", probability=True, random_state=seed)
    if name == "rf":
        return RandomForestClassifier(n_estimators=300, random_state=seed, n_jobs=-1)
    if name == "xgboost":
        return XGBClassifier(n_estimators=300, max_depth=3, learning_rate=0.1, subsample=0.9, random_state=seed, eval_metric="logloss", n_jobs=4)
    raise ValueError(name)
