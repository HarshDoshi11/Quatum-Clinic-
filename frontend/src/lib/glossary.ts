/** One-line, plain-language definitions shown by <Term>. */
export const GLOSSARY = {
  auc: 'How well the model ranks sick above healthy patients: 1.0 is perfect, 0.5 is a coin flip.',
  sensitivity: 'Of the patients who have the disease, the share the model catches.',
  specificity: 'Of the patients who are healthy, the share the model correctly clears.',
  vqc: 'Variational Quantum Classifier: a trainable quantum circuit tuned like a neural network.',
  qsvm: 'Quantum Support Vector Machine: a classic SVM that measures similarity with a quantum circuit.',
  qubit: 'A quantum bit; it can hold a blend of 0 and 1 at once until it is measured.',
  t1: 'How long a qubit keeps its energy before relaxing to 0. Longer is better.',
  t2: 'How long a qubit keeps its phase (its quantum “blend”). Longer is better.',
  'gate error': 'The chance a single quantum operation goes slightly wrong.',
  'readout error': 'The chance a qubit is measured as the wrong value.',
  encoding: 'How patient data is turned into rotations of the qubits.',
  pca: 'Principal Component Analysis: squeezes many features into a few that keep most of the information.',
  ood: 'Out-of-distribution: a patient unlike anyone the model learned from.',
  calibration: 'Whether a predicted 80% really comes true about 80% of the time.',
  abstain: 'The model declines to answer when the evidence is too weak.',
  'pareto front': 'The designs where you cannot gain accuracy without adding cost.',
  shots: 'How many times a circuit is run and measured to estimate its result.',
  'circuit depth': 'How many layers of operations the circuit has; deeper circuits collect more noise.',
} as const

export type GlossaryKey = keyof typeof GLOSSARY
