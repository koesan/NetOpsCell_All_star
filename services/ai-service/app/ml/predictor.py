from datetime import datetime, timedelta, timezone

import joblib
import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.ml.features import ALL_FEATURES, build_feature_row
from app.ml.rules import apply_safety_net, priority_for, recommendation_for
from app.models_db import Prediction

TREND_HISTORY_WINDOW = 3
HISTORICAL_FAULT_WINDOW_DAYS = 30


class Predictor:
    def __init__(self, model_path: str):
        self.pipeline = joblib.load(model_path)

    def _compute_derived_features(self, db: Session, station_code: str, temperature: float, signal_strength: float, packet_loss: float) -> dict:
        recent = (
            db.query(Prediction)
            .filter(Prediction.station_code == station_code)
            .order_by(Prediction.created_at.desc())
            .limit(TREND_HISTORY_WINDOW)
            .all()
        )

        if recent:
            temperature_trend = temperature - recent[0].temperature
            avg_signal = sum(r.signal_strength for r in recent) / len(recent)
            signal_delta = signal_strength - avg_signal
            packet_loss_ma = (sum(r.packet_loss for r in recent) + packet_loss) / (len(recent) + 1)
        else:
            temperature_trend = 0.0
            signal_delta = 0.0
            packet_loss_ma = packet_loss

        since = datetime.now(timezone.utc) - timedelta(days=HISTORICAL_FAULT_WINDOW_DAYS)
        historical_fault_count = (
            db.query(func.count(Prediction.id))
            .filter(
                Prediction.station_code == station_code,
                Prediction.created_at >= since,
                Prediction.recommendation != "IZLE",
            )
            .scalar()
            or 0
        )

        return {
            "temperature_trend": round(temperature_trend, 2),
            "signal_delta": round(signal_delta, 2),
            "packet_loss_ma": round(packet_loss_ma, 2),
            "historical_fault_count": int(historical_fault_count),
        }

    def predict(
        self,
        db: Session,
        station_code: str,
        signal_strength: float,
        packet_loss: float,
        temperature: float,
        power_status: str,
    ) -> dict:
        derived = self._compute_derived_features(db, station_code, temperature, signal_strength, packet_loss)

        feature_row = build_feature_row(
            signal_strength=signal_strength,
            packet_loss=packet_loss,
            temperature=temperature,
            power_status=power_status,
            historical_fault_count=derived["historical_fault_count"],
            temperature_trend=derived["temperature_trend"],
            signal_delta=derived["signal_delta"],
            packet_loss_ma=derived["packet_loss_ma"],
        )

        X = pd.DataFrame([feature_row])[ALL_FEATURES]
        probabilities = self.pipeline.predict_proba(X)[0]
        class_labels = self.pipeline.classes_

        prob_by_class = dict(zip(class_labels, probabilities))
        # np.float64 -> float donusumu sart: numpy 2.x'te repr() 'np.float64(x)' dondugu icin
        # psycopg2'nin float adaptoru bozuk SQL uretir (schema "np" does not exist hatasi).
        normal_probability = float(prob_by_class.get("NORMAL", 0.0))
        fault_probability = round(1 - normal_probability, 4)

        fault_only = {k: v for k, v in prob_by_class.items() if k != "NORMAL"}
        predicted_fault_type = max(fault_only, key=fault_only.get) if fault_only else "BELIRSIZ"

        fault_probability, predicted_fault_type = apply_safety_net(fault_probability, predicted_fault_type, power_status)

        recommendation = recommendation_for(fault_probability)
        priority = priority_for(fault_probability, power_status)

        return {
            "probability": fault_probability,
            "fault_type": predicted_fault_type if recommendation != "IZLE" else None,
            "recommendation": recommendation,
            "priority_hint": priority,
            "model_version": settings.model_version,
            "features_used": feature_row,
        }


_predictor: Predictor | None = None


def get_predictor() -> Predictor:
    global _predictor
    if _predictor is None:
        _predictor = Predictor(settings.model_path)
    return _predictor
