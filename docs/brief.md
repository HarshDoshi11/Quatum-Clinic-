You are building "Q/Clinical — Early Signal Lab": a web platform for a hybrid quantum-classical machine learning system for early disease detection (Smart India Hackathon, problem statement 139). It has a Research Mode (lab dashboard) and a Patient Mode (simple patient-facing view).

Work in PHASES. After each phase, stop, summarize what you built, and wait for my approval before continuing. Plan first, then build.

==================================================
TECH STACK
==================================================
Monorepo in the current folder:

qclinical/
├── frontend/   Vite + React + TypeScript
├── backend/    FastAPI (Python) — stub only for now
├── docs/
└── README.md

Frontend libraries:
- React 18 + TypeScript + Vite
- Tailwind CSS, with all colors defined as CSS variables for theming
- motion (Framer Motion, import from "motion/react") for ALL animation
- @react-three/fiber + @react-three/drei for 3D
- Recharts for charts, heavily restyled (no default look: no default grid, tooltips, or colors)
- react-router-dom for routing
- cmdk for the command palette
- lucide-react for the few icons needed (thin 1.5px stroke only)
- Fonts via Google Fonts: Instrument Serif, IBM Plex Sans, IBM Plex Mono

==================================================
DESIGN SYSTEM — "LAB INSTRUMENT"
==================================================
Swiss editorial design meets a precision scientific instrument. References: Teenage Engineering, Linear, Nothing, IBM Research papers. Minimal, confident, every element earns its place.

STRICTLY AVOID: purple, gradients, glassmorphism, glows, neon, emoji, icons in colored circles, generic dashboard card grids, heavy shadows, rounded corners over 4px, two-tone headline text.

THEMES (toggle in top bar, persisted in localStorage, respect prefers-color-scheme on first load, smooth 300ms color transition):

Light:
--bg #F3F1EC · --surface #ECE9E2 · --ink #0D0D0D · --muted #6B6B6B · --rule rgba(13,13,13,0.15)
--accent #2340FF (quantum) · --classical #8C8C8C
--risk-low #5E8C61 · --risk-mid #C8912B · --risk-high #B23A2E

Dark:
--bg #0D0D0D · --surface #151515 · --ink #F3F1EC · --muted #8A8A8A · --rule rgba(243,241,236,0.14)
--accent #4D63FF · --classical #7A7A7A
--risk-low #7FB083 · --risk-mid #E0A84A · --risk-high #D25A4D

Rules:
- Cobalt accent ONLY for data values, active states, quantum elements, and the Bloch state vector. Never for headline text. Under ~10% of any screen.
- Quantum = accent, classical = classical grey, on EVERY chart.
- Risk colors used only for risk.

Typography:
- Headlines: Instrument Serif, 64–120px, tight leading, single color (ink).
- UI: IBM Plex Sans.
- All numbers, metrics, IDs, parameters, section labels: IBM Plex Mono.
- Section labels uppercase mono: "01 — LATEST FINDINGS".
- Key metrics as oversized mono numerals.

Layout:
- 12-column grid, generous whitespace, 1px hairline rules instead of cards.
- Corners max 4px. Flat surfaces. No shadows except the command palette and drawer.

Motion (Framer Motion):
- Page transitions: fade + 12px upward slide, staggered children 0.04s.
- Numbers count up with springs.
- Chart lines draw in (pathLength 0→1).
- Slider-driven values use springs (stiffness ~120, damping ~20).
- Sliding active indicators via layoutId (sidebar marker, mode toggle, theme toggle).
- Quick and precise (200–400ms), never bouncy.
- Respect prefers-reduced-motion: disable non-essential motion.

==================================================
APP SHELL
==================================================
Sidebar (left, fixed):
- Logo "Q/Clinical" + mono subtitle "EARLY SIGNAL LAB"
- Groups:
  00. Setup — Overview, Data, Train
  I. Does quantum help? — Advantage Observatory, Small-Data Explorer, Scalability Lab, Model Evolution Engine
  II. Does it survive reality? — Hardware Reality Lab, Failure Envelope
  III. Can a patient trust it? — Predict & Trust, Explain, Cross-Modality, Patient Report
