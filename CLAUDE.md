# Q/Clinical — Early Signal Lab

Hybrid quantum-classical ML platform for early disease detection (SIH problem statement 139).
Research Mode is a lab dashboard; Patient Mode is a plain-language patient view.
The full product spec lives in `docs/brief.md`. This file holds the **standing rules** every change must follow.

## Spec & progress

- The full product spec (all pages, Patient Mode, phases) is in `docs/brief.md`. Read it before starting any phase.
  If the brief and this file disagree, this file wins.
- Phases 1–6: done and approved (Phase 6 includes the Predict & Trust rework and the Explain workspace).
- Phase 7 — Patient Mode: done ("Calm Clinic" redesign, Parts A and B), awaiting approval. Pages in `src/pages/patient/`:
  Home (breathing visual), Assessment (one config group per step → "Checking your answers…" → My Report), and
  My Report (100-people grid, confidence meter, influence cards, journey timeline, copyable questions, safety note,
  PDF / Share). Patient Mode shows no AUC, qubits, models, experiments, backends or 3D; `check:mocks` asserts the
  patient-facing text has no research jargon, the patient config covers every input and every outcome, and the
  report's next steps are the config's journey. The assessment edits the shared in-memory patient.
  A "For your doctor" clinician page in the PDF is pending: there is no Clinician Report yet.
- Next: Phase 8 (polish).
- After Phase 6, an ML track begins in `ml/` (real pipeline + experiment scripts). Its outputs must match the mock
  response shapes exactly, so switching USE_MOCK=false needs no UI changes.
- Update this section at the end of every session.

## Hardware Lab rules

- Selecting a backend profile in the Hardware Reality Lab gives exactly the same metrics as that backend's
  "You are here" point in the Failure Envelope at 0% corruption (same dataset, model, seeds, results store).
- When "Custom" is selected, show its origin and edits, e.g. "BASED ON FAKEBACKEND-1 · EDITED: 2Q ERROR".
- The QSVM kernel circuit renders U†(B) as the exact mirror of U(A): same gates in reverse order, inverse rotations
  labelled on hover (e.g. "P(−2x)").
  
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
- Per-dataset behaviour is declared on the dataset config (`DATASETS` in `src/lib/domain.ts`, e.g. `lockedFeatures`,
  `explainCaption`, `modalities`, `reportSubject`, `riskBandEdges`) and reaches pages through the API. Never special-case a dataset ID in a page or mock; a new
  dataset defines its own behaviour by adding a config entry.
- The patient being assessed lives in `useCurrentPatient` (`src/state/patient.tsx`): Predict sets it, Explain and
  the Report read it. It is patient data, so it stays in memory and is never written to storage.
- Every patient input, including what-if changes, goes through the one training pipeline
  (`src/mocks/data/pipeline.ts`: impute → clip → standardise → PCA → angle encoding) before the model sees it.
  What-if controls always edit the original features, never PCA components.

## Results data (required everywhere)

1. **Realistic, per-dataset results.** Every page reads the selected dataset. WDBC is realistic for that dataset:
   classical AUC ≈ 0.985–0.995 and accuracy ≈ 95–98%, with quantum slightly below or comparable (QSVM ≈ 0.975–0.99,
   VQC ≈ 0.96–0.98). Heart keeps classical AUC ≈ 0.88–0.92 and accuracy ≈ 80–85%. No two datasets may show
   identical numbers; `check:mocks` enforces this.
2. **Respect uncertainty.** Every line chart shows a shaded ±1 std band across the 5 seeds. Every headline claim is
   *computed*, and its wording depends on whether the difference exceeds the combined std
   (`√(σ₁² + σ₂²)`):
   - Within noise, the text says so ("within seed noise", "stays flat within seed noise", "all models vary similarly").
   - Only claim a crossover if the bands separate on both sides. Otherwise say "the gap closes by ~N patients".
   - Never write a comparative result into copy by hand. Put the wording rule in the mock or API layer.
