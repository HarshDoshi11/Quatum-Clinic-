# Q/Clinical — Early Signal Lab

Hybrid quantum-classical ML platform for early disease detection (SIH problem statement 139).
Research Mode is a lab dashboard; Patient Mode is a plain-language patient view.
The full product spec lives in the original brief. This file holds the **standing rules** every change must follow.

## Workflow

- Work in the agreed phases. After each phase, stop, summarise, and wait for approval.
- Before finishing any change, run `npm run typecheck`, `npm run lint` and `npm run check:mocks` in `frontend/`. Commit with a clear message.
- If mock data changes, run `npm run export:fixtures`. The backend serves those JSON files.

## Commands (frontend/)

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server, http://localhost:5173 |
| `npm run typecheck` / `npm run lint` | Strict TS (no `any`) / ESLint |
| `npm run check:mocks` | Asserts spec numbers and cross-page consistency |
| `npm run export:fixtures` | Regenerates `backend/app/fixtures/*.json` from the mocks |

Backend: `cd backend && .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000`.

## Architecture

- `src/routes.ts` is the single source of truth for navigation (sidebar, router, palette).
- `src/api` exposes `api.*`. Pages never import mocks directly. Load data with
  `useResource((signal) => api.x(datasetId, { signal }), [datasetId, version])`, where `version` comes from `useDataVersion()`.
- `src/mocks/data/canon.ts` holds the only hand-written numbers (the anchors). Everything else is derived from them.
  Never hard-code a result number in UI copy or in `src/content/`.
- User actions that other parts of the UI can also trigger go through `useAppActions()` (`src/features/actions.ts`),
  so each action shows the same toast wherever it's triggered.

## Beginner-friendly layer (required on every page)

1. **Page header.** Every page renders `<PageHeader route={route} />`. It provides the section label, the question
   headline, the **"What is this? ↗"** panel and the plain-language line. Every route needs an entry in
   `src/content/pages.ts` with `plain`, `shows`, `matters` and `read`. Add it in the same change that adds the page.
2. **Section headers.** Every section uses `<SectionHeader index title plain="…" />`. The `plain` prop is required: one
   sentence, no jargon, and no result numbers. It appears as "In simple words: …" when the top-bar Plain language
   toggle is on.
3. **Glossary.** Wrap every technical term in UI copy in `<Term>` (`<Term>AUC</Term>`, `<Term term="gate error">…</Term>`).
   Render API-provided text (takeaways, summaries) through `<Glossed text={…} />`, which wraps glossary words automatically.
   If a new technical word appears, add it to `src/lib/glossary.ts` with a one-line plain definition, and add its
   surface forms to `PHRASES` in `components/ui/Glossed.tsx`.
4. **Charts.** Each chart gets a one-sentence takeaway above it, preferably from the API's `takeaway` field.
5. **Experiment tags.** Each research page shows an `ExperimentTag` (e.g. "EXP-2037 · 5 SEEDS"). It opens the experiment drawer.
6. **Tour anchors.** Mark key regions with `data-tour="…"` if they may join a guided tour.

## Design system — "Lab Instrument"

- Colours come from CSS variables only (`bg-bg`, `text-ink`, `text-muted`, `border-rule`, `text-accent`, `bg-classical`,
  `text-risk-*`). Never hard-code hex values in components.
- **Accent (cobalt)** is only for data values, active states, quantum elements and the Bloch vector. It is never used
  for headlines, and covers under ~10% of any screen.
- **Quantum = accent, classical = grey, on every chart.** Risk colours are used only for risk.
- Instrument Serif is for headlines (single ink colour). IBM Plex Sans is for UI. IBM Plex Mono is for all numbers,
  IDs, parameters and uppercase section labels (`label-mono`, `num`).
- Use 1px hairline rules, not cards. Corners are at most 4px. Only the command palette, drawer and tour card get
  `shadow-float`.
- Never use purple, gradients (hard-stop slider fills excepted), glassmorphism, glows, emoji, icons in coloured
  circles, or two-tone headlines.
- Motion uses Framer Motion (`motion/react`). Keep it quick and precise (200–400ms), never bouncy. Share values via
  `src/lib/motion.ts`. Respect reduced motion (`MotionConfig reducedMotion="user"`, `useReducedMotion`).
- Every data view has a skeleton loading state and an empty or error state (`Skeleton`, `EmptyState`).
- Both themes must work. Canvas and WebGL colours come from `useThemeColors()`.
- Accessibility: keyboard reachable, a 1px accent focus outline, and aria labels on icon-only controls.
- Layout is desktop-first at 1440px and must stay usable at 1024px with no horizontal overflow.