- Active marker: small accent square that slides to the CURRENT route (layoutId). It must always match the current page.
- Bottom: "SYSTEM NOMINAL" status + version.

Top bar:
- Dataset selector with chevron: "Breast Cancer (WDBC) · 569" / "Heart Disease (UCI) · 303". Changing it updates all data.
- Research / Patient segmented toggle (sliding indicator).
- Backend status in mono: "SIM · IDEAL · 4Q".
- Light/dark toggle (sun/moon, thin icons).
- "⌘K" hint button that opens the command palette.
- One "?" help button (the ONLY one in the app; nothing floating).

Bottom status strip: DATASET · BEST QUANTUM MODEL · QUBITS · LAST EXPERIMENT · UPDATED timestamp. Nothing overlaps it.

Global features:
- Command palette (⌘K / Ctrl+K): search and jump to any page, switch dataset, toggle theme/mode, "Run a prediction", "New experiment".
- Experiment drawer: clicking any experiment ID anywhere opens a right-side drawer with full config (dataset, features, PCA dims, encoding, qubits, circuit depth, backend, noise params, seed), all metrics, timestamp, and a "Re-run experiment" button.
- Glossary tooltips: a <Term> component that underlines jargon (dotted) and shows a one-line plain definition on hover. Include: AUC, sensitivity, specificity, VQC, QSVM, qubit, T1, T2, gate error, readout error, encoding, PCA, OOD, calibration, abstain, Pareto front, shots, circuit depth.
- Toast notifications (bottom-left, mono, minimal).
- Skeleton loaders and empty states on every data view.

==================================================
DATA LAYER (IMPORTANT)
==================================================
- Create frontend/src/types/ with TypeScript types for every API response.
- Create frontend/src/api/ with a service layer. A single flag USE_MOCK=true returns mock data from frontend/src/mocks/; when false, it calls the FastAPI backend at VITE_API_URL.
- Mock data must be ONE consistent source of truth. All numbers must agree everywhere:
  - Best overall: XGBoost AUC 0.921
  - Best quantum: QSVM AUC 0.914 ±0.012
  - VQC best AUC 0.909
  - Recent experiments: EXP-2048 VQC 4q FakeBackend-1 0.902 14:32 · EXP-2047 QSVM 4q Noisy Sim 0.914 13:48 · EXP-2046 XGBoost — CPU 0.921 12:16 · EXP-2045 VQC 8q Ideal Sim 0.909 11:02 · EXP-2044 LogReg — CPU 0.907 09:41
- Add a visible "MOCK DATA" mono tag in the status strip while USE_MOCK is true.
- Simulate latency (300–800ms) in mocks so loading states are visible.

Backend stub (backend/):
- FastAPI app with CORS, a /health endpoint, and routes stubbed to return the same mock JSON shapes: /datasets, /upload, /train, /experiments, /experiments/{id}, /compare, /predict, /trust, /explain, /noise/run, /sweeps/{type}, /cross-modality, /report.
- requirements.txt, a README section on how to run it.
- No ML code yet; leave clear TODO comments where the ML pipeline will plug in.

==================================================
PAGES
==================================================
Every research page has: an uppercase mono section label, a large Instrument Serif headline written as a question, a one-sentence takeaway above each chart, and an experiment tag (e.g. "EXP-042 · 5 SEEDS", clickable → drawer).