3. **One formatter per column.** Use `src/lib/format.ts` everywhere. A column of durations uses a single unit chosen
   by `durationColumn(values)` (seconds with 1 decimal, or mm:ss for the whole column). Never mix units in a cell or
   column. Inference uses `formatMs`, which prints "<0.01 ms", never "±0.00".
4. **Chart honesty.** Overlapping points get small deterministic, symmetric jitter, so every seed or design stays
   visible. A zoomed axis carries an "AXIS ZOOMED · min–max" note. Markers such as the bottleneck or recommendation
   are placed by an explicit computed rule, and the rule is shown on the chart. Every figure shows its evaluation
   setting as a mono subtitle (e.g. "5 SEEDS · HELD-OUT 30% · IDEAL SIM · WDBC"). Parameter counts come from the
   ansatz formula (StronglyEntanglingLayers 3·q·d; RealAmplitudes q·(d+1); ZZ kernel 0), and differences such as
   "N fewer parameters" are computed.
5. **Single source of truth.** All results come from the results store, `src/mocks/data/results.ts`, keyed by
   dataset + model + config (`configKey`). The same config shows the same number on every page: Train, Advantage
   Observatory, Scalability, Evolution, experiment records and the status strip. Responses carry `configKey` next to
   `auc`. In dev, the mock API warns on any key reported with two values, and `check:mocks` asserts no conflicts
   across all endpoints. The real backend must keep the same contract.
6. **Abstained patients never show a reported probability anywhere.** When the system abstains, Predict, Explain,
   the Patient Report and Patient Mode show "No reliable answer" / "No reliable result" with the computed reasons —
   never a probability, seed interval, risk band, natural frequency, or text that leaks the number. The API enforces
   it (`probability: null` when abstaining; Explain's raw value lives only in `rawProbability`), and `check:mocks`
   asserts it. The only exception is Explain's Research-Mode toggle "Show raw model estimate" (off by default,
   labelled "RAW ESTIMATE · NOT REPORTED", hidden entirely in Patient Mode).
