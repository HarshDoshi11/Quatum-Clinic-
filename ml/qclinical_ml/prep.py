"""The training pipeline, fitted on the training split only.

impute (train mean; train mode for codes) → clip to the training range → StandardScaler
→ PCA(4) → min-max to [0, π] (angle encoding). The "full" variant stops after scaling.
Test patients and new patients go through the same fitted steps; encoded angles are
clipped to [0, π] like the app's pipeline.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

N_COMPONENTS = 4


class Prep:
    def __init__(self, categorical: list[str], mode: str = "pca4", seed: int = 0):
        assert mode in ("pca4", "full")
        self.categorical = set(categorical)
        self.mode = mode
        self.seed = seed

    def fit(self, X: pd.DataFrame) -> "Prep":
        self.columns = list(X.columns)
        self.fill = {c: (X[c].mode(dropna=True).iloc[0] if c in self.categorical else X[c].mean()) for c in self.columns}
        filled = X.fillna(self.fill)
        self.lo = filled.min()
        self.hi = filled.max()
        self.scaler = StandardScaler().fit(filled.to_numpy())
        if self.mode == "pca4":
            z = self.scaler.transform(filled.to_numpy())
            self.pca = PCA(n_components=N_COMPONENTS, random_state=self.seed).fit(z)
            comps = self.pca.transform(z)
            self.cmin = comps.min(axis=0)
            self.cmax = comps.max(axis=0)
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        filled = X[self.columns].fillna(self.fill).clip(self.lo, self.hi, axis=1)
        z = self.scaler.transform(filled.to_numpy())
        if self.mode == "full":
            return z
        comps = self.pca.transform(z)
        angles = (comps - self.cmin) / np.where(self.cmax > self.cmin, self.cmax - self.cmin, 1.0) * np.pi
        return np.clip(angles, 0.0, np.pi)

    def explained_variance(self) -> float | None:
        return float(self.pca.explained_variance_ratio_.sum()) if self.mode == "pca4" else None