OVERVIEW (Research Mode)
- Headline on three forced lines: "Measure quantum advantage. / Test it against reality. / Earn patient trust." Single ink color.
- Right: 3D Bloch sphere (React Three Fiber). Latitude/longitude wireframe ONLY (8 meridians, 6 parallels), thin ink lines, poles labeled "|0⟩" (top) and "|1⟩" (bottom) in mono, thin X/Y/Z axes. Accent state vector from center ending EXACTLY on the surface (unit length) with a small cone head, slowly precessing. Draggable (OrbitControls, no zoom). Caption "DRAG TO INSPECT · θ = 1.12 · φ = 0.48" updating live as it moves. Nothing clipped. Lines adapt to theme.
- Hero metric: "0.914" + caption "BEST QUANTUM AUC · QSVM · ±0.012". Buttons: "Run a prediction →" (solid), "New experiment →" (outline).
- 01 — LATEST FINDINGS: three hairline columns — "QUANTUM VS CLASSICAL · Δ −0.007 AUC · QSVM 0.914 vs XGBoost 0.921 — within noise across 5 seeds." / "NOISE TOLERANCE · 1.2% · Sensitivity holds ≥ 85% up to this two-qubit gate error." / "TRUST · 4.1% · Of test patients abstained on. Zero high-confidence misses." Each with a "VIEW … ↗" link ~24px below.
- 02 — HYBRID PIPELINE: 7 labeled nodes (Data, Preprocess, PCA, Encode, Circuit, Measure, Evaluate); classical in grey, quantum (Encode, Circuit, Measure) in accent. A separate smaller accent dot travels along the line in a continuous 4s loop.
- 03 — RECENT EXPERIMENTS: mono table, hairline rows, rows clickable → drawer.
- 04 — BACKENDS: Ideal Sim (live), Noisy Sim (live), FakeBackend-1 (live), IBM QPU (offline).

DATA
- Dashed 1px upload zone (CSV). Preview table with column type badges, target column in accent. Oversized mono stats: samples, features, missing values, class balance.
- Preprocessing pipeline as nodes on a line: Raw → Clean → Missing Values → Outliers → Normalize → Feature Selection → PCA → Model-Ready. A "Run preprocessing" button animates a dot along the line, filling each node in turn.
- Before/after: missing values count and a PCA explained-variance chart.

TRAIN
- Model table with toggles: VQC, QSVM (accent square) and LogReg, SVM, Random Forest, XGBoost (grey square).
- Config in mono: qubits (4/6/8), encoding (Angle/Amplitude), circuit depth (1–4), seeds (1–5).
- Right: live loss curve drawing in, large mono epoch counter "EPOCH 23/50", progress rule. Toast on completion.

ADVANTAGE OBSERVATORY — "Does quantum actually help?"
- Mono results table (mean ± std, 5 seeds): Accuracy, Sensitivity, Specificity, ROC-AUC, Train time, Inference time. Best per column in accent.
- Scatter: performance vs quantum resources (qubits/depth), quantum configs as accent dots, classical baselines as dashed grey horizontal lines.
- Small multi-seed stability strip plot per model.

SMALL-DATA EXPLORER — "Does quantum help when data is scarce?"
- Learning curves: AUC vs training size (25, 50, 100, 200, all), quantum vs classical lines, crossover point marked if any.

SCALABILITY LAB — "What happens as the problem grows?"
- Four small-multiple charts vs qubits (4→12): circuit depth, gate count, runtime, AUC. A brick-colored "bottleneck" marker where growth outpaces gains, with a one-line explanation.

MODEL EVOLUTION ENGINE — "Which circuit design fits this disease?"
- Scatter of ~20 tested configs (AUC vs circuit depth), Pareto front drawn as a line, the recommended trade-off config highlighted. Table of configs below (encoding, qubits, depth, entanglement, AUC).

HARDWARE REALITY LAB — "Does it survive real hardware?" (hero screen)
- Left: hardware profiles list (Ideal Sim, FakeBackend-1, FakeBackend-2, Custom) with specs in mono (qubits, T1, T2, 1Q error, 2Q error, readout).
- Center: 3D quantum circuit (R3F): 4 qubit lines as thin rods, gates as small flat accent blocks, orbitable; gates subtly jitter as noise increases.
- Below: minimal sliders (thin track, small square thumb): 1Q gate error, 2Q gate error, T1, T2, readout error, shots. "Run simulation" button.
- Right: oversized mono metrics with spring-animated deltas, e.g. "91.4 → 84.2" with the delta in risk-high; line chart "Sensitivity vs T2".

FAILURE ENVELOPE — "When does it become unsafe?"
- 3D surface (R3F): x hardware noise, y data corruption, z sensitivity; colored low→mid→high risk; a translucent flat accent plane at the 85% threshold. Toggle to a 2D heatmap. "You are here" marker. Threshold input.

