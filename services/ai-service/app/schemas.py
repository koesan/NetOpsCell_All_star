from typing import Optional

from pydantic import BaseModel, Field

from app.ml.features import POWER_STATUS_VALUES


class TelemetryIn(BaseModel):
    station_code: str
    signal_strength: float = Field(..., ge=-130, le=0, description="dBm")
    packet_loss: float = Field(..., ge=0, le=100, description="%")
    temperature: float = Field(..., ge=-40, le=150, description="Celsius")
    power_status: str = Field(..., description=f"Biri: {', '.join(POWER_STATUS_VALUES)}")
    incident_id: Optional[str] = None


class PredictResponse(BaseModel):
    probability: float
    fault_type: Optional[str]
    recommendation: str
    priority_hint: str
    model_version: str


class AssignRequest(BaseModel):
    incident_id: str
    fault_type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AssignedTeam(BaseModel):
    team_id: str
    name: Optional[str]
    score: float
    uzmanlik_eslesme: float
    mesafe_yakinlik: float
    bosluk_orani: float
    distance_km: Optional[float]


class AssignResponse(BaseModel):
    assigned_team: Optional[AssignedTeam]
    queued: bool
    candidates_evaluated: int


class AccuracyResponse(BaseModel):
    total_predictions: int
    misclassifications: int
    accuracy_percent: float


class CategoryAccuracy(BaseModel):
    fault_type: str
    total: int
    misclassified: int
    accuracy_percent: float
