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


class EscalationRisk(BaseModel):
    """Ucuncu model (Telstra/Kaggle gercek verisi) ciktisi — bkz. app/ml/severity.py."""

    risk: str  # DUSUK | ORTA | YUKSEK
    probabilities: dict[str, float]
    model_version: str


class PredictResponse(BaseModel):
    probability: float
    fault_type: Optional[str]
    recommendation: str
    priority_hint: str
    model_version: str
    escalation_risk: Optional[EscalationRisk] = None


class AssignRequest(BaseModel):
    incident_id: str
    fault_type: str
    priority: Optional[str] = "ORTA"
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
    team_lat: Optional[float] = None
    team_lng: Optional[float] = None
    # ETA modeli (ikinci model, regresyon) ciktilari — bkz. app/ml/eta.py
    travel_minutes: Optional[float] = None
    work_minutes: Optional[float] = None
    total_eta_minutes: Optional[float] = None
    eta_model_version: Optional[str] = None


class AssignCandidate(BaseModel):
    """Skor tablosundaki alternatif ekipler — supervizor 'neden bu ekip?' panelinde gosterilir."""

    team_id: str
    name: Optional[str]
    score: float
    uzmanlik_eslesme: float
    mesafe_yakinlik: float
    bosluk_orani: float
    distance_km: Optional[float]
    has_capacity: bool


class AssignResponse(BaseModel):
    assigned_team: Optional[AssignedTeam]
    queued: bool
    candidates_evaluated: int
    candidates: list[AssignCandidate] = []


class EstimateRequest(BaseModel):
    fault_type: str
    priority: str
    distance_km: Optional[float] = None
    team_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    historical_fault_count: int = 0


class EstimateResponse(BaseModel):
    work_minutes: float
    travel_minutes: Optional[float]
    total_eta_minutes: float
    distance_km: Optional[float]
    eta_model_version: str
    features_used: dict


class TeamInfo(BaseModel):
    team_id: str
    name: Optional[str]
    expertise: list[str]
    region: list[str]
    lat: Optional[float]
    lng: Optional[float]
    active_incidents: int
    max_capacity: int
    available: bool


class AccuracyResponse(BaseModel):
    total_predictions: int
    misclassifications: int
    accuracy_percent: float


class CategoryAccuracy(BaseModel):
    fault_type: str
    total: int
    misclassified: int
    accuracy_percent: float