PREDICT & TRUST — "Should we trust this prediction?"
- Left: patient input form (underlined inputs, valid ranges in small mono), plus "Load sample patient" and "Load unusual patient" buttons for the demo.
- Right: oversized mono probability, thin semicircular gauge springing to value, risk label in risk color.
- "Trust Evidence" hairline list: Prediction Stability, Data Quality, Distribution Shift (OOD), Calibration, Input Sensitivity, Hardware Sensitivity — each with a filled/half/empty square mark and a one-line reason.
- ABSTAIN state (triggered by the unusual patient): the gauge fades out, replaced by Instrument Serif "Not enough evidence to decide." with reasons listed.
- Calibration curve and threshold slider showing live sensitivity/specificity changes.
- Footer: "DECISION SUPPORT · NOT A DIAGNOSIS".

EXPLAIN — "Why this prediction?"
- Feature influence bars from a center axis (risk-high increases risk, risk-low decreases).
- What-if sliders; immutable features (age, sex) locked with a lock glyph; risk number morphs "82 → 55". Label: "Model simulation, not medical advice."

CROSS-MODALITY — "Do signals reveal more together?" (Heart dataset)
- Five modalities in a hairline row: Demographics, Symptoms, ECG, Exercise Test, Blood Labs, each with an oversized mono AUC.
- Bar comparison single vs combined (combined in accent). Large callout: "Together: +6.2% over the best single signal."
- If WDBC is selected, show an empty state: "Cross-modality analysis uses the Heart Disease dataset." with a switch button.

PATIENT REPORT
- Numbered sections like a letter: 01 Your result, 02 What it means, 03 How reliable it is, 04 What influenced it, 05 What to do next (checklist), 06 Questions for your doctor, 07 Safety note.
- Buttons: "Download PDF for your doctor" (solid) and "Share" (outline). PDF export via browser print styles.

==================================================
PATIENT MODE
==================================================
When the toggle is set to Patient, the whole app switches (Framer Motion crossfade):
- Sidebar collapses to just: Home, Assessment, My Report.
- No AUC, qubits, experiments, backends, or 3D.
- Larger type, more whitespace, warmer copy.
- Home: headline "Understand your result, clearly.", a short plain explanation, one "Start assessment →" button, three plain points: "What it checks", "How reliable it is", "What to do next".
- Assessment: a simple step-by-step form (one group per step with a progress rule) → result screen in plain language, showing the risk word (Lower / Moderate / Higher) in Instrument Serif, a simple reliability meter, and next steps. If abstained: "We couldn't give a reliable result from this information. Please consult a doctor."
- My Report: the Patient Report page.
- Footer everywhere: "Decision support, not a diagnosis."

==================================================
QUALITY BAR
==================================================
- Fully typed, no `any`.
- Reusable components: SectionLabel, Headline, Metric, Term, HairlineTable, Slider, Gauge, StatusMark, ExperimentTag, Drawer, Toast.
- Desktop-first (1440px), usable down to 1024px.
- Accessible: keyboard navigation, focus states (1px accent outline), aria labels, sufficient contrast in both themes.
- README with setup and run instructions for frontend and backend.

==================================================
PHASES
==================================================
Phase 1 — Project setup, design tokens (both themes), fonts, app shell (sidebar, top bar, status strip, theme toggle, mode toggle, routing with placeholder pages). STOP for review.
Phase 2 — Types, mock data layer, API service layer, backend FastAPI stub. STOP.
Phase 3 — Overview page (including Bloch sphere) + global features (command palette, experiment drawer, glossary tooltips, toasts). STOP.
Phase 4 — Data, Train, Advantage Observatory, Small-Data Explorer, Scalability Lab, Model Evolution Engine. STOP.
Phase 5 — Hardware Reality Lab, Failure Envelope. STOP.
Phase 6 — Predict & Trust, Explain, Cross-Modality, Patient Report. STOP.
Phase 7 — Patient Mode. STOP.
Phase 8 — Polish pass: consistency of numbers, motion, both themes on every page, loading/empty states, accessibility, README. STOP.

Start with Phase 1. Show me your plan first.