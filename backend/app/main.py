"""Q/Clinical API — FastAPI stub.

Every route returns the same JSON shapes as the frontend mock layer (served
from app/fixtures). Where the real hybrid quantum-classical pipeline will plug
in, you will find an "ML hook" comment.

Run:  uvicorn app.main:app --reload --port 8000
"""

import csv
import io
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .fixtures import fixture
from .schemas import (
    DatasetId,
    ExplainRequest,
    NoiseRunRequest,
    PatientInput,
    PredictRequest,
    ReportRequest,
    SweepType,
    TrainRequest,
)

app = FastAPI(title="Q/Clinical API", version=__version__)

# Any localhost port in development; add deployed origins via CORS_ORIGINS (comma-separated).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("CORS_ORIGINS", "").split(",") if o],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)

IST = timezone(timedelta(hours=5, minutes=30))

# In-memory experiments created by /train and /rerun during this process.
_session_experiments: list[dict[str, Any]] = []
_next_experiment = 2049


def _now() -> str:
    return datetime.now(IST).isoformat(timespec="seconds")


def _new_experiment_id() -> str:
    global _next_experiment
    exp_id = f"EXP-{_next_experiment}"
    _next_experiment += 1
    return exp_id


def _all_experiments() -> list[dict[str, Any]]:
    return _session_experiments + fixture("experiments")


MODEL_NAMES = {"vqc": "VQC", "qsvm": "QSVM", "logreg": "LogReg", "svm": "SVM", "rf": "Random Forest", "xgboost": "XGBoost"}

SUMMARY_FIELDS = ("id", "kind", "title", "dataset", "model", "family", "backend", "qubits", "auc", "timestamp", "status")


def _summary(exp: dict[str, Any]) -> dict[str, Any]:
    return {k: exp[k] for k in SUMMARY_FIELDS}


def _is_unusual(dataset: DatasetId, patient: PatientInput) -> bool:
    """Stub heuristic: treat the demo 'unusual patient' (or any out-of-range value) as unusual."""
    schema = fixture("schema")[dataset]
    for feature in schema["features"]:
        value = patient.get(feature["key"])
        if value is not None and not (feature["min"] <= value <= feature["max"]):
            return True
    return patient == schema["unusualPatient"]


# ─── System ─────────────────────────────────────────────────


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "version": __version__, "mock": True}


@app.get("/overview")
def overview(dataset: DatasetId = "wdbc") -> dict[str, Any]:
    # ML hook: derive status, findings and recent runs from the experiment store.
    return fixture("overview")[dataset]


@app.get("/status")
def status(dataset: DatasetId = "wdbc") -> dict[str, Any]:
    return fixture("status")[dataset]


# ─── Data ───────────────────────────────────────────────────


@app.get("/datasets")
def list_datasets() -> list[dict[str, Any]]:
    return fixture("datasets")


@app.get("/datasets/{dataset}")
def get_dataset(dataset: DatasetId) -> dict[str, Any]:
    # ML hook: profile the stored dataset and run the preprocessing pipeline
    #           (clean → impute → clip outliers → z-score → select → PCA).
    return fixture("dataset_detail")[dataset]


@app.get("/datasets/{dataset}/schema")
def get_feature_schema(dataset: DatasetId) -> dict[str, Any]:
    return fixture("schema")[dataset]


@app.post("/upload")
async def upload(file: UploadFile = File(...)) -> dict[str, Any]:
    """Profile an uploaded CSV. Mirrors profileCsv() in the frontend mock."""
    # ML hook: persist the dataset and make it available to /train.
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    rows = [r for r in csv.reader(io.StringIO(raw)) if any(cell.strip() for cell in r)]
    if len(rows) < 2:
        raise HTTPException(422, "The file needs a header row and at least one data row.")
    header = [h.strip() for h in rows[0]]

    def parse(cell: str) -> Optional[float | str]:
        cell = cell.strip()
        if cell == "" or cell.lower() == "na" or cell == "?":
            return None
        try:
            return float(cell) if not cell.lstrip("-").isdigit() else int(cell)
        except ValueError:
            return cell

    parsed = [{h: parse(r[i]) if i < len(r) else None for i, h in enumerate(header)} for r in rows[1:]]
    target_names = {"target", "diagnosis", "label", "class", "outcome", "y"}
    target = next((h for h in header if h.lower() in target_names), header[-1])

    columns = []
    for name in header:
        values = [row[name] for row in parsed]
        present = [v for v in values if v is not None]
        distinct = {str(v) for v in present}
        numeric = all(isinstance(v, (int, float)) for v in present)
        col_type = "binary" if len(distinct) <= 2 else "numeric" if numeric and len(distinct) > 10 else "categorical"
        columns.append({
            "name": name,
            "label": name.replace("_", " ").capitalize(),
            "type": col_type,
            "isTarget": name == target,
            "missing": len(values) - len(present),
            "unit": None,
        })

    target_values = [str(row[target]) for row in parsed if row[target] is not None]
    labels = sorted(set(target_values))
    positive = next((l for l in labels if l.lower() in {"1", "m", "yes", "true", "positive"}), labels[-1] if labels else "1")
    negative = next((l for l in labels if l != positive), "0")
    name = file.filename or "upload.csv"

    return {
        "fileName": name,
        "detail": {
            "id": f"upload-{abs(hash(name + str(len(raw)))):x}",
            "name": name.removesuffix(".csv"),
            "code": "CSV",
            "source": f"Uploaded file · {name}",
            "samples": len(parsed),
            "features": len(header) - 1,
            "target": target,
            "missingValues": sum(c["missing"] for c in columns),
            "classBalance": {
                "positiveLabel": positive,
                "negativeLabel": negative,
                "positive": sum(1 for v in target_values if v == positive),
                "negative": sum(1 for v in target_values if v != positive),
            },
            "columns": columns,
            "preview": parsed[:8],
            "preprocessing": None,
        },
    }


# ─── Training & experiments ─────────────────────────────────


@app.post("/train")
def train(req: TrainRequest) -> dict[str, Any]:
    # ML hook: run the hybrid pipeline for each requested model:
    #   classical — scikit-learn / XGBoost on the preprocessed features;
    #   quantum   — PCA → angle/amplitude encoding → VQC or QSVM kernel (e.g. Qiskit),
    #               with `qubits`, `encoding`, `circuitDepth`; repeat over `seeds`.
    #   Stream epoch losses instead of returning the full curve at the end.
    response = fixture("train")[req.dataset]
    exp_id = _new_experiment_id()
    response["experimentId"] = exp_id
    response["jobId"] = f"JOB-{exp_id[4:]}"
    response["completedAt"] = _now()
    response["results"] = [r for r in response["results"] if r["model"] in req.models]
    if "vqc" not in req.models:
        response["lossCurve"] = []

    single = req.models[0] if len(req.models) == 1 else None
    quantum = any(m in ("vqc", "qsvm") for m in req.models)
    best = max(response["results"], key=lambda r: r["auc"]["mean"])
    _session_experiments.insert(0, {
        "id": exp_id,
        "kind": "run" if single else "benchmark",
        "title": MODEL_NAMES[single] + (f" · {req.qubits}q" if quantum else "") if single else f"Training · {len(req.models)} models",
        "dataset": req.dataset,
        "model": single,
        "family": best["family"] if single else None,
        "backend": "ideal-sim" if quantum else "cpu",
        "qubits": req.qubits if quantum else None,
        "auc": best["auc"]["mean"],
        "timestamp": response["completedAt"],
        "status": "complete",
        "config": {
            "dataset": req.dataset,
            "models": list(req.models),
            "features": 16 if req.dataset == "wdbc" else 13,
            "pcaDims": req.qubits if quantum else None,
            "encoding": req.encoding if quantum else None,
            "qubits": req.qubits if quantum else None,
            "circuitDepth": req.circuitDepth if quantum else None,
            "entanglement": "linear" if quantum else None,
            "backend": "ideal-sim" if quantum else "cpu",
            "noise": None,
            "seed": 42,
            "seeds": req.seeds,
        },
        "metrics": None,
        "notes": "Started from the Train page (stub).",
    })
    return response


