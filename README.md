# Q/Clinical — Early Signal Lab

A hybrid quantum-classical machine-learning platform for early disease detection
(Smart India Hackathon, problem statement 139). Two views:

- **Research Mode** — a lab dashboard asking three questions: *Does quantum help? Does it survive
  reality? Can a patient trust it?*
- **Patient Mode** — a calm, plain-language view of a result and what to do next.

> Decision support, not a diagnosis.

## Repository

```
qclinical/
├── frontend/   Vite + React 18 + TypeScript + Tailwind v4
├── backend/    FastAPI stub serving the same JSON as the mocks
└── docs/       design notes
```

## Frontend

Requires Node 20+.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

| Script              | Does                           |
| ------------------- | ------------------------------ |
| `npm run dev`       | Dev server with HMR            |
| `npm run build`     | Typecheck + production build   |
| `npm run typecheck` | TypeScript only                |
| `npm run lint`      | ESLint (`no-explicit-any` on)  |
| `npm run preview`   | Serve the production build     |
| `npm run check:mocks` | Assert mock numbers agree with the spec and across pages |
| `npm run export:fixtures` | Regenerate `backend/app/fixtures/*.json` from the mocks |

### Configuration

Copy `frontend/.env.example` to `frontend/.env.local`:

| Variable        | Default                 | Meaning                                            |
| --------------- | ----------------------- | -------------------------------------------------- |
| `VITE_USE_MOCK` | `true`                  | Serve mock data; a `MOCK DATA` tag shows in the status strip |
| `VITE_API_URL`  | `http://localhost:8000` | FastAPI backend, used when `VITE_USE_MOCK=false`   |

### Structure

```
frontend/src/
├── types/               TypeScript types for every API request/response
├── api/                 service layer: `api` switches between mock and HTTP; `useResource` hook
├── mocks/               mock implementation (`mockApi`) + deterministic data builders
├── routes.ts            single source of truth for navigation (sidebar, router, palette)
├── state/               theme, dataset (persisted) and mode (derived from URL: /patient/* = Patient)
├── styles/tokens.css    design tokens for both themes — see docs/design-tokens.md
├── lib/                 domain constants, formatting, motion vocabulary, storage helpers
├── components/shell/    sidebar, top bar, status strip
├── components/ui/       SectionLabel, Headline, Metric, Term, HairlineTable, Drawer, Toast,
│                        ExperimentTag, Button, Skeleton, EmptyState, SegmentedToggle…
├── features/            command palette, experiment drawer, overview (Bloch sphere, pipeline)
└── pages/
```

### Data layer

Pages call `api.*` from `src/api` and never know whether data is mocked:

```ts
const overview = useResource((signal) => api.getOverview(datasetId, { signal }), [datasetId])
```

- **Mock mode** (`VITE_USE_MOCK` unset or `true`): `src/mocks/mockApi.ts` answers with 300–800ms simulated
  latency. A `MOCK DATA` tag shows in the status strip.
- **HTTP mode** (`VITE_USE_MOCK=false`): `src/api/http.ts` calls the FastAPI backend at `VITE_API_URL`.

**One source of truth.** Only a handful of anchor values are hand-written, in
`src/mocks/data/canon.ts`: each model's AUC ± std per dataset, the noise profiles, and the safety
threshold. Everything else is derived from them: sensitivity and specificity (equal-variance binormal ROC),
noise tolerance, learning curves, the circuit search, calibration, the cross-modality gain, and the abstain
rate. `npm run check:mocks` asserts the headline numbers (XGBoost 0.921, QSVM 0.914 ±0.012, VQC 0.909,
EXP-2044…2048, Δ −0.007, 1.2%, 4.1%, +6.2%) and that every experiment ID referenced anywhere resolves.

### Global features

- **Command palette:** `Ctrl K` / `⌘K`, or the Search button. Jump to any page, switch dataset, theme or
  mode, run a prediction, start an experiment, open a recent experiment.
- **Experiment drawer:** any experiment ID (table rows, `EXP-…` tags) opens its full config, metrics and a
  Re-run button. Re-runs create a new ID and refresh the status strip and lists.
- **Glossary:** `<Term>` adds a dotted underline and a one-line definition on hover or focus
  (`src/lib/glossary.ts`).
- **Toasts:** bottom-left, via `useToast()`.

## Backend

Requires Python 3.10+.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Interactive docs: http://localhost:8000/docs. To point the frontend at it, set `VITE_USE_MOCK=false` in
`frontend/.env.local` and restart `npm run dev`.

The backend is a **stub**: routes return JSON fixtures exported from the frontend mocks
(`npm run export:fixtures`), so both modes show identical data. `TODO(ml)` comments in
`backend/app/main.py` mark where the ML pipeline plugs in.

| Method | Route | Returns |
| ------ | ----- | ------- |
| GET | `/health` | Service status |
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

CORS allows any `localhost` port; add deployed origins with `CORS_ORIGINS=https://a.example,https://b.example`.

## Build status

- [x] Phase 1 — setup, design tokens, app shell, routing
- [x] Phase 2 — types, mock data, API service layer, backend stub
- [x] Phase 3 — Overview + global features
- [ ] Phase 4 — Data, Train, and research pages (section I)
- [ ] Phase 5 — Hardware Reality Lab, Failure Envelope
- [ ] Phase 6 — Predict & Trust, Explain, Cross-Modality, Patient Report
- [ ] Phase 7 — Patient Mode
- [ ] Phase 8 — Polish
