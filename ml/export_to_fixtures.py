"""Merge ml/results/real_results.json into the backend fixtures, for Advantage Observatory and Predict & Trust only.

    ml/.venv/Scripts/python ml/export_to_fixtures.py

What it writes (backend/app/fixtures/):
- compare.json   Advantage Observatory: the six models on the same 4 PCA angles, real, 5 seeds.
- trust.json     Predict & Trust: calibration, threshold curve and operating point of the real QSVM.
- predict.json   Predict & Trust: the app's sample and unusual patients scored by the real QSVM (5 seed models).
- experiment_children.json   the REAL-* experiment records those pages' tags open (resolvable, never listed).
Each merged response gets `source: {"kind": "real", "seeds": 5}`; every other fixture keeps the
`{"kind": "simulated"}` source the mocks export. The frontend's <SourceBadge> reads it next to the page title.

The shapes are exactly the mock API's (frontend/src/types). Real configs get their own configKeys
(`…|real-pca4`, `…|ideal-sim|real`), so they never collide with a simulated config's number.
`npm run export:fixtures` regenerates every fixture from the mocks: run this script again after it.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "backend" / "app" / "fixtures"
REAL = ROOT / "ml" / "results" / "real_results.json"

MODEL_ORDER = ["vqc", "qsvm", "logreg", "svm", "rf", "xgboost"]
MODEL_NAMES = {"vqc": "VQC", "qsvm": "QSVM", "logreg": "LogReg", "svm": "SVM", "rf": "Random Forest", "xgboost": "XGBoost"}
METRICS = ("accuracy", "sensitivity", "specificity", "auc", "trainTimeS", "inferenceMs")
UNUSUAL_Z = 2.5
OOD_Z = 3.5
THRESHOLD = 0.5


def load(name: str) -> Any:
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


def save(name: str, data: Any) -> None:
    (FIXTURES / f"{name}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def r4(x: float) -> float:
    return round(float(x), 4)


def ms(d: dict[str, float]) -> dict[str, float]:
    return {"mean": r4(d["mean"]), "std": r4(d["std"])}


def pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def trim(x: float) -> str:
    return f"{x:.4f}".rstrip("0").rstrip(".")


def pooled(a: float, b: float) -> float:
    return math.sqrt(a**2 + b**2)


def exp_id(code: str, model: str | None = None) -> str:
    return f"REAL-{code}" + (f"-{MODEL_NAMES[model].upper().replace(' ', '')}" if model else "")


# ─── Advantage Observatory ──────────────────────────────────


def build_compare(ds: str, code: str, rows_in: list[dict], full_rows: list[dict], n_seeds: int, n_features: int) -> dict:
    by_model = {r["model"]: r for r in rows_in}
    rows = [
        {
            "model": m,
            "family": by_model[m]["family"],
            "configKey": by_model[m]["configKey"],
            "backend": by_model[m]["backend"],
            "experimentId": exp_id(code, m),
            "metrics": {k: ms(by_model[m]["metrics"][k]) for k in METRICS},
            "qubits": by_model[m]["qubits"],
            "circuitDepth": by_model[m]["circuitDepth"],
        }
        for m in MODEL_ORDER
    ]
    auc = {m: by_model[m]["metrics"]["auc"] for m in MODEL_ORDER}
    quantum = [m for m in MODEL_ORDER if by_model[m]["family"] == "quantum"]
    classical = [m for m in MODEL_ORDER if by_model[m]["family"] == "classical"]
    qm = max(quantum, key=lambda m: auc[m]["mean"])
    cm = max(classical, key=lambda m: auc[m]["mean"])
    q, c = auc[qm], auc[cm]
    delta = q["mean"] - c["mean"]
    noise = pooled(q["std"], c["std"])
    # A fourth decimal when the gap and the noise would otherwise print the same.
    dp = 3 if f"{abs(delta):.3f}" != f"{noise:.3f}" else 4
    gap = f"{abs(delta):.{dp}f}"
    if abs(delta) <= noise:
        takeaway = f"{MODEL_NAMES[qm]} and {MODEL_NAMES[cm]} differ by {gap} AUC, within seed noise (±{noise:.{dp}f}), so neither is clearly better."
    elif delta < 0:
        takeaway = f"{MODEL_NAMES[qm]} trails {MODEL_NAMES[cm]} by {gap} AUC, more than the combined seed noise (±{noise:.{dp}f}), so the classical lead is real on {code}."
    else:
        takeaway = f"{MODEL_NAMES[qm]} leads {MODEL_NAMES[cm]} by {gap} AUC, more than the combined seed noise (±{noise:.{dp}f})."
    best_full = max(full_rows, key=lambda r: r["metrics"]["auc"]["mean"])
    bf = best_full["metrics"]["auc"]
    takeaway += f" On all {n_features} input features, {MODEL_NAMES[best_full['model']]} reaches {bf['mean']:.3f} ± {bf['std']:.3f} AUC."

    resources = [
        {
            "id": f"REAL-{MODEL_NAMES[m]}-{by_model[m]['qubits']}Q",
            "configKey": by_model[m]["configKey"],
            "model": m,
            "qubits": by_model[m]["qubits"],
            "circuitDepth": by_model[m]["circuitDepth"],
            "auc": r4(auc[m]["mean"]),
            "aucStd": r4(auc[m]["std"]),
        }
        for m in quantum
    ]
    best_res = max(resources, key=lambda r: r["auc"])
    resources_takeaway = f"The best quantum design ({MODEL_NAMES[best_res['model']]}, {best_res['qubits']} qubits × {best_res['circuitDepth']} layers) reaches {best_res['auc']:.3f} AUC; both real quantum designs use {best_res['qubits']} qubits, so this run says nothing yet about circuit size."

    stds = {m: auc[m]["std"] for m in MODEL_ORDER}
    lo, hi = min(stds.values()), max(stds.values())
    steadiest = next(m for m in MODEL_ORDER if stds[m] == lo)
    noisiest = next(m for m in MODEL_ORDER if stds[m] == hi)
    stability_takeaway = (
        f"All models vary similarly between seeds (±{lo:.3f}–{hi:.3f} AUC)."
        if hi - lo < 0.005
        else f"{MODEL_NAMES[steadiest]} is the most stable (±{lo:.3f}); {MODEL_NAMES[noisiest]} varies most between seeds (±{hi:.3f})."
    )
    return {
        "dataset": ds,
        "experimentId": exp_id(code),
        "seeds": n_seeds,
        "rows": rows,
        "resources": resources,
        "baselines": [{"model": m, "auc": r4(auc[m]["mean"])} for m in classical],
        "stability": [{"model": m, "seed": i + 1, "auc": r4(s["auc"])} for m in MODEL_ORDER for i, s in enumerate(by_model[m]["perSeed"])],
        "takeaway": takeaway,
        "resourcesTakeaway": resources_takeaway,
        "stabilityTakeaway": stability_takeaway,
        "evaluation": f"{n_seeds} seeds · held-out 20% · {code}",
        "source": {"kind": "real", "seeds": n_seeds},
    }


# ─── Predict & Trust: model level ───────────────────────────


def sens_spec(y: np.ndarray, p: np.ndarray, t: float) -> tuple[float, float]:
    pred = p >= t
    pos, neg = y == 1, y == 0
    return float(pred[pos].mean()) if pos.any() else 0.0, float((~pred[neg]).mean()) if neg.any() else 0.0


def std1(values: list[float]) -> float:
    return float(np.std(values, ddof=1)) if len(values) > 1 else 0.0


def operating_sentence(t: float, point: dict, safe: float) -> str:
    s, s_std = point["sensitivity"], point["sensitivityStd"]
    if s - s_std >= safe:
        status = f"stays above the {round(safe * 100)}% safety threshold beyond seed noise"
    elif s + s_std < safe:
        status = f"sits below the {round(safe * 100)}% safety threshold beyond seed noise"
    else:
        status = f"is within seed noise of the {round(safe * 100)}% safety threshold"
    return (
        f"At the default decision threshold of {round(t * 100)}%, sensitivity is {pct(s)} (±{s_std * 100:.1f}) "
        f"and specificity {pct(point['specificity'])} (±{point['specificityStd'] * 100:.1f}); sensitivity {status}."
    )


def calibration_takeaway(bias: float, noise: float, ece: float) -> str:
    e = f"ECE {pct(ece)}"
    if abs(bias) <= noise:
        return f"Predicted and observed rates agree within seed noise ({e})."
    pts = f"{abs(bias) * 100:.1f} points"
    if bias > 0:
        return f"The model is over-confident: its predictions sit {pts} further from 50% than what happened, beyond seed noise ({e})."
    return f"The model is under-confident: its predictions sit {pts} closer to 50% than what happened, beyond seed noise ({e})."


def build_trust(ds: str, code: str, deployed: dict, qsvm_row: dict, old: dict) -> dict:
    seeds = deployed["perSeed"]
    ys = [np.array(s["yTest"]) for s in seeds]
    ps = [np.array(s["pTest"]) for s in seeds]
    n_seeds = len(seeds)

    bins = []
    for b in range(10):
        lo, hi = b / 10, (b + 1) / 10
        inside = [((p >= lo) & ((p < hi) | ((b == 9) & (p <= 1)))) for p in ps]
        pooled_p = np.concatenate([p[m] for p, m in zip(ps, inside)])
        if len(pooled_p) == 0:
            continue
        pooled_y = np.concatenate([y[m] for y, m in zip(ys, inside)])
        observed = float(pooled_y.mean())
        per_seed_obs = [float(y[m].mean()) for y, m in zip(ys, inside) if m.any()]
        spread = std1(per_seed_obs) if len(per_seed_obs) > 1 else math.sqrt(observed * (1 - observed) / len(pooled_y))
        bins.append({
            "predicted": r4(pooled_p.mean()),
            "observed": r4(observed),
            "observedStd": r4(max(0.005, spread)),
            "count": max(1, round(len(pooled_p) / n_seeds)),
        })
    total = sum(b["count"] for b in bins)
    weighted = lambda f: sum(b["count"] / total * f(b) for b in bins)  # noqa: E731
    ece = weighted(lambda b: abs(b["observed"] - b["predicted"]))
    bias = weighted(lambda b: math.copysign(1, b["predicted"] - 0.5) * (b["predicted"] - b["observed"]))
    noise = weighted(lambda b: b["observedStd"])

    curve = []
    for i in range(1, 100):
        t = round(i / 100, 2)
        ss = [sens_spec(y, p, t) for y, p in zip(ys, ps)]
        curve.append({
            "threshold": t,
            "sensitivity": r4(np.mean([s for s, _ in ss])),
            "sensitivityStd": r4(std1([s for s, _ in ss])),
            "specificity": r4(np.mean([s for _, s in ss])),
            "specificityStd": r4(std1([s for _, s in ss])),
        })
    m = qsvm_row["metrics"]
    point = {"sensitivity": m["sensitivity"]["mean"], "sensitivityStd": m["sensitivity"]["std"], "specificity": m["specificity"]["mean"], "specificityStd": m["specificity"]["std"]}
    safe = old["safeSensitivity"]

    abstain = [np.array(s["abstain"], dtype=bool) for s in seeds]
    abstained = float(np.mean([a.sum() for a in abstain]))
    misses = float(np.mean([(((p >= 0.9) & (y == 0)) | ((p <= 0.1) & (y == 1)))[~a].sum() for y, p, a in zip(ys, ps, abstain)]))
    test_n = len(ys[0])
    return {
        "dataset": ds,
        "model": "qsvm",
        "experimentId": exp_id(code, "qsvm"),
        "backend": "ideal-sim",
        "qubits": qsvm_row["qubits"],
        "evaluation": f"QSVM {qsvm_row['qubits']}q · ideal sim (lightning) · {n_seeds} seeds · held-out 20% · {code}",
        "source": {"kind": "real", "seeds": n_seeds},
        "calibration": bins,
        "ece": r4(ece),
        "calibrationBias": r4(bias),
        "calibrationTakeaway": calibration_takeaway(bias, noise, ece),
        "thresholdCurve": curve,
        "operatingPoint": {"configKey": qsvm_row["configKey"], "threshold": THRESHOLD, "auc": r4(m["auc"]["mean"]), "sensitivity": ms(m["sensitivity"]), "specificity": ms(m["specificity"])},
        "thresholdTakeaway": operating_sentence(THRESHOLD, point, safe),
        "safeSensitivity": safe,
        "defaultThreshold": THRESHOLD,
        "testPatients": test_n,
        "abstained": round(abstained),
        "abstainRate": r4(abstained / test_n),
        "highConfidenceMisses": round(misses),
    }


# ─── Predict & Trust: one patient ───────────────────────────


def check_input(features: list[dict], patient: dict, pop: dict) -> dict:
    missing, out_of_range, max_z, max_f = [], [], 0.0, None
    for f in features:
        x = patient.get(f["key"])
        if x is None:
            missing.append(f)
            continue
        if x < f["min"] or x > f["max"]:
            out_of_range.append((f, x))
        z = abs((x - pop["mean"][f["key"]]) / pop["sd"][f["key"]])
        if z > max_z:
            max_z, max_f = z, f
    return {"missing": missing, "outOfRange": out_of_range, "maxAbsZ": max_z, "maxZFeature": max_f}


def fmt_value(f: dict, x: float) -> str:
    return trim(x) + (f" {f['unit']}" if f.get("unit") else "")


def level_of(value: float, strong_below: float, partial_below: float) -> str:
    return "strong" if value < strong_below else "partial" if value < partial_below else "weak"


def build_predict(ds: str, code: str, kind: str, base: dict, schema: dict, deployed: dict, trust: dict, qsvm_row: dict) -> dict:
    features = schema["features"]
    patient = schema["samplePatient" if kind == "sample" else "unusualPatient"]
    pop = deployed["population"]
    scores = deployed["patients"][kind]
    seeds = scores["perSeed"]
    p = float(np.mean(seeds))
    lo, hi = min(seeds), max(seeds)
    t = THRESHOLD
    check = check_input(features, patient, pop)
    abstain = bool(check["outOfRange"]) or len(check["missing"]) >= 3 or (bool(check["missing"]) and check["maxAbsZ"] > 3)
    flagged = p >= t

    # Input sensitivity: the 5-seed ensemble at ±errorSd on each present continuous input.
    perturbed = [float(np.mean(v)) for v in scores.get("perturbed", {}).values()]
    q_low, q_high = min([p, *perturbed]), max([p, *perturbed])
    max_delta = max([abs(q - p) for q in perturbed], default=0.0)
    flips = any((q >= t) != flagged for q in perturbed)

    bins = trust["calibration"]
    bin_ = min(bins, key=lambda b: abs(b["predicted"] - p))
    gap = abs(bin_["observed"] - bin_["predicted"])
    spread = hi - lo
    crosses = lo < t <= hi

    n = len(features)
    present = n - len(check["missing"])
    extrapolating = bool(check["outOfRange"])
    filled_in = abstain and not extrapolating
    FILLED = "Not meaningful: too much of this patient’s information is filled in with averages."
    pts = lambda x: f"{x * 100:.1f}"  # noqa: E731
    oor_keys = {f["key"] for f, _ in check["outOfRange"]}
    miss_keys = {f["key"] for f in check["missing"]}
    zf = check["maxZFeature"]["label"] if check["maxZFeature"] else None
    n_oor = len(check["outOfRange"])

    evidence = {
        "stability": {"seeds": None if abstain else [r4(s) for s in seeds]},
        "dataQuality": {"fields": [{"key": f["key"], "label": f["label"], "status": "out-of-range" if f["key"] in oor_keys else "imputed" if f["key"] in miss_keys else "present"} for f in features]},
        "distributionShift": {"distance": round(check["maxAbsZ"], 2), "feature": zf, "typical": round(pop["typicalDistance"], 2), "unusual": UNUSUAL_Z, "cutoff": OOD_Z, "outOfRange": n_oor},
        "calibration": {"bin": None if abstain else bin_["predicted"]},
        "inputSensitivity": {"range": None if abstain else [r4(q_low), r4(q_high)], "errorSd": deployed["errorSd"]},
        # Only the noiseless simulator is real so far: no noisy-backend numbers are claimed.
        "hardware": [{"backend": "ideal-sim", "probability": None if abstain else r4(p), "deployed": True}],
    }
    signals = [
        {
            "id": "stability",
            "label": "Prediction stability",
            "level": "weak" if extrapolating or filled_in or crosses else level_of(spread, 0.08, 0.15),
            "reason": "Seed agreement means little when the model is extrapolating." if extrapolating else FILLED if filled_in else ("Seeds disagree on which side of the threshold this patient falls." if abstain else f"Seeds disagree on the side of the threshold ({round(lo * 100)}–{round(hi * 100)}%).") if crosses else f"{len(seeds)} seeds agree within ±{spread * 50:.1f} points.",
            "short": "Extrapolating" if extrapolating else "Filled-in values" if filled_in else "Seeds straddle the threshold" if crosses else f"±{spread * 50:.1f} pts across {len(seeds)} seeds",
        },
        {
            "id": "data-quality",
            "label": "Data quality",
            "level": "strong" if not check["missing"] else "partial" if len(check["missing"]) == 1 else "weak",
            "reason": f"All {n} inputs present and within valid ranges." if not check["missing"] else f"{present} of {n} inputs present; missing: {', '.join(f['label'].lower() for f in check['missing'])}.",
            "short": f"All {n} present" if not check["missing"] else f"{len(check['missing'])} of {n} missing",
        },
        {
            "id": "distribution-shift",
            "label": "Distribution shift (OOD)",
            "level": "weak" if n_oor else "partial" if filled_in else level_of(check["maxAbsZ"], UNUSUAL_Z, OOD_Z),
            "reason": f"{n_oor} value{'s' if n_oor > 1 else ''} outside anything seen in training." if n_oor else f"Only {present} of {n} values to compare with the training population." if filled_in else "Patient resembles the training population." if check["maxAbsZ"] < UNUSUAL_Z else f"{zf or 'One value'} is unusual ({check['maxAbsZ']:.1f} SD from average).",
            "short": f"{n_oor} outside training range" if n_oor else f"Only {present} of {n} values to compare" if filled_in else "Resembles training data" if check["maxAbsZ"] < UNUSUAL_Z else f"{zf or 'One value'} {check['maxAbsZ']:.1f} SD out",
        },
        {
            "id": "calibration",
            "label": "Calibration",
            "level": "weak" if extrapolating or abstain else level_of(gap, 0.05, 0.1),
            "reason": "Calibration was only measured on patients within the training range." if extrapolating else "Not judged for this patient: there is no reported estimate to check." if abstain else f"At ~{round(bin_['predicted'] * 100)}% predicted, {round(bin_['observed'] * 100)}% of similar test patients were positive.",
            "short": "Not measured this far out" if extrapolating else "No estimate to check" if abstain else f"{round(bin_['predicted'] * 100)}% predicted → {round(bin_['observed'] * 100)}% observed",
        },
        {
            "id": "input-sensitivity",
            "label": "Input sensitivity",
            "level": "weak" if extrapolating or filled_in or flips else level_of(max_delta, 0.03, 0.06),
            "reason": "Out-of-range inputs make the result unpredictable under small changes." if extrapolating else FILLED if filled_in else "A small error in one entered value could flip the decision." if flips else f"Small errors in the entered values move the result by at most {pts(max_delta)} points.",
            "short": "Unpredictable out of range" if extrapolating else "Filled-in values" if filled_in else "A small error could flip it" if flips else f"≤ {pts(max_delta)} pts from small errors",
        },
        {
            "id": "hardware-sensitivity",
            "label": "Hardware sensitivity",
            "level": "weak" if extrapolating or filled_in else "partial",
            "reason": "Hardware robustness was only tested within the training range." if extrapolating else FILLED if filled_in else "Not measured yet: the real model has only run on the noiseless simulator.",
            "short": "Untested out of range" if extrapolating else "Filled-in values" if filled_in else "Ideal simulator only",
        },
    ]
    edges = base["riskBandEdges"]
    out = {
        **base,
        "model": "qsvm",
        "experimentId": exp_id(code, "qsvm"),
        "evaluation": f"QSVM {qsvm_row['qubits']}q · ideal sim (lightning) · {len(seeds)} seeds · same pipeline as training · {code}",
        "source": {"kind": "real", "seeds": len(seeds)},
        "backend": "ideal-sim",
        "qubits": qsvm_row["qubits"],
        "threshold": t,
        "trust": signals,
        "evidence": evidence,
    }
    if abstain:
        reasons = [f"{f['label']} {fmt_value(f, x)} is outside the training range ({fmt_value(f, f['min'])} – {fmt_value(f, f['max'])})." for f, x in check["outOfRange"]]
        reasons += [f"{f['label']} is missing." for f in check["missing"]]
        out.update({"decision": "abstain", "probability": None, "interval": None, "riskBand": None, "flagged": None, "abstainReasons": reasons})
    else:
        band = "low" if p < edges[0] else "moderate" if p < edges[1] else "high"
        out.update({"decision": "predict", "probability": r4(p), "interval": [r4(lo), r4(hi)], "riskBand": band, "flagged": flagged, "abstainReasons": []})
    return out


# ─── Experiment records the REAL tags open ──────────────────


def experiment_records(ds: str, code: str, rows: list[dict], generated: str, n_seeds: int, n_features: int) -> list[dict]:
    recs = []
    for r in rows:
        quantum = r["family"] == "quantum"
        m = {k: ms(r["metrics"][k]) for k in METRICS}
        recs.append({
            "id": exp_id(code, r["model"]),
            "kind": "run",
            "configKey": r["configKey"],
            "title": f"{MODEL_NAMES[r['model']]}" + (f" · {r['qubits']}q" if quantum else "") + " · real",
            "dataset": ds,
            "model": r["model"],
            "family": r["family"],
            "backend": r["backend"],
            "qubits": r["qubits"],
            "auc": m["auc"]["mean"],
            "timestamp": generated,
            "status": "complete",
            "config": {"dataset": ds, "models": [r["model"]], "features": n_features, "pcaDims": 4, "encoding": "angle" if quantum else None, "qubits": r["qubits"], "circuitDepth": r["circuitDepth"], "entanglement": "full" if quantum else None, "backend": r["backend"], "noise": None, "seed": 0, "seeds": n_seeds},
            "metrics": m,
            "notes": "Real run (ml/run_pipeline.py): stratified 80/20 split per seed, 4 PCA angles fitted on the training split" + ("; PennyLane lightning.qubit, noiseless." if quantum else "; scikit-learn / XGBoost on CPU."),
        })
    best = max(rows, key=lambda r: r["metrics"]["auc"]["mean"])
    recs.append({
        "id": exp_id(code),
        "kind": "benchmark",
        "configKey": None,
        "title": f"Real benchmark · {len(rows)} models · 4 PCA angles",
        "dataset": ds,
        "model": None,
        "family": None,
        "backend": "ideal-sim",
        "qubits": 4,
        "auc": r4(best["metrics"]["auc"]["mean"]),
        "timestamp": generated,
        "status": "complete",
        "config": {"dataset": ds, "models": [r["model"] for r in rows], "features": n_features, "pcaDims": 4, "encoding": "angle", "qubits": 4, "circuitDepth": 2, "entanglement": "full", "backend": "ideal-sim", "noise": None, "seed": 0, "seeds": n_seeds},
        "metrics": None,
        "notes": "Real benchmark (ml/run_pipeline.py). Every model sees the same 4 PCA angles; results are mean ± std (ddof=1) over seeds 0-4.",
    })
    return recs


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
    if not REAL.exists():
        sys.exit(f"{REAL} not found: run ml/run_pipeline.py first.")
    real = json.loads(REAL.read_text(encoding="utf-8"))
    schema = load("schema")
    codes = {d["id"]: d["code"] for d in load("datasets")}
    generated = real["meta"]["generatedAt"]
    n_seeds = len(real["meta"]["seeds"])
    if n_seeds < 2:
        sys.exit("real_results.json has a single seed (a --quick run?): export needs the full 5-seed run.")

    compare, trust, predict, children = load("compare"), load("trust"), load("predict"), load("experiment_children")
    children = [c for c in children if not str(c.get("id", "")).startswith("REAL-")]
    done = []
    for ds, deployed in real["deployed"].items():
        code = codes[ds]
        rows = [r for r in real["results"] if r["dataset"] == ds and r["features"] == "pca4"]
        full = [r for r in real["results"] if r["dataset"] == ds and r["features"] == "full"]
        n_features = len(real["datasets"][ds]["features"])
        qsvm_row = next(r for r in rows if r["model"] == "qsvm")
        compare[ds] = build_compare(ds, code, rows, full, n_seeds, n_features)
        trust[ds] = build_trust(ds, code, deployed, qsvm_row, trust[ds])
        for kind in ("sample", "unusual"):
            predict[ds][kind] = build_predict(ds, code, kind, predict[ds][kind], schema[ds], deployed, trust[ds], qsvm_row)
        children.extend(experiment_records(ds, code, sorted(rows, key=lambda r: MODEL_ORDER.index(r["model"])), generated, n_seeds, n_features))
        done.append(code)

    for name, data in (("compare", compare), ("trust", trust), ("predict", predict)):
        save(name, data)
    save("experiment_children", children)
    print(f"Real results merged for {', '.join(done)} into compare.json, trust.json, predict.json (+ REAL-* experiment records).")


if __name__ == "__main__":
    main()
