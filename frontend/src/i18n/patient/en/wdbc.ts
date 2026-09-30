import type { DatasetStrings } from '../types'

const cytology = (reportLabel: string, names: string[]) => ({ reportLabel, names, tip: 'Use the “mean” (average) value from the cell measurements table.' })

/** Patient Mode, English: the breast biopsy check. */
export const wdbc: DatasetStrings = {
  home: {
    eyebrow: 'Breast health check',
    headline: 'Got a biopsy report? Let’s make sense of it.',
    subtext: 'Answer what your report shows. You get a clear answer, how sure it is, and what to do next.',
  },
  urgent: null,
  report: {
    ask: 'Do you have your biopsy report with you?',
    yes: { label: 'Yes, I have it', body: 'We’ll ask for the cell measurements on it, and show you where to find each one.' },
    no: {
      label: 'No, I don’t have it',
      body: 'This check reads the measurements on a biopsy report, so without it there’s nothing to read yet. You can still see what to ask your doctor.',
    },
    title: 'Cytology report',
    sections: { size: 'Cell measurements: size', shape: 'Cell measurements: shape and texture' },
  },
  steps: { size: 'Size of the cells', shape: 'Shape and texture of the cells' },
  features: {
    radius_mean: {
      ask: 'What is the average cell radius on your report?',
      why: 'Abnormal cells often have larger centres than healthy ones.',
      find: cytology('Radius (mean)', ['Radius', 'Mean radius', 'Nuclear radius']),
    },
    perimeter_mean: {
      ask: 'What is the average cell perimeter?',
      why: 'The length around each cell centre is another sign of its size.',
      find: cytology('Perimeter (mean)', ['Perimeter', 'Mean perimeter']),
    },
    area_mean: {
      ask: 'What is the average cell area?',
      why: 'Larger cell centres are more common in abnormal cells.',
      find: cytology('Area (mean)', ['Area', 'Mean area', 'Nuclear area']),
    },
    texture_mean: {
      ask: 'What is the texture value?',
      why: 'Uneven colouring inside cells can be a sign of change.',
      find: cytology('Texture (mean)', ['Texture', 'Mean texture']),
    },
    smoothness_mean: {
      ask: 'What is the smoothness value?',
      why: 'Healthy cell edges tend to be smooth.',
      find: cytology('Smoothness (mean)', ['Smoothness', 'Mean smoothness']),
    },
    compactness_mean: {
      ask: 'What is the compactness value?',
      why: 'How tightly the cell outline is drawn in around its centre.',
      find: cytology('Compactness (mean)', ['Compactness', 'Mean compactness']),
    },
    concavity_mean: {
      ask: 'What is the concavity value?',
      why: 'Deep dents in a cell’s edge can be a sign of change.',
      find: cytology('Concavity (mean)', ['Concavity', 'Mean concavity']),
    },
    concave_points_mean: {
      ask: 'What is the concave points value?',
      why: 'How many dents a cell’s edge has.',
      find: cytology('Concave points (mean)', ['Concave points', 'Mean concave points']),
    },
    symmetry_mean: {
      ask: 'What is the symmetry value?',
      why: 'Healthy cells tend to be more even in shape.',
      find: cytology('Symmetry (mean)', ['Symmetry', 'Mean symmetry']),
    },
    fractal_dimension_mean: {
      ask: 'What is the fractal dimension value?',
      why: 'How complex, or wrinkled, a cell’s edge is.',
      find: cytology('Fractal dimension (mean)', ['Fractal dimension', 'Mean fractal dimension']),
    },
  },
}
