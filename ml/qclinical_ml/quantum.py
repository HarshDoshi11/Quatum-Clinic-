"""Quantum models on PennyLane's lightning.qubit (exact state-vector simulation, no noise).

VQC: AngleEmbedding (RY) of the 4 PCA angles → StronglyEntanglingLayers (2 layers, 3·4·2 = 24 weights)
→ ⟨Z₀⟩, then p = sigmoid(a·⟨Z₀⟩ + b) with a trainable scale and bias. Binary cross-entropy, Adam,
mini-batches of 16, adjoint differentiation.

QSVM: ZZ feature map (Qiskit ZZFeatureMap convention: H, P(2xᵢ), and for every pair CNOT–P(2(π−xᵢ)(π−xⱼ))–CNOT;
2 repetitions, full entanglement), fidelity kernel k(x, y) = |⟨φ(y)|φ(x)⟩|², precomputed into sklearn SVC.

Kernel modes:
- "statevector" (default): simulate |φ(x)⟩ once per patient on lightning.qubit and take the overlaps. This is the
  same kernel as the overlap circuit, exactly; `check_kernel_modes` verifies it on random pairs every run.
- "overlap": run the U†(y)U(x) circuit for every pair (the textbook kernel circuit). If the projected time for the
  training kernel exceeds 10 minutes, the training split is subsampled to 200 (stratified) and the run logs it.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np
import pennylane as qml
from pennylane import numpy as pnp
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC

N_QUBITS = 4
WIRES = list(range(N_QUBITS))
VQC_LAYERS = 2
QSVM_REPS = 2
KERNEL_BUDGET_S = 600
SUBSAMPLE_TO = 200

_dev = qml.device("lightning.qubit", wires=N_QUBITS)


# ─── VQC ────────────────────────────────────────────────────


@qml.qnode(_dev, diff_method="adjoint")
def _vqc_circuit(weights, x):
    qml.AngleEmbedding(x, wires=WIRES, rotation="Y")
    qml.StronglyEntanglingLayers(weights, wires=WIRES)
    return qml.expval(qml.PauliZ(0))


def _sigmoid(z):
    return 1.0 / (1.0 + pnp.exp(-z))


@dataclass
class VQC:
    seed: int
    epochs: int = 40
    batch_size: int = 16
    lr: float = 0.05
    loss_history: list[float] = field(default_factory=list)

    def _expvals(self, weights, X):
        return pnp.stack([_vqc_circuit(weights, x) for x in X])

    def fit(self, X: np.ndarray, y: np.ndarray) -> "VQC":
        rng = np.random.default_rng(self.seed)
        shape = qml.StronglyEntanglingLayers.shape(n_layers=VQC_LAYERS, n_wires=N_QUBITS)
        weights = pnp.array(rng.normal(0.0, 0.1, size=shape), requires_grad=True)
        scale = pnp.array(1.0, requires_grad=True)
        bias = pnp.array(0.0, requires_grad=True)
        opt = qml.AdamOptimizer(stepsize=self.lr)
        eps = 1e-7

        def cost(w, a, b, Xb, yb):
            p = _sigmoid(a * self._expvals(w, Xb) + b)
            p = pnp.clip(p, eps, 1 - eps)
            return -pnp.mean(yb * pnp.log(p) + (1 - yb) * pnp.log(1 - p))

        n = len(X)
        for _ in range(self.epochs):
            order = rng.permutation(n)
            losses = []
            for start in range(0, n, self.batch_size):
                idx = order[start : start + self.batch_size]
                Xb = pnp.array(X[idx], requires_grad=False)
                yb = pnp.array(y[idx], requires_grad=False)
                (weights, scale, bias, _, _), loss = opt.step_and_cost(cost, weights, scale, bias, Xb, yb)
                losses.append(float(loss))
            self.loss_history.append(float(np.mean(losses)))
        self.weights, self.scale, self.bias = np.array(weights), float(scale), float(bias)
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        z = np.array([float(_vqc_circuit(self.weights, x)) for x in X])
        return 1.0 / (1.0 + np.exp(-(self.scale * z + self.bias)))

    @property
    def parameters(self) -> int:
        return 3 * N_QUBITS * VQC_LAYERS


# ─── QSVM ───────────────────────────────────────────────────


def zz_feature_map(x, reps: int = QSVM_REPS):
    for _ in range(reps):
        for i in WIRES:
            qml.Hadamard(wires=i)
            qml.PhaseShift(2.0 * x[i], wires=i)
        for i in WIRES:
            for j in WIRES[i + 1 :]:
                qml.CNOT(wires=[i, j])
                qml.PhaseShift(2.0 * (np.pi - x[i]) * (np.pi - x[j]), wires=j)
                qml.CNOT(wires=[i, j])


@qml.qnode(_dev)
def _state(x):
    zz_feature_map(x)
    return qml.state()


@qml.qnode(_dev)
def _overlap(x1, x2):
    zz_feature_map(x1)
    qml.adjoint(zz_feature_map)(x2)
    return qml.probs(wires=WIRES)


def states(X: np.ndarray) -> np.ndarray:
    return np.array([_state(x) for x in X])


def kernel_from_states(A: np.ndarray, B: np.ndarray) -> np.ndarray:
    return np.abs(A.conj() @ B.T) ** 2


def kernel_overlap(X1: np.ndarray, X2: np.ndarray, symmetric: bool = False) -> np.ndarray:
    K = np.empty((len(X1), len(X2)))
    for i, a in enumerate(X1):
        for j, b in enumerate(X2):
            if symmetric and j < i:
                K[i, j] = K[j, i]
            else:
                K[i, j] = float(_overlap(a, b)[0])
    return K


def check_kernel_modes(X: np.ndarray, pairs: int = 12, seed: int = 0) -> float:
    """Largest difference between the state-vector kernel and the overlap circuit on random pairs."""
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(X), size=(pairs, 2))
    sv = states(X[np.unique(idx)])
    lookup = {k: i for i, k in enumerate(np.unique(idx))}
    diff = 0.0
    for a, b in idx:
        k_sv = kernel_from_states(sv[[lookup[a]]], sv[[lookup[b]]])[0, 0]
        k_ov = float(_overlap(X[a], X[b])[0])
        diff = max(diff, abs(k_sv - k_ov))
    return diff


@dataclass
class QSVM:
    seed: int
    mode: str = "statevector"
    C: float = 1.0
    notes: list[str] = field(default_factory=list)
    subsampled: bool = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> "QSVM":
        if self.mode == "overlap":
            t0 = time.perf_counter()
            kernel_overlap(X[:4], X[:5])
            per_pair = (time.perf_counter() - t0) / 20
            projected = per_pair * len(X) * (len(X) + 1) / 2
            if projected > KERNEL_BUDGET_S and len(X) > SUBSAMPLE_TO:
                keep, _ = train_test_split(np.arange(len(X)), train_size=SUBSAMPLE_TO, stratify=y, random_state=self.seed)
                X, y = X[keep], y[keep]
                self.subsampled = True
                self.notes.append(f"QSVM kernel projected at {projected / 60:.1f} min > 10 min: training split subsampled to {SUBSAMPLE_TO} (seed {self.seed}).")
            self.X_train = X
            K = kernel_overlap(X, X, symmetric=True)
        else:
            self.S_train = states(X)
            K = kernel_from_states(self.S_train, self.S_train)
        self.svc = SVC(kernel="precomputed", C=self.C, probability=True, random_state=self.seed).fit(K, y)
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if self.mode == "overlap":
            K = kernel_overlap(X, self.X_train)
        else:
            K = kernel_from_states(states(X), self.S_train)
        return self.svc.predict_proba(K)[:, 1]

    @property
    def parameters(self) -> int:
        return 0