7. **Say which backend the numbers come from.** A page whose results come from a specific backend declares it with
   `usePageBackend(backend, qubits)` (the top bar then shows it) and shows `<BackendNote>` ("THIS PAGE USES NOISY
   SIM · QSVM 4Q"). Never silently contradict the top bar.

## Demo-critical layout

- **Key results fit the first screen** on demo-critical pages, without scrolling, at 1366×768 and 1440×900
  (browser viewport). On Predict & Trust that is the result block and risk scale, the threshold scrubber and the
  collapsed trust evidence list, in a sticky column beside the scrolling form, under a one-line header (≤ 120px);
  details live in expandable rows, not extra sections. Short viewports compact via `SHORT_VIEWPORT`
  (`lib/useMediaQuery.ts`) / `[@media(max-height:52rem)]:`. Verify by measuring element positions in a headless
  browser, in every state (normal, abstain, cleared form).

## Beginner-friendly layer (required on every page)

1. **Page header.** Every page renders `<PageHeader route={route} />`. It provides the section label, the question
   headline, the **"What is this? ↗"** panel and the plain-language line. Every route needs an entry in
   `src/content/pages.ts` with `plain`, `shows`, `matters` and `read`. Add it in the same change that adds the page.
2. **Section headers.** Every section uses `<SectionHeader index title plain="…" />`. The `plain` prop is required: one
   sentence, no jargon, and no result numbers. It appears as "In simple words: …" when the top-bar Plain language
   toggle is on. **The Plain language toggle works on every page; no page opts out.** Demo-critical pages (Predict &
   Trust, Explain) use the compact style (`<SectionHeader compact />`, `<PageHeader compact />`): a "?" popover beside
   each label always, and while the toggle is on a one-line type-small muted line under the label (truncated, with a
   "more" link to the popover; in the page header it sits beside "What is this?"). It must not push essential content
   below the first screen at 1440×900.
3. **Glossary.** Wrap every technical term in UI copy in `<Term>` (`<Term>AUC</Term>`, `<Term term="gate error">…</Term>`).
   Render API-provided text (takeaways, summaries) through `<Glossed text={…} />`, which wraps glossary words automatically.
   If a new technical word appears, add it to `src/lib/glossary.ts` with a one-line plain definition, and add its
   surface forms to `PHRASES` in `components/ui/Glossed.tsx`.
4. **Charts.** Each chart gets a one-sentence takeaway above it, preferably from the API's `takeaway` field.
5. **Experiment tags.** Each research page shows an `ExperimentTag` (e.g. "EXP-2037 · 5 SEEDS"). It opens the experiment drawer.
6. **Tour anchors.** Mark key regions with `data-tour="…"` if they may join a guided tour.

## Typography & readability (required everywhere)

**Type scale.** These are the only font sizes allowed. Use the `type-*` utilities from `src/styles/index.css`
(tokens are in `tokens.css`). Never write `text-[NNpx]`, Tailwind `text-sm` and similar, or inline font sizes.

| Utility | Size | Face | Use |
| --- | --- | --- | --- |
| `type-display` | clamp(56px, 6vw, 96px), lh 1.0 | Instrument Serif | Page headlines only |
| `type-h2` | 36px, lh 1.1 | Instrument Serif | Panel / drawer / card titles |
| `type-metric-xl` | 72px | IBM Plex Mono | Hero metrics |
| `type-metric` | 32px | IBM Plex Mono | Metrics, finding values |
| `type-body-lg` | 18px, lh 1.6 | IBM Plex Sans | Lead text, plain-English readouts |
| `type-body` | 16px, lh 1.6 | IBM Plex Sans | Default running text |
| `type-ui` | 15px, lh 1.5 | IBM Plex Sans | Sidebar navigation, table rows, definition lists |
| `type-small` | 14px, lh 1.5 | IBM Plex Sans | Secondary text, hints, tooltips |
| `type-label` | 13px, uppercase, 0.06em | IBM Plex Mono | Section labels, table headers, tags, kbd |
| `type-micro` | 12px, uppercase, 0.06em | IBM Plex Mono | **Status strip only** |

- Nothing may render below 12px. Uppercase tracking is at most 0.06em. Don't add `leading-*` overrides to text that
  uses a `type-*` utility, because the token already sets line-height.
- For mono numbers at a sans size, combine the classes: `num type-small`.
- All sizes are rem, so **projector mode** (Shift+P: 115% root size, stronger contrast) scales everything. Size
  chrome in rem too.
- **Contrast.** `--muted` must be at least 4.5:1 on `--bg` and `--surface` in both themes. Hairlines can stay
  subtle, but text never can. Don't lower contrast with opacity on text.
- **Measure.** Running text is capped at about 70ch (the `measure` utility).
- **Tables.** Use `HairlineTable`: 15px rows (`type-ui`), 13px mono headers (`type-label`), rows at least 44px tall
  (`h-11`), tabular numerals.
- **Charts.** Axis and tick labels are at least 12px. Label lines directly instead of using legends where possible.
  Quantum is accent and classical is grey. Build every chart from the kit in `src/components/charts/`:
  - Wrap it in `ChartFigure`, which provides the label, the takeaway above the plot, the legend and the required
    Chart / Table toggle.
  - Style axes with the `AXIS` / `TICK` props and colours with `C.*` (CSS variables, so charts follow theme and
    projector mode).
  - Put ticks on round values with `niceScale` / `niceTimeScale`. Never show values like 0.916 or 26:56.
  - Use `endLabel` + `resolveLabelOffsets` for direct labels, and size gutters and gaps with `useChartUnits()`.
    Never use fixed pixel values for text spacing.
  - Hover shows the `ChartTooltipCard`. Lines draw in, and markers are at least 8px across.
  - When two series share a colour (two quantum or two classical models), the second is dashed.
  - There is never a second y-axis.
- **Numbers.** Always format through `src/lib/format.ts`. AUC has 3 decimals (`formatAuc`), percentages have 1
  decimal (`formatPercent`), and durations are mm:ss or ms (`formatDuration`, `formatMs`). Use a true minus sign
  (`formatDelta`).
- **Fit.** Test at 1366×768, 1440×900, 1920×1080 and 125% browser zoom, with projector mode both off and on.
  Nothing may overlap, clip or scroll horizontally. Chrome that competes for space (the top bar and status strip)
  compacts with rem-based container queries (`@container`, `@min-[68rem]:…`), not viewport breakpoints.
- **3D.** Every React Three Fiber scene is code-split with `lazyScene(() => import(...))` and rendered inside
  `<SceneFrame>` (`src/components/three/LazyScene.tsx`), so pages paint instantly.
- **Titles.** `document.title` is set per route ("Hardware Reality Lab — Q/Clinical") from `routes.ts`, so new
  routes get it automatically.
- **Shortcuts.** Global shortcuts live in `SHORTCUTS` (`src/features/shortcuts/Shortcuts.tsx`), which drives both
  the handler and the sheet. Add new ones there, and never trigger them while the user is typing in a field.

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
- **Never use a native `<select>`.** Use `Select` (`src/components/ui/Select.tsx`): a keyboard-accessible listbox
  that follows the theme. An empty choice is labelled "Not recorded", muted, and listed last.
- A risk *word* uses the text-safe risk tokens (`text-risk-low-text`, `text-risk-mid-text`, `text-risk-high-text`,
  ≥ 4.5:1 in both themes); the plain `risk-*` colours are for marks and fills.
- Never use purple, gradients (hard-stop slider fills excepted), glassmorphism, glows, emoji, icons in coloured
  circles, or two-tone headlines.
- **Patient Mode ("Calm Clinic")** has its own token layer, `[data-mode='patient']` in `tokens.css` (AppShell sets
  `data-mode`): the accent becomes sage (text-safe `--risk-low-text`), panels and buttons get 8px corners
  (`rounded-panel`, `rounded-control`; Research keeps 4px / 2px), and `bg-accent-soft` tints selections. On patient
  pages: `type-body-lg` as the default text, lines ≤ 60ch, sections ≥ 56px apart, mono only for report IDs and dates,
  risk colours only for the risk word and the icon grid, motion 250–500ms eased (`tGentle`, `stepSlide`). Patient
  copy (name, per-input icon and question, next-step journeys per outcome) comes from `DATASETS[id].patient`; icons
  map through `features/patient/icons.ts`, never per dataset in a component. Patient section titles are Instrument
  Serif `type-h2`; soft `bg-surface` + `rounded-panel` panels are allowed in Patient Mode only. Numbers for patients
  are natural frequencies ("Out of 100 people with results like yours, about 52 have …") and the 100-people grid;
  an abstained patient gets an outlined grid with a "?" and no number. Sections reveal once on scroll (`Reveal`,
  which always prints visible); print styles keep only the page.
- Motion uses Framer Motion (`motion/react`). Keep it quick and precise (200–400ms), never bouncy. Share values via
  `src/lib/motion.ts`. Respect reduced motion (`MotionConfig reducedMotion="user"`, `useReducedMotion`).
- Every data view has a skeleton loading state and an empty or error state (`Skeleton`, `EmptyState`).
- Both themes must work. Canvas and WebGL colours come from `useThemeColors()`.
- Accessibility: keyboard reachable, a 1px accent focus outline, and aria labels on icon-only controls.
- Layout is desktop-first at 1440px and must stay usable at 1024px with no horizontal overflow.
