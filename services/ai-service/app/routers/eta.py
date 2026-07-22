"""Cozum suresi (ETA) tahmini — ikinci ML modeli (regresyon) endpoint'i.

Manuel atama akisinda Incident Service bu endpoint'i cagirir (team_id veya
dogrudan distance_km ile); Swagger uzerinden juriye bagimsiz olarak da
gosterilebilir. Model dosyasi yoksa 503 doner — atama akislari bu endpoint'e
degil, /assign icindeki opsiyonel zenginlestirmeye dayanir.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.ml.eta import get_eta_estimator
from app.models_db import TeamCache
from app.schemas import EstimateRequest, EstimateResponse
from app.scoring import haversine_km

router = APIRouter(prefix="/api/v1/ai", tags=["eta"])


@router.post("/estimate", response_model=EstimateResponse)
def estimate(payload: EstimateRequest, db: Session = Depends(get_db)):
    estimator = get_eta_estimator()
    if estimator is None:
        raise HTTPException(status_code=503, detail="ETA modeli yuklu degil.")

    distance_km = payload.distance_km
    if distance_km is None and payload.team_id and payload.latitude is not None and payload.longitude is not None:
        team = db.get(TeamCache, payload.team_id)
        if team and team.lat is not None and team.lng is not None:
            distance_km = round(haversine_km(team.lat, team.lng, payload.latitude, payload.longitude), 2)

    result = estimator.estimate(
        fault_type=payload.fault_type,
        priority=payload.priority,
        distance_km=distance_km,
        historical_fault_count=payload.historical_fault_count,
    )
    return EstimateResponse(
        work_minutes=result["work_minutes"],
        travel_minutes=result["travel_minutes"],
        total_eta_minutes=result["total_eta_minutes"],
        distance_km=distance_km,
        eta_model_version=settings.eta_model_version,
        features_used=result["features_used"],
    )
