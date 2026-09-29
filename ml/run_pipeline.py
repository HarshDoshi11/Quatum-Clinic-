"""Run the real benchmark and write ml/results/real_results.json.

    ml/.venv/Scripts/python ml/run_pipeline.py                 # full run: both datasets, seeds 0-4
    ml/.venv/Scripts/python ml/run_pipeline.py --quick         # smoke test: 1 seed, 3 VQC epochs
    ml/.venv/Scripts/python ml/run_pipeline.py --kernel-mode overlap   # QSVM via the U†U overlap circuit

Each seed sets the stratified 80/20 split and every model's randomness. All transforms are fitted on the
training split only. Nothing is tuned on the test split, and quantum and classical models see the same
4 PCA angles (classical models are also run on all of the app's features, labelled "full").
"""

from __future__ import annotations

import argparse
import json
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qclinical_ml import data as data_mod  # noqa: E402
from qclinical_ml.classical import CLASSICAL, make_classical  # noqa: E402
from qclinical_ml.metrics import THRESHOLD, aggregate, evaluate  # noqa: E402
from qclinical_ml.prep import N_COMPONENTS, Prep  # noqa: E402
from qclinical_ml.quantum import QSVM, QSVM_REPS, VQC, VQC_LAYERS, check_kernel_modes  # noqa: E402

TEST_SIZE = 0.2
ERROR_SD = 0.1  # measurement error for input sensitivity, in SD of each continuous input (as in the app)


def config_key(dataset: str, model: str, features: str) -> str:
    """The app's configKey format, marked `real` so it never collides with a simulated config."""
    if model in CLASSICAL:
        return f"{dataset}|{model}|cpu|real-{features}"
    return f"{dataset}|{model}|{N_COMPONENTS}q|angle|d{VQC_LAYERS if model == 'vqc' else QSVM_REPS}|full|ideal-sim|real"


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def timed_fit_predict(model, Xtr, ytr, Xte):
    t0 = time.perf_counter()
    model.fit(Xtr, ytr)
    train_s = time.perf_counter() - t0
    t1 = time.perf_counter()
    p = model.predict_proba(Xte)
    p = p[:, 1] if p.ndim == 2 else p
    infer_ms = (time.perf_counter() - t1) / len(Xte) * 1000
    return p, train_s, infer_ms


def patients_frame(ds: data_mod.Dataset, patient: dict) -> pd.DataFrame:
    return pd.DataFrame([{k: (np.nan if patient.get(k) is None else float(patient[k])) for k in ds.X.columns}])


def population(ds: data_mod.Dataset) -> dict:
    """Training-population statistics for the distribution-shift check (whole dataset, missing ignored)."""
    mean = ds.X.mean()
    sd = ds.X.std(ddof=0)
    z = ((ds.X - mean) / sd).abs().max(axis=1, skipna=True)
    return {"mean": mean.to_dict(), "sd": sd.to_dict(), "typicalDistance": float(np.percentile(z, 95))}


def abstain_mask(ds: data_mod.Dataset, X: pd.DataFrame, pop: dict) -> np.ndarray:
    """The app's abstain rule per patient: a value outside the schema range, 3+ missing, or missing plus |z| > 3."""
    lo = pd.Series({f["key"]: f["min"] for f in ds.features})
    hi = pd.Series({f["key"]: f["max"] for f in ds.features})
    missing = X.isna().sum(axis=1)
    outside = ((X < lo) | (X > hi)).any(axis=1)
    z = ((X - pd.Series(pop["mean"])) / pd.Series(pop["sd"])).abs().max(axis=1, skipna=True)
    return (outside | (missing >= 3) | ((missing > 0) & (z > 3))).to_numpy()


def perturbations(ds: data_mod.Dataset, patient: dict, pop: dict) -> list[tuple[str, int, pd.DataFrame]]:
    """±ERROR_SD × SD on each present continuous input, one at a time (the app's input-sensitivity check)."""
    out = []
    for f in ds.features:
        x = patient.get(f["key"])
        if x is None or f["kind"] != "continuous":
            continue
        for direction in (-1, 1):
            q = dict(patient)
            q[f["key"]] = x + direction * ERROR_SD * pop["sd"][f["key"]]
            out.append((f["key"], direction, patients_frame(ds, q)))
    return out


