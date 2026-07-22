from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.ml.predictor import get_predictor
from app.ml.severity import get_severity_estimator
from app.models_db import Prediction
from app.schemas import EscalationRisk, PredictResponse, TelemetryIn

router = APIRouter(prefix="/api/v1/ai", tags=["predict"])


@router.post("/predict", response_model=PredictResponse)
def predict(payload: TelemetryIn, db: Session = Depends(get_db)):
    try:
        predictor = get_predictor()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503, detail="Model henuz egitilmedi (scripts/train_model.py calistirilmali)."
        ) from exc

    result = predictor.predict(
        db=db,
        station_code=payload.station_code,
        signal_strength=payload.signal_strength,
        packet_loss=payload.packet_loss,
        temperature=payload.temperature,
        power_status=payload.power_status,
    )

    db.add(
        Prediction(
            station_code=payload.station_code,
            signal_strength=payload.signal_strength,
            packet_loss=payload.packet_loss,
            temperature=payload.temperature,
            power_status=payload.power_status,
            probability=float(result["probability"]),
            predicted_fault_type=result["fault_type"] or "BELIRSIZ",
            recommendation=result["recommendation"],
            model_version=result["model_version"],
            incident_id=payload.incident_id,
        )
    )
    db.commit()

    # Ucuncu model (Telstra gercek verisi): istasyon gecmisinden eskalasyon riski.
    # Opsiyonel zenginlestirme — model yoksa veya hata olursa tahmin yaniti etkilenmez.
    escalation = None
    estimator = get_severity_estimator()
    if estimator is not None:
        try:
            sev = estimator.estimate(db, payload.station_code)
            escalation = EscalationRisk(
                risk=sev["risk"],
                probabilities=sev["probabilities"],
                model_version=settings.severity_model_version,
            )
        except Exception:  # noqa: BLE001
            escalation = None

    return PredictResponse(
        probability=result["probability"],
        fault_type=result["fault_type"],
        recommendation=result["recommendation"],
        priority_hint=result["priority_hint"],
        model_version=result["model_version"],
        escalation_risk=escalation,
    )
