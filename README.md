# JeevSetu

<!-- Screenshots: add the images to docs/screenshots/ with these names. -->
| Overview | Advantage Observatory | Predict & Trust |
| --- | --- | --- |
| ![Overview](docs/screenshots/overview.png) | ![Advantage Observatory](docs/screenshots/advantage.png) | ![Predict & Trust](docs/screenshots/predict.png) |
| **Hardware Reality Lab** | **Explain** | **Patient Mode (coming soon)** |
| ![Hardware Reality Lab](docs/screenshots/hardware.png) | ![Explain](docs/screenshots/explain.png) | ![Patient Mode](docs/screenshots/patient.png) |

A hybrid quantum-classical machine-learning lab for early disease detection (Smart India Hackathon,
problem statement 139), tested on breast-cancer biopsies (WDBC) and heart-disease records (UCI Heart, Cleveland).

> Decision support, not a diagnosis.

## The pitch, in three stories

1. **Does quantum help?** The Advantage Observatory, Small-Data Explorer, Scalability Lab and Model Evolution
   Engine compare quantum models (VQC, QSVM) with classical baselines on the same patients, over 5 seeds, and
   only call a difference real when it beats the seed noise.
2. **Does it survive reality?** The Hardware Reality Lab and Failure Envelope run the quantum model under real
   hardware noise and corrupted patient data, and show where it stops being safe.
3. **Can a patient trust it?** Predict & Trust, Explain and the Patient Report show one prediction with its
   evidence (seed stability, data quality, distribution shift, calibration, input and hardware sensitivity), and
   the system says "no reliable answer" instead of guessing when the evidence is not there.

Patient Mode, the same model explained for the person it is about, is shown as a *Coming soon* page with its
build log; its screens are built and switched off behind one flag (`PATIENT_MODE_ENABLED` in `frontend/src/routes.ts`).

## Real vs simulated results

Every results page carries a badge next to its title, driven by the `source` field of the data it shows:

- **REAL · 5 SEEDS** (cobalt): produced by the real pipeline in [`ml/`](ml/README.md). Advantage Observatory and
  Predict & Trust show real results when the app runs against the backend (`VITE_USE_MOCK=false`).
- **SIMULATED** (graphite): the calibrated results store in `frontend/src/mocks/`, used by every page in mock
  mode and by the other research pages (Hardware Reality Lab, Scalability Lab, Failure Envelope, Model Evolution
  Engine, Small-Data Explorer, Explain, Cross-Modality, Train, Report) in both modes.

**The real results are reported as they came out.** Seeds 0–4, stratified 80/20 split per seed, every model on
the same 4 PCA features, quantum circuits on PennyLane `lightning.qubit` (noiseless), threshold 0.5:

| AUC (mean ± std) | VQC | QSVM | LogReg | SVM (RBF) | Random Forest | XGBoost |
| --- | --- | --- | --- | --- | --- | --- |
| WDBC | 0.967 ± 0.012 | 0.781 ± 0.049 | **0.982 ± 0.009** | 0.981 ± 0.011 | 0.974 ± 0.015 | 0.973 ± 0.012 |
| UCI Heart | 0.904 ± 0.033 | 0.740 ± 0.059 | **0.909 ± 0.026** | 0.898 ± 0.025 | 0.891 ± 0.038 | 0.889 ± 0.037 |

Quantum does not beat classical here. VQC ties LogReg on Heart within seed noise and trails it on WDBC just
beyond it; the QSVM's ZZ-feature-map kernel is concentrated (its values sit near those of random states) and
trails every classical model. Full metrics (accuracy, F1, sensitivity, specificity, train and inference time,
all-feature baselines) are in `ml/results/real_results.json`.

## Tech stack

- **Frontend:** Vite, React 18, TypeScript (strict), Tailwind CSS v4, Framer Motion (`motion`), Recharts,
  React Three Fiber + drei (three.js), cmdk, React Router.
- **Backend:** FastAPI stub serving JSON fixtures in exactly the frontend's API shapes.
- **ML:** Python, scikit-learn, XGBoost, PennyLane + `lightning.qubit`.

## Run it