def run_dataset(ds: data_mod.Dataset, seeds: list[int], epochs: int, kernel_mode: str) -> tuple[list[dict], dict, dict, list[str]]:
    per_seed: dict[tuple[str, str], list[dict]] = {}
    notes: list[str] = []
    deployed = {"model": "qsvm", "configKey": config_key(ds.id, "qsvm", "pca4"), "perSeed": [], "patients": {"sample": {}, "unusual": {}}}
    vqc_loss: list[list[float]] = []
    pop = population(ds)
    patients = {"sample": ds.sample_patient, "unusual": ds.unusual_patient}
    perturbed = {name: perturbations(ds, p, pop) for name, p in patients.items()}
    explained = []

    for seed in seeds:
        idx_tr, idx_te = train_test_split(np.arange(len(ds.y)), test_size=TEST_SIZE, stratify=ds.y, random_state=seed)
        Xtr_df, Xte_df = ds.X.iloc[idx_tr], ds.X.iloc[idx_te]
        ytr, yte = ds.y[idx_tr], ds.y[idx_te]
        prep4 = Prep(ds.categorical, "pca4", seed).fit(Xtr_df)
        prepF = Prep(ds.categorical, "full", seed).fit(Xtr_df)
        explained.append(prep4.explained_variance())
        A_tr, A_te = prep4.transform(Xtr_df), prep4.transform(Xte_df)
        F_tr, F_te = prepF.transform(Xtr_df), prepF.transform(Xte_df)

        for name in CLASSICAL:
            for feats, (tr, te) in (("pca4", (A_tr, A_te)), ("full", (F_tr, F_te))):
                p, ts, im = timed_fit_predict(make_classical(name, seed), tr, ytr, te)
                per_seed.setdefault((name, feats), []).append({"seed": seed, **evaluate(yte, p, ts, im)})

        vqc = VQC(seed=seed, epochs=epochs)
        p, ts, im = timed_fit_predict(vqc, A_tr, ytr, A_te)
        per_seed.setdefault(("vqc", "pca4"), []).append({"seed": seed, **evaluate(yte, p, ts, im)})
        vqc_loss.append(vqc.loss_history)

        qsvm = QSVM(seed=seed, mode=kernel_mode)
        p, ts, im = timed_fit_predict(qsvm, A_tr, ytr, A_te)
        per_seed.setdefault(("qsvm", "pca4"), []).append({"seed": seed, **evaluate(yte, p, ts, im)})
        notes.extend(qsvm.notes)
        deployed["perSeed"].append({
            "seed": seed,
            "yTest": yte.tolist(),
            "pTest": [round(float(v), 6) for v in p],
            "abstain": abstain_mask(ds, Xte_df, pop).tolist(),
            "subsampled": qsvm.subsampled,
        })

        # The app's demo patients through the same fitted pipeline and this seed's QSVM.
        for name, patient in patients.items():
            slot = deployed["patients"][name].setdefault("perSeed", [])
            slot.append(float(qsvm.predict_proba(prep4.transform(patients_frame(ds, patient)))[0]))
            pert = deployed["patients"][name].setdefault("perturbed", {})
            for key, direction, frame in perturbed[name]:
                pert.setdefault(f"{key}:{direction:+d}", []).append(float(qsvm.predict_proba(prep4.transform(frame))[0]))

        q = per_seed[("qsvm", "pca4")][-1]
        v = per_seed[("vqc", "pca4")][-1]
        best_c = max((per_seed[(m, "pca4")][-1] for m in CLASSICAL), key=lambda r: r["auc"])
        log(f"{ds.code} seed {seed}: QSVM AUC {q['auc']:.3f} ({q['trainTimeS']:.1f}s) · VQC AUC {v['auc']:.3f} ({v['trainTimeS']:.1f}s) · best classical (PCA-4) {best_c['auc']:.3f}")

    results = []
    for (model, feats), rows in per_seed.items():
        quantum = model in ("vqc", "qsvm")
        results.append({
            "dataset": ds.id,
            "model": model,
            "family": "quantum" if quantum else "classical",
            "features": feats,
            "configKey": config_key(ds.id, model, feats),
            "backend": "ideal-sim" if quantum else "cpu",
            "simulator": "pennylane lightning.qubit (state vector, noiseless)" if quantum else None,
            "qubits": N_COMPONENTS if quantum else None,
            "circuitDepth": (VQC_LAYERS if model == "vqc" else QSVM_REPS) if quantum else None,
            "parameters": (3 * N_COMPONENTS * VQC_LAYERS if model == "vqc" else 0) if quantum else None,
            "perSeed": rows,
            "metrics": aggregate(rows),
        })
    deployed["population"] = pop
    deployed["errorSd"] = ERROR_SD
    info = {
        "samples": int(len(ds.y)),
        "positive": int(ds.y.sum()),
        "features": [f["key"] for f in ds.features],
        "testPatients": int(round(len(ds.y) * TEST_SIZE)),
        "pcaExplainedVariance": {"mean": float(np.mean(explained)), "min": float(np.min(explained)), "max": float(np.max(explained))},
        "vqcLoss": vqc_loss,
        "notes": ds.notes,
    }
    return results, deployed, info, notes


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--datasets", nargs="+", default=["wdbc", "heart"], choices=["wdbc", "heart"])
    ap.add_argument("--seeds", nargs="+", type=int, default=[0, 1, 2, 3, 4])
    ap.add_argument("--epochs", type=int, default=40, help="VQC epochs (max 40)")
    ap.add_argument("--kernel-mode", default="statevector", choices=["statevector", "overlap"])
    ap.add_argument("--quick", action="store_true", help="smoke test: seed 0 only, 3 VQC epochs")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent / "results" / "real_results.json"))
    args = ap.parse_args()
    if args.quick:
        args.seeds, args.epochs = [0], 3
    args.epochs = min(args.epochs, 40)

    started = time.perf_counter()
    schema = data_mod.load_schema()
    out = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "seeds": args.seeds,
            "testSize": TEST_SIZE,
            "split": "stratified, one split per seed",
            "threshold": THRESHOLD,
            "std": "sample std (ddof=1) across seeds",
            "pipeline": "impute (train mean / mode) → clip to train range → StandardScaler → PCA(4) → min-max to [0, π]; fitted on train only",
            "vqc": {"embedding": "AngleEmbedding (RY)", "ansatz": "StronglyEntanglingLayers", "layers": VQC_LAYERS, "optimizer": "Adam (0.05)", "epochs": args.epochs, "batchSize": 16, "readout": "sigmoid(a·<Z0> + b)"},
            "qsvm": {"featureMap": "ZZ (Qiskit convention)", "reps": QSVM_REPS, "entanglement": "full", "kernel": "fidelity |<φ(y)|φ(x)>|²", "kernelMode": args.kernel_mode, "svc": "C=1, Platt probabilities"},
            "device": "pennylane lightning.qubit, 4 wires, noiseless",
            "versions": {"python": platform.python_version()},
            "notes": [],
        },
        "datasets": {},
        "results": [],
        "deployed": {},
    }
    import pennylane
    import sklearn
    import xgboost

    out["meta"]["versions"].update({"pennylane": pennylane.__version__, "scikit-learn": sklearn.__version__, "xgboost": xgboost.__version__, "numpy": np.__version__})

    for ds_id in args.datasets:
        ds = data_mod.load(ds_id, schema)
        log(f"{ds.code}: {len(ds.y)} rows, {int(ds.y.sum())} positive, {ds.X.shape[1]} features. " + " ".join(ds.notes))
        if ds_id == args.datasets[0]:
            prep = Prep(ds.categorical, "pca4").fit(ds.X)
            diff = check_kernel_modes(prep.transform(ds.X))
            out["meta"]["qsvm"]["kernelCheck"] = f"state-vector kernel vs overlap circuit: max |Δk| = {diff:.2e} on 12 random pairs"
            log(out["meta"]["qsvm"]["kernelCheck"])
        results, deployed, info, notes = run_dataset(ds, args.seeds, args.epochs, args.kernel_mode)
        out["results"].extend(results)
        out["deployed"][ds_id] = deployed
        out["datasets"][ds_id] = info
        out["meta"]["notes"].extend(notes)

    out["meta"]["runtimeS"] = round(time.perf_counter() - started, 1)
    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    log(f"Wrote {path} in {out['meta']['runtimeS'] / 60:.1f} min.")
    print_table(out["results"])


def print_table(results: list[dict]) -> None:
    header = f"{'dataset':7} {'model':8} {'features':8} {'AUC':>15} {'accuracy':>15} {'F1':>15} {'sensitivity':>15} {'train s':>12}"
    print("\n" + header + "\n" + "-" * len(header))
    order = {m: i for i, m in enumerate(["vqc", "qsvm", *CLASSICAL])}
    for r in sorted(results, key=lambda r: (r["dataset"], r["features"] != "pca4", order[r["model"]])):
        m = r["metrics"]
        fmt = lambda k, d=3: f"{m[k]['mean']:.{d}f} ± {m[k]['std']:.{d}f}"  # noqa: E731
        print(f"{r['dataset']:7} {r['model']:8} {r['features']:8} {fmt('auc'):>15} {fmt('accuracy'):>15} {fmt('f1'):>15} {fmt('sensitivity'):>15} {fmt('trainTimeS', 1):>12}")


if __name__ == "__main__":
    main()
