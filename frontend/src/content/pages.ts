/**
 * Beginner-friendly copy for every page: the plain-language line under the
 * headline and the three parts of the "What is this?" panel.
 * Rule (CLAUDE.md): every new page adds an entry here. No result numbers in
 * this file — numbers always come from the API.
 */
import type { PatientRouteId, ResearchRouteId } from '@/routes'

export interface PageGuide {
  /** One line, shown under the headline when Plain language is on. */
  plain: string
  shows: string
  matters: string
  read: string
}

export const PAGE_CONTENT: Record<ResearchRouteId | PatientRouteId, PageGuide> = {
  overview: {
    plain: 'We test whether quantum computers help spot disease early, whether that survives real hardware, and whether a patient can trust the answer.',
    shows: 'The headline results of the whole lab on one screen: the best quantum score, the three latest findings, how data flows through the hybrid pipeline, recent experiments and which machines are available.',
    matters: 'Quantum machine learning is often oversold. This page states plainly whether it helps on this disease, how fragile it is, and how often the system refuses to answer.',
    read: 'Blue numbers are measured results; blue shapes are quantum parts. Grey is classical. Click any experiment ID to see exactly how a result was produced.',
  },
  data: {
    plain: 'Before any model learns, the patient records are checked, cleaned and squeezed into a few numbers a quantum circuit can hold.',
    shows: 'The raw dataset, the type of each column, missing values, the balance between sick and healthy patients, and every cleaning step up to model-ready data.',
    matters: 'Bad data produces confident nonsense. Quantum circuits can only take a handful of inputs, so how we compress the data shapes every result downstream.',
    read: 'Follow the pipeline left to right. The target column (what we predict) is highlighted in blue. The PCA chart shows how much information survives compression.',
  },
  train: {
    plain: 'Pick which models to train, quantum and classical, and watch them learn.',
    shows: 'The available models, the quantum settings (qubits, encoding, circuit depth, seeds) and a live training curve.',
    matters: 'Fair comparisons need identical data, splits and seeds for every model. Everything you run here is recorded as an experiment you can reopen.',
    read: 'A falling loss curve means the model is learning; a gap between the two lines means it may be memorising rather than generalising.',
  },
  advantage: {
    plain: 'Does the quantum model actually beat normal machine learning on this disease, or just match it?',
    shows: 'Every model scored the same way over five random seeds, plus how quantum scores change as circuits get bigger.',
    matters: 'A quantum model is only worth its cost if it wins by more than the random wobble between runs.',
    read: 'Each cell is an average ± spread across seeds. The best value per column is blue. Dashed grey lines are the classical scores to beat.',
  },
  'small-data': {
    plain: 'When only a few patients are available, which kind of model learns more from them?',
    shows: 'How each model’s score grows as it sees more training patients, from 25 up to the full set.',
    matters: 'Rare diseases and new clinics have little data. If quantum models learn faster from few examples, that is a practical advantage.',
    read: 'Blue lines are quantum, grey are classical. Where the lines cross, the classical model takes over.',
  },
  scalability: {
    plain: 'What happens to cost and accuracy as we give the quantum model more qubits?',
    shows: 'Circuit depth, gate count, runtime and accuracy as the number of qubits grows from 4 to 12.',
    matters: 'Bigger circuits are slower and noisier. There is a point where extra qubits cost more than they give.',
    read: 'Read the four small charts together. The red marker shows where cost starts outrunning the gain.',
  },
  evolution: {
    plain: 'We tried many circuit designs; which one gives the best accuracy for the least complexity?',
    shows: 'Around twenty tested circuit designs, their accuracy against circuit depth, and the best trade-offs.',
    matters: 'Shallower circuits suffer less from hardware noise. A slightly less accurate but much simpler design is often the safer choice.',
    read: 'Each dot is a design. The line connects designs you cannot improve without adding depth. The highlighted dot is the recommendation.',
  },
  hardware: {
    plain: 'Real quantum chips are noisy. Does the model still catch sick patients when run on realistic hardware?',
    shows: 'Hardware profiles, a 3D view of the circuit, noise controls, and how sensitivity changes under that noise.',
    matters: 'A model that only works on a perfect simulator is not ready for a clinic. This page measures the gap.',
    read: 'Pick a profile or move the sliders, then run. The big numbers show perfect-simulator versus noisy results; red means worse.',
  },
  failure: {
    plain: 'Where exactly is the line between safe and unsafe, as hardware noise and bad data both get worse?',
    shows: 'A map of sensitivity across two kinds of trouble at once: hardware noise and corrupted patient data.',
    matters: 'Knowing the safe region in advance lets you refuse to deploy on hardware or data outside it.',
    read: 'Green is safe, amber is borderline, red is unsafe. The flat blue plane is the safety threshold. The marker shows today’s hardware.',
  },
  predict: {
    plain: 'Enter a patient’s results, get a risk estimate, and see whether that estimate deserves trust.',
    shows: 'A patient form, the predicted probability, a chart for choosing the decision threshold, and six pieces of trust evidence.',
    matters: 'A number without a reason to trust it is dangerous in medicine. When evidence is weak, the system says so and declines to answer.',
    read: 'Drag across the threshold chart to choose the cut-off: the blue line is how many sick patients are caught, and the green zone is where that stays safe. Filled squares are strong evidence, half-filled partial, empty weak. Try the “unusual patient” to see the system abstain.',
  },
  explain: {
    plain: 'Which of this patient’s results pushed the estimate up, and which pulled it down?',
    shows: 'How much each input moved the prediction, and what-if sliders to explore changes.',
    matters: 'Doctors need to check the model’s reasoning against their own. What-ifs show which factors could change the outlook.',
    read: 'Bars to the right raise risk, bars to the left lower it. The sliders change the original results; each change goes through the same cleaning and PCA as training. Inputs a patient can’t change are locked. This is a simulation, not advice.',
  },
  'cross-modality': {
    plain: 'Do different kinds of tests (ECG, blood work, symptoms) predict better together than alone?',
    shows: 'The score of each type of test on its own, and of all of them combined.',
    matters: 'It tells clinics which tests are worth ordering and whether combining them is worth the effort.',
    read: 'Each column is one kind of test. The blue bar is everything combined; the callout shows the gain over the best single test.',
  },
  report: {
    plain: 'A plain-language letter a patient can take to their doctor.',
    shows: 'The result, what it means, how reliable it is, what influenced it, next steps and questions to ask.',
    matters: 'Patients deserve an explanation they can understand, with clear limits on what the tool can say.',
    read: 'Read it top to bottom like a letter. Download it as a PDF for your doctor.',
  },
  'patient-home': {
    plain: 'A short, private check that explains a screening result in everyday words.',
    shows: 'What the assessment checks, how reliable it is, and what to do next.',
    matters: 'Understanding a result helps you have a better conversation with your doctor.',
    read: 'Start the assessment when you are ready. It takes a few minutes.',
  },
  'patient-assessment': {
    plain: 'Answer a few questions, one group at a time, to see your result.',
    shows: 'A step-by-step form and, at the end, your result in plain language.',
    matters: 'The more complete your answers, the more reliable the result.',
    read: 'The line at the top shows your progress. You can go back at any time.',
  },
  'patient-report': {
    plain: 'Your result written as a short letter you can share with your doctor.',
    shows: 'Your result, what it means, how reliable it is, and what to do next.',
    matters: 'It gives you and your doctor the same clear starting point.',
    read: 'Read it like a letter. Download it as a PDF to bring to your appointment.',
  },
}