Requires Node 20+.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The app opens in the dark theme; `Shift T` switches theme and `Shift P` turns on projector mode.

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run check:mocks` | Assert the simulated results agree with the spec and across pages |
| `npm run export:fixtures` | Regenerate `backend/app/fixtures/*.json` from the mocks |

### Configuration

Copy `frontend/.env.example` to `frontend/.env.local`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_USE_MOCK` | `true` | Serve the simulated results store in the browser |
| `VITE_API_URL` | `/api` | API base, used when `VITE_USE_MOCK=false` (relative; `npm run dev` proxies it to :8000) |

### Backend (for the real results)

Requires Python 3.10+.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then set `VITE_USE_MOCK=false` in `frontend/.env.local` and restart `npm run dev`. Interactive API docs:
http://localhost:8000/docs.

### Deploy (one Render web service)

FastAPI serves both the API (under `/api`) and the built frontend (`frontend/dist`, with an SPA fallback), so
the whole app is one service. [`render.yaml`](render.yaml) holds the settings:

- **Build:** `cd frontend && npm ci && VITE_USE_MOCK=false npm run build && cd ../backend && pip install -r requirements.txt`
- **Start:** `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health check:** `/api/health`

### ML pipeline

```bash
python -m venv ml/.venv
ml/.venv/Scripts/python -m pip install -r ml/requirements.txt      # macOS/Linux: ml/.venv/bin/python
curl -o ml/data/processed.cleveland.data https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data

ml/.venv/Scripts/python ml/run_pipeline.py --quick      # smoke test, ~1 min
ml/.venv/Scripts/python ml/run_pipeline.py              # full run, ~20 min on a laptop CPU
ml/.venv/Scripts/python ml/export_to_fixtures.py        # merge into the backend fixtures
```

`npm run export:fixtures` rebuilds every fixture from the mocks, so run `export_to_fixtures.py` again after it.
Details: [`ml/README.md`](ml/README.md).

## How it is built

```
qclinical/
├── frontend/   the app (src/pages, src/features, src/components, src/api, src/mocks)
├── backend/    FastAPI stub serving the fixtures
├── ml/         real pipeline: data, preprocessing, models, export to fixtures
└── docs/       product brief and design tokens
```

- **One API, two sources.** Pages call `api.*` (`frontend/src/api`) and never know whether the data is
  simulated or served by the backend.
- **One source of truth.** The simulated numbers derive from a handful of anchors in
  `frontend/src/mocks/data/canon.ts` through the results store, keyed by dataset + model + config, so the same
  configuration shows the same number on every page. Real configurations carry their own keys.
- **Honest by construction.** Claims are worded by whether a difference exceeds the combined seed noise; an
  abstained patient never shows a probability anywhere.
- **Readable.** One rem-based type scale, contrast ≥ 4.5:1 in both themes, a *Plain language* toggle, a
  glossary on every technical term, a guided tour, and projector mode (larger type, thicker chart lines,
  stronger contrast).
- **Accessible.** Keyboard navigation throughout, visible focus rings, labelled controls, and a screen-reader
  summary and table view for every chart; reduced-motion settings are respected, including the 3D scenes.
- **Light.** Every page and 3D scene is code-split; 3D canvases cap their pixel ratio and pause when off-screen.

Standing rules for changes are in [CLAUDE.md](CLAUDE.md); the product spec is in [docs/brief.md](docs/brief.md).

## Backend routes

All routes are under `/api` (e.g. `GET /api/compare?dataset=heart`); every other GET serves the frontend.

| Method | Route | Returns |
| --- | --- | --- |
| GET | `/health` | Liveness probe: `{"status": "ok"}` |
| GET | `/overview?dataset=` · `/status?dataset=` | Overview page · status strip |
| GET | `/datasets` · `/datasets/{id}` · `/datasets/{id}/schema` | Dataset list · profile + preprocessing · patient feature schema |
| POST | `/upload` | CSV profile (multipart `file`) |
| POST | `/train` | Loss curve + per-model results; creates an experiment |
| GET | `/experiments?dataset=&limit=` · `/experiments/{id}` | Experiment list · full record |
| POST | `/experiments/{id}/rerun` | New experiment with the same config |
| GET | `/compare?dataset=` | Benchmark table, resource scatter, seed stability |
| GET | `/sweeps/{small-data \| scalability \| evolution \| failure-envelope}?dataset=` | Sweep results |
| GET | `/noise/profiles` · POST `/noise/run` | Hardware profiles · noisy-vs-ideal operating point |
| POST | `/predict` · GET `/trust?dataset=` · POST `/explain` | Prediction + trust evidence · model calibration · attributions |
| GET | `/cross-modality?dataset=` | Per-modality AUCs (Heart only) |
| POST | `/report` | Plain-language patient report |

"ML hook" comments in `backend/app/main.py` mark where a live pipeline would replace each fixture.

## Build status

- [x] Phases 1–6: shell, data layer, research pages, Hardware Reality Lab, Failure Envelope, Predict & Trust, Explain, Cross-Modality, Patient Report
- [x] Phase 7: Patient Mode (built; shown as a Coming soon page for the Grand Finale)
- [x] ML track: real 5-seed benchmark for Advantage Observatory and Predict & Trust
- [x] Phase 8: polish for submission
