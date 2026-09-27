"""Request bodies. Field names are camelCase to match the frontend types (src/types)."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

DatasetId = Literal["wdbc", "heart"]
ModelId = Literal["vqc", "qsvm", "logreg", "svm", "rf", "xgboost"]
Encoding = Literal["angle", "amplitude"]
HardwareProfileId = Literal["ideal-sim", "fake-backend-1", "fake-backend-2", "custom"]
SweepType = Literal["small-data", "scalability", "evolution", "failure-envelope"]

PatientInput = dict[str, Optional[float]]


class TrainRequest(BaseModel):
    dataset: DatasetId
    models: list[ModelId] = Field(min_length=1)
    qubits: Literal[4, 6, 8]
    encoding: Encoding
    circuitDepth: int = Field(ge=1, le=4)
    seeds: int = Field(ge=1, le=5)


class NoiseParams(BaseModel):
    t1Us: Optional[float] = None
    t2Us: Optional[float] = None
    gateError1q: float = Field(ge=0)
    gateError2q: float = Field(ge=0)
    readoutError: float = Field(ge=0)
    shots: Optional[int] = None


class NoiseRunRequest(BaseModel):
    dataset: DatasetId
    profileId: HardwareProfileId
    noise: NoiseParams


class PredictRequest(BaseModel):
    dataset: DatasetId
    input: PatientInput
    threshold: Optional[float] = Field(default=None, gt=0, lt=1)


class ExplainRequest(BaseModel):
    dataset: DatasetId
    input: PatientInput


class ReportRequest(BaseModel):
    dataset: DatasetId
    input: PatientInput
