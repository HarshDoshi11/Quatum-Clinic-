# ML track: the real pipeline

Trains the six benchmark models on WDBC and UCI Heart (Cleveland) and merges the results into the backend
fixtures for **Advantage Observatory** and **Predict & Trust**. Every other page stays simulated.

## Run

```bash
python -m venv ml/.venv
ml/.venv/Scripts/python -m pip install -r ml/requirements.txt        # macOS/Linux: ml/.venv/bin/python
curl -o ml/data/processed.cleveland.data https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data

ml/.venv/Scripts/python ml/run_pipeline.py --quick     # smoke test, ~1 min (1 seed, 3 VQC epochs)
ml/.venv/Scripts/python ml/run_pipeline.py             # full run, ~35 min on a laptop CPU
ml/.venv/Scripts/python ml/export_to_fixtures.py       # merge into backend/app/fixtures
```

`npm run export:fixtures` (frontend) regenerates every fixture from the mocks; run `export_to_fixtures.py` again after it.
The frontend reads the fixtures only with `USE_MOCK=false` and the backend running.

## What it does

- **Data.** WDBC from `sklearn.datasets.load_breast_cancer`, using the app's ten "mean" features. Heart from
  `ml/data/processed.cleveland.data` (303 rows): cp, slope and thal recoded to the app's codes, target `num > 0`,
  missing ca/thal imputed with the training-split mode.
- **Pipeline** (fitted on the training split only): impute → clip to the training range → StandardScaler → PCA(4) →
  min-max to [0, π]. Seeds 0–4 set the stratified 80/20 split and each model's randomness.
- **Models.** LogReg, SVM (RBF), Random Forest, XGBoost on the 4 PCA angles (`pca4`) and on all features (`full`).
  VQC: AngleEmbedding + StronglyEntanglingLayers (2 layers), Adam, 40 epochs, batch 16, `lightning.qubit`.
  QSVM: ZZ feature map (2 reps, full entanglement), fidelity kernel into `SVC(kernel="precomputed")`.
- **Kernel.** By default each patient's state is simulated once on `lightning.qubit` and the kernel is taken
  from the overlaps, which is exactly the U†(y)U(x) circuit's value; every run checks this on random pairs.
  `--kernel-mode overlap` runs the circuit per pair and subsamples training to 200 if it would take over 10 min.
- **Metrics.** Accuracy, F1, ROC-AUC, sensitivity, specificity, train time, inference time; mean ± sample std
  over the five seeds, at a 0.5 threshold. Output: `ml/results/real_results.json`.

Nothing is tuned on the test split, and no model gets extra tuning. If quantum loses, the fixtures say so.
