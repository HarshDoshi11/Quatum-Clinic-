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
├── backend/    FastAPI (stub — Phase 2)
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

### Configuration

Copy `frontend/.env.example` to `frontend/.env.local`:

| Variable        | Default                 | Meaning                                            |
| --------------- | ----------------------- | -------------------------------------------------- |
| `VITE_USE_MOCK` | `true`                  | Serve mock data; a `MOCK DATA` tag shows in the status strip |
| `VITE_API_URL`  | `http://localhost:8000` | FastAPI backend, used when `VITE_USE_MOCK=false`   |

### Structure

```
frontend/src/
├── routes.ts            single source of truth for navigation (sidebar, router, palette)
├── state/               theme, dataset (persisted) and mode (derived from URL: /patient/* = Patient)
├── styles/tokens.css    design tokens for both themes — see docs/design-tokens.md
├── lib/                 motion vocabulary, storage and platform helpers
├── components/shell/    sidebar, top bar, status strip
├── components/ui/       SectionLabel, Headline, Page, SegmentedToggle, Rule…
└── pages/
```

## Backend

Coming in Phase 2 (FastAPI stub with CORS, `/health` and mock routes).

## Build status

- [x] Phase 1 — setup, design tokens, app shell, routing
- [ ] Phase 2 — types, mock data, API service layer, backend stub
- [ ] Phase 3 — Overview + global features
- [ ] Phase 4 — Data, Train, and research pages (section I)
- [ ] Phase 5 — Hardware Reality Lab, Failure Envelope
- [ ] Phase 6 — Predict & Trust, Explain, Cross-Modality, Patient Report
- [ ] Phase 7 — Patient Mode
- [ ] Phase 8 — Polish
