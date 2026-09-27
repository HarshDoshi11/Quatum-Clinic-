/**
 * One-line, plain-language definitions shown by <Term>.
 * Rule: every technical word in UI copy is wrapped in <Term> (see CLAUDE.md).
 */
interface Entry {
  /** Display name in the tooltip header. */
  name: string
  definition: string
}

const entry = (name: string, definition: string): Entry => ({ name, definition })

export const GLOSSARY = {
  // Model quality
  auc: entry('AUC', 'How well the model ranks sick patients above healthy ones: 1.0 is perfect, 0.5 is a coin flip.'),
  sensitivity: entry('Sensitivity', 'Of the patients who have the disease, the share the model catches.'),
  specificity: entry('Specificity', 'Of the patients who are healthy, the share the model correctly clears.'),
  calibration: entry('Calibration', 'Whether a predicted 80% really comes true about 80% of the time.'),
  baseline: entry('Baseline', 'A standard classical model used as the yardstick quantum models must beat.'),
  abstain: entry('Abstain', 'The model declines to answer when the evidence is too weak.'),
  ood: entry('OOD', 'Out-of-distribution: a patient unlike anyone the model learned from.'),
  'pareto front': entry('Pareto front', 'The designs where you cannot gain accuracy without adding cost.'),

  // Models
  vqc: entry('VQC', 'Variational Quantum Classifier: a trainable quantum circuit tuned like a neural network.'),
  qsvm: entry('QSVM', 'Quantum Support Vector Machine: a classic SVM that measures patient similarity with a quantum circuit.'),

  // Data
  pca: entry('PCA', 'Principal Component Analysis: squeezes many features into a few that keep most of the information.'),
  encoding: entry('Encoding', 'How patient data is turned into rotations of the qubits.'),
  seed: entry('Seed', 'The random starting point of a run; repeating with different seeds shows how stable a result is.'),
  experiment: entry('Experiment', 'One recorded run: its data, model, settings and results, all under one ID.'),

  // Quantum basics
  qubit: entry('Qubit', 'A quantum bit; it can hold a blend of 0 and 1 at once until it is measured.'),
  superposition: entry('Superposition', 'A qubit holding a blend of 0 and 1 at the same time.'),
  'bloch sphere': entry('Bloch sphere', 'A globe that pictures one qubit: the north pole is 0, the south pole is 1.'),
  'state vector': entry('State vector', 'The arrow on the Bloch sphere showing the qubit’s current blend of 0 and 1.'),
  measurement: entry('Measurement', 'Reading a qubit; the blend collapses to a plain 0 or 1 with set probabilities.'),
  'circuit depth': entry('Circuit depth', 'How many layers of operations the circuit has; deeper circuits collect more noise.'),
  shots: entry('Shots', 'How many times a circuit is run and measured to estimate its result.'),

  // Hardware
  noise: entry('Noise', 'Random disturbances in real hardware that blur a qubit’s state.'),
  t1: entry('T1', 'How long a qubit keeps its energy before relaxing to 0. Longer is better.'),
  t2: entry('T2', 'How long a qubit keeps its phase (its quantum blend). Longer is better.'),
  'gate error': entry('Gate error', 'The chance a single quantum operation goes slightly wrong.'),
  'readout error': entry('Readout error', 'The chance a qubit is measured as the wrong value.'),
  backend: entry('Backend', 'Where a circuit actually runs: a simulator on a computer or a real quantum chip.'),
  simulator: entry('Simulator', 'Ordinary software that imitates a quantum computer, with or without noise.'),
  'fake backend': entry('Fake backend', 'A simulator loaded with the measured noise of a real quantum chip.'),
  threshold: entry('Safety threshold', 'The lowest sensitivity we accept before calling a setup unsafe for patients.'),
  qpu: entry('QPU', 'Quantum Processing Unit: a real quantum chip.'),
} as const satisfies Record<string, Entry>

export type GlossaryKey = keyof typeof GLOSSARY
