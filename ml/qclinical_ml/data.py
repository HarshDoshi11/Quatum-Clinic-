"""Load WDBC and UCI Heart (Cleveland) with the app's feature keys and encodings.

The feature list, order and answer codes come from the app's schema fixture
(backend/app/fixtures/schema.json), so a patient entered in the app maps onto the
model inputs one to one:

- WDBC: the ten "mean" cell-nucleus measurements the app asks for (sklearn has 30;
  the app's schema, Predict and the patient report use these ten).
- Heart: the 13 Cleveland attributes. The raw UCI file codes cp 1-4, slope 1-3 and
  thal 3/6/7; the app codes them 0-3, 0-2 and 0-2, so they are remapped here.

Positive class (y = 1): malignant for WDBC, heart disease (num > 0) for Heart.
Missing values stay NaN; they are imputed inside the pipeline, on the training split only.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.datasets import load_breast_cancer

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / "backend" / "app" / "fixtures" / "schema.json"
DATA_DIR = ROOT / "ml" / "data"

HEART_FILES = ("processed.cleveland.data", "heart_cleveland.csv", "cleveland.csv", "heart.csv")
HEART_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data"
CLEVELAND_COLUMNS = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal", "num"]


@dataclass
class Dataset:
    id: str
    code: str
    #: One column per app feature, in schema order; NaN = missing.
    X: pd.DataFrame
    #: 1 = disease.
    y: np.ndarray
    #: The app's feature specs (key, label, unit, kind, options, min, max, …).
    features: list[dict[str, Any]]
    #: Features imputed with the training mode (codes and small counts); the rest use the training mean.
    categorical: list[str]
    #: The app's demo patients, for the Predict fixture.
    sample_patient: dict[str, float | None]
    unusual_patient: dict[str, float | None]
    notes: list[str] = field(default_factory=list)


def load_schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _categorical(features: list[dict[str, Any]]) -> list[str]:
    return [f["key"] for f in features if f.get("options") or (f["kind"] == "integer" and f["max"] - f["min"] <= 4)]


def load_wdbc(schema: dict[str, Any]) -> Dataset:
    spec = schema["wdbc"]
    bc = load_breast_cancer(as_frame=True)
    frame = bc.frame
    keys = [f["key"] for f in spec["features"]]
    # "radius_mean" → "mean radius", "concave_points_mean" → "mean concave points"
    X = pd.DataFrame({k: frame["mean " + k.removesuffix("_mean").replace("_", " ")].astype(float) for k in keys})
    y = (bc.target.to_numpy() == 0).astype(int)  # sklearn codes malignant as 0
    return Dataset(
        id="wdbc",
        code="WDBC",
        X=X,
        y=y,
        features=spec["features"],
        categorical=_categorical(spec["features"]),
        sample_patient=spec["samplePatient"],
        unusual_patient=spec["unusualPatient"],
        notes=[f"WDBC: sklearn load_breast_cancer, {len(X)} rows, the app's {len(keys)} 'mean' features (sklearn provides 30)."],
    )


def find_heart_file() -> Path:
    for name in HEART_FILES:
        path = DATA_DIR / name
        if path.exists():
            return path
    raise FileNotFoundError(
        "UCI Heart (Cleveland) not found. Download it into ml/data/:\n"
        f"  curl -o ml/data/processed.cleveland.data {HEART_URL}\n"
        f"(accepted names: {', '.join(HEART_FILES)})"
    )


def _read_heart(path: Path) -> pd.DataFrame:
    first = path.read_text(encoding="utf-8", errors="replace").splitlines()[0]
    if "age" in first.lower():
        raw = pd.read_csv(path, na_values=["?", ""])
        raw.columns = [c.strip().lower() for c in raw.columns]
        target = next(c for c in ("num", "target", "condition", "output") if c in raw.columns)
        raw = raw.rename(columns={target: "num"})
    else:
        raw = pd.read_csv(path, header=None, names=CLEVELAND_COLUMNS, na_values=["?", ""])
    return raw.apply(pd.to_numeric, errors="coerce")


def load_heart(schema: dict[str, Any]) -> Dataset:
    spec = schema["heart"]
    path = find_heart_file()
    raw = _read_heart(path)
    notes = [f"Heart: {path.name}, {len(raw)} rows."]
    if len(raw) != 303:
        notes.append(f"Expected 303 Cleveland rows, found {len(raw)}.")

    # Recode to the app's answer codes where the file uses UCI's.
    if raw["cp"].min() >= 1:
        raw["cp"] = raw["cp"] - 1
        notes.append("cp recoded 1-4 → 0-3.")
    if raw["slope"].min() >= 1:
        raw["slope"] = raw["slope"] - 1
        notes.append("slope recoded 1-3 → 0-2.")
    if set(raw["thal"].dropna().unique()) <= {3.0, 6.0, 7.0}:
        raw["thal"] = raw["thal"].map({3.0: 0.0, 6.0: 1.0, 7.0: 2.0})
        notes.append("thal recoded 3/6/7 → 0/1/2 (normal / fixed / reversible).")

    missing = {c: int(raw[c].isna().sum()) for c in ("ca", "thal") if raw[c].isna().any()}
    if missing:
        notes.append("Missing " + ", ".join(f"{c}: {n}" for c, n in missing.items()) + " (imputed with the training-split mode).")

    keys = [f["key"] for f in spec["features"]]
    X = raw[keys].astype(float)
    y = (raw["num"].to_numpy() > 0).astype(int)
    return Dataset(
        id="heart",
        code="HEART",
        X=X,
        y=y,
        features=spec["features"],
        categorical=_categorical(spec["features"]),
        sample_patient=spec["samplePatient"],
        unusual_patient=spec["unusualPatient"],
        notes=notes,
    )


def load(dataset_id: str, schema: dict[str, Any] | None = None) -> Dataset:
    schema = schema or load_schema()
    return {"wdbc": load_wdbc, "heart": load_heart}[dataset_id](schema)
