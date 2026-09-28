import type { DatasetStrings } from '../types'

/** Patient Mode, English: the heart check. */
export const heart: DatasetStrings = {
  home: {
    eyebrow: 'Heart health check',
    headline: 'Got a heart test report? Let’s make sense of it.',
    subtext: 'Answer what you know from your latest results. You get a clear answer, how sure it is, and what to do next.',
  },
  urgent: {
    strip: 'chest pain right now, trouble breathing, or fainting',
    signs: ['Chest pain or pressure right now', 'Severe breathlessness', 'Fainting, or feeling like you might faint'],
  },
  report: {
    ask: 'Do you have a recent heart test report with you?',
    yes: { label: 'Yes, I have it', body: 'We’ll ask for a few values from it, and show you where to find each one.' },
    no: {
      label: 'No, just answer what I know',
      body: 'We’ll ask only about you and how you’ve been feeling. With fewer answers the result is less certain, and may not be possible.',
    },
    title: 'Heart test report',
    sections: {
      vitals: 'Vital signs',
      blood: 'Blood tests',
      ecg: 'Resting ECG',
      stress: 'Exercise (treadmill) test',
      scan: 'Heart scan',
      angio: 'Angiography',
    },
  },
  steps: { about: 'About you', feeling: 'How you’ve been feeling', report: 'From your report' },
  features: {
    age: {
      ask: 'How old are you?',
      why: 'The chance of heart disease changes with age.',
      rangeNote: 'This check was built from people aged {min}–{max}, so for you the answer may be less certain.',
    },
    sex: {
      ask: 'What is your sex?',
      why: 'Heart disease often shows up differently in men and women.',
      options: { 0: { label: 'Female' }, 1: { label: 'Male' } },
    },
    cp: {
      ask: 'What is your chest pain usually like?',
      why: 'How and when it hurts helps tell heart pain from other pain.',
      options: {
        0: { label: 'Pressure that comes with effort', example: '“A squeezing pressure when I walk fast, that eases when I rest.”' },
        1: { label: 'Sometimes like that, sometimes not', example: '“A tightness now and then, not always when I’m active.”' },
        2: { label: 'Pain that doesn’t feel like my heart', example: '“A sharp pain when I press on my chest or twist.”' },
        3: { label: 'I don’t get chest pain', example: '“I haven’t had any chest pain.”' },
      },
    },
    exang: {
      ask: 'Do you get chest pain when you exercise?',
      why: 'Pain that comes with effort can mean the heart isn’t getting enough blood.',
      options: { 0: { label: 'No' }, 1: { label: 'Yes' } },
    },
    trestbps: {
      ask: 'What is the top number of your blood pressure?',
      why: 'Blood pressure is written as two numbers, like 120/80. We need the top one, measured at rest.',
      find: {
        reportLabel: 'BP (mmHg)',
        names: ['Blood pressure', 'BP', 'Systolic', 'Resting BP'],
        tip: 'Written like 130/85: the first, bigger number is the one we need.',
      },
    },
    chol: {
      ask: 'What is your total cholesterol?',
      why: 'Cholesterol can build up inside the heart’s blood vessels.',
      find: {
        reportLabel: 'Cholesterol, total',
        names: ['Total cholesterol', 'Serum cholesterol', 'TC', 'Lipid profile'],
        tip: 'Use the “total” line, not HDL or LDL.',
      },
    },
    fbs: {
      ask: 'Was your fasting blood sugar above 120 mg/dL?',
      why: 'High blood sugar strains the heart and blood vessels over time.',
      options: { 0: { label: 'No, 120 or below' }, 1: { label: 'Yes, above 120' } },
      find: {
        reportLabel: 'Glucose, fasting',
        names: ['Fasting blood sugar', 'FBS', 'Fasting glucose', 'FPG'],
        tip: 'Taken in the morning before eating. Compare the number with 120.',
      },
    },
    thalach: {
      ask: 'What was your highest heart rate in the exercise test?',
      why: 'How high your heart rate climbs with effort shows how your heart copes.',
      find: {
        reportLabel: 'Max HR achieved',
        names: ['Maximum heart rate', 'Peak heart rate', 'Max HR', 'HR max'],
        tip: 'In the treadmill test summary, often next to the exercise time.',
      },
    },
    restecg: {
      ask: 'What did your resting ECG show?',
      why: 'A heart tracing at rest can show strain or a thickened heart wall.',
      options: {
        0: { label: 'Normal', example: 'Written as “normal” or “within normal limits”' },
        1: { label: 'Small changes in the waves', example: 'Written as “ST-T changes” or “T-wave changes”' },
        2: { label: 'A thickened heart wall', example: 'Written as “LVH” or “left ventricular hypertrophy”' },
      },
      find: {
        reportLabel: 'Impression',
        names: ['ECG', 'EKG', '12-lead ECG', 'Resting electrocardiogram'],
        tip: 'Look for the “Impression” or “Conclusion” line.',
      },
    },
    oldpeak: {
      ask: 'How much did your ECG line dip during exercise?',
      why: 'A dip during effort can mean the heart muscle is short of blood.',
      find: {
        reportLabel: 'ST depression (mm)',
        names: ['ST depression', 'ST segment depression', 'Oldpeak'],
        tip: 'Written in millimetres, like “1.5 mm ST depression”. If it says there was none, enter 0.',
      },
    },
    slope: {
      ask: 'At peak exercise, which way did your ECG line slope?',
      why: 'The direction of the line at peak effort adds detail to the dip.',
      options: {
        0: { label: 'Rising', example: 'Written as “upsloping”' },
        1: { label: 'Flat', example: 'Written as “flat” or “horizontal”' },
        2: { label: 'Falling', example: 'Written as “downsloping”' },
      },
      find: {
        reportLabel: 'ST slope',
        names: ['ST slope', 'Slope of the peak exercise ST segment'],
        tip: 'In the treadmill test findings, near the ST depression.',
      },
    },
    thal: {
      ask: 'What did your heart scan show?',
      why: 'This scan shows how well blood reaches the heart muscle.',
      options: {
        0: { label: 'Normal', example: 'Written as “normal perfusion”' },
        1: { label: 'An area that gets too little blood, even at rest', example: 'Written as “fixed defect”' },
        2: { label: 'An area that gets less blood only during effort', example: 'Written as “reversible defect” or “ischaemia”' },
      },
      find: {
        reportLabel: 'Perfusion · Impression',
        names: ['Thal', 'Thallium stress test', 'Myocardial perfusion', 'Nuclear stress test', 'MPI'],
        tip: 'Often a separate report from the nuclear medicine department.',
      },
    },
    ca: {
      ask: 'How many main heart vessels looked narrowed?',
      why: 'Narrowed vessels mean less blood reaches the heart.',
      options: { 0: { label: 'None' }, 1: { label: 'One' }, 2: { label: 'Two' }, 3: { label: 'Three' } },
      find: {
        reportLabel: 'Vessels involved',
        names: ['Major vessels', 'Coronary angiogram', 'CAG', 'Fluoroscopy'],
        tip: 'Count the main vessels the report describes as narrowed or blocked.',
      },
    },
  },
}