@app.get("/experiments")
def list_experiments(dataset: Optional[DatasetId] = None, limit: Optional[int] = Query(default=None, ge=1)) -> list[dict[str, Any]]:
    items = [e for e in _all_experiments() if dataset is None or e["dataset"] == dataset]
    items.sort(key=lambda e: e["timestamp"], reverse=True)
    return [_summary(e) for e in items[:limit]]


@app.get("/experiments/{experiment_id}")
def get_experiment(experiment_id: str) -> dict[str, Any]:
    # Circuit-search designs (e.g. EXP-2040.C07) are resolvable but not listed.
    for exp in _all_experiments() + fixture("experiment_children"):
        if exp["id"] == experiment_id:
            return exp
    raise HTTPException(404, f"Experiment {experiment_id} not found")


@app.post("/experiments/{experiment_id}/rerun")
def rerun_experiment(experiment_id: str) -> dict[str, Any]:
    # ML hook: re-execute with the stored config instead of copying results.
    source = get_experiment(experiment_id)
    rerun = {**source, "id": _new_experiment_id(), "timestamp": _now(), "notes": f"Re-run of {experiment_id}."}
    _session_experiments.insert(0, rerun)
    return rerun


# ─── Analysis ───────────────────────────────────────────────


@app.get("/compare")
def compare(dataset: DatasetId = "wdbc") -> dict[str, Any]:
    # ML hook: aggregate per-seed metrics from the benchmark experiment.
    return fixture("compare")[dataset]


@app.get("/sweeps/{sweep_type}")
def sweeps(sweep_type: SweepType, dataset: DatasetId = "wdbc") -> dict[str, Any]:
    # ML hook: small-data → retrain on subsampled training sets;
    #           scalability → transpile + train VQC at 4…12 qubits;
    #           evolution → circuit search over encoding/depth/entanglement;
    #           failure-envelope → grid over 2Q gate error × data corruption.
    return fixture("sweeps")[sweep_type][dataset]


@app.get("/noise/profiles")
def noise_profiles() -> list[dict[str, Any]]:
    return fixture("noise_profiles")


@app.post("/noise/run")
def noise_run(req: NoiseRunRequest) -> dict[str, Any]:
    # ML hook: build a noise model from req.noise (T1, T2, gate and readout errors),
    #           re-evaluate the QSVM on the test split and sweep T2 for the chart.
    #           The stub returns the preset profile's result and ignores custom values.
    return fixture("noise_run")[req.dataset][req.profileId]


# ─── Patient ────────────────────────────────────────────────


@app.post("/predict")
def predict(req: PredictRequest) -> dict[str, Any]:
    # ML hook: score req.input with the deployed QSVM; compute trust signals
    #           (seed stability, OOD distance, calibration, input/hardware sensitivity)
    #           and abstain when evidence is insufficient.
    kind = "unusual" if _is_unusual(req.dataset, req.input) else "sample"
    return fixture("predict")[req.dataset][kind]


@app.get("/trust")
def trust(dataset: DatasetId = "wdbc") -> dict[str, Any]:
    return fixture("trust")[dataset]


@app.post("/explain")
def explain(req: ExplainRequest) -> dict[str, Any]:
    # ML hook: per-feature attributions (e.g. SHAP on the kernel model) for req.input.
    return fixture("explain")[req.dataset]


@app.get("/cross-modality")
def cross_modality(dataset: DatasetId = "wdbc") -> dict[str, Any]:
    return fixture("cross_modality")[dataset]


@app.post("/report")
def report(req: ReportRequest) -> dict[str, Any]:
    # ML hook: generate from the live prediction + explanation for req.input.
    kind = "unusual" if _is_unusual(req.dataset, req.input) else "sample"
    result = fixture("report")[req.dataset][kind]
    result["generatedAt"] = _now()
    return result
