/**
 * Patient Mode's interface text (English). Every key here is the source of truth; hi.ts and mr.ts may
 * translate any subset and fall back to these. Dataset-specific text (headline, questions, red flags)
 * lives in the dataset config, not here.
 */
export const en = {
  // Shell
  'shell.language': 'Language',
  'shell.readAloud': 'Read aloud',
  'shell.stopReading': 'Stop reading',
  'shell.researchView': 'Research view',
  'shell.footer': 'Decision support, not a diagnosis.',

  // Home
  'home.minutes': 'about {n} minutes',
  'home.warm': 'A few calm questions about results you already have, then a clear answer in plain words — and what to do next.',
  'home.start': 'Start the check',
  'home.data': 'How your data is used',
  'home.trust.browser': 'Stays in this browser',
  'home.trust.unsure': 'Tells you when it isn’t sure',
  'home.trust.doctor': 'Supports your doctor',
  'home.how.title': 'How it works',
  'home.how.safety': 'Safety check',
  'home.how.safety.body': 'First, we make sure nothing needs urgent care.',
  'home.how.questions': 'A few questions',
  'home.how.questions.body': 'One at a time, about results you already have.',
  'home.how.answer': 'Your answer',
  'home.how.answer.body': 'In plain words, with how sure it is.',
  'home.how.plan': 'Plan your visit',
  'home.how.plan.body': 'Questions and notes to bring to your doctor.',

  // "How your data is used"
  'data.title': 'How your data is used',
  'data.p1': 'Your answers stay in this browser tab while you use the check. Nothing is saved to your device or sent to anyone.',
  'data.p2': 'When you close or reload the page, your answers are gone.',
  'data.p3': 'If you download or share your summary, you choose where it goes.',
  'data.close': 'Close',

  // Safety check
  'safety.title': 'Before we start — are you having any of these right now?',
  'safety.helper': 'Choose any that apply.',
  'safety.none': 'None of these',
  'safety.continue': 'Continue',
  'safety.good': 'Good. Let’s continue.',
  'safety.urgent.title': 'Please get urgent medical help now.',
  'safety.urgent.body': 'What you described can be a sign of something that needs care straight away.',
  'safety.urgent.call': 'Call {number}',
  'safety.urgent.wait': 'This check can wait.',
  'safety.urgent.back': 'I chose this by mistake',

  // Assessment
  'assess.step': 'Step {n} of {total}',
  'assess.safetyStep': 'Safety check',
  'assess.notSure': 'I’m not sure',
  'assess.dontKnow': 'I don’t know this',
  'assess.back': 'Back',
  'assess.next': 'Continue',
  'assess.finish': 'See my answer',
  'assess.enter': 'Press Enter to continue',
  'assess.range': 'Most people are between {lo} and {hi}.',
  'assess.example': 'We’ve filled in example answers. Change any that don’t match yours.',
  'assess.empty': 'Start with empty answers',
  'assess.checking': 'Checking your answers…',
} as const

export type PatientKey = keyof typeof en
export type PatientDictionary = Partial<Record<PatientKey, string>>
