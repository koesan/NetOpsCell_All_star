"""Cozum suresi (ETA) tahmin modeli — ikinci ML modeli (regresyon).

Siniflandirma modelinden bagimsiz bir GradientBoosting/RandomForest regresyon
pipeline'i; atama aninda bilinen ozelliklerle (ariza turu, oncelik, mesafe,
saat, hafta sonu, istasyon gecmisi) sahadaki toplam IS suresini (dakika) tahmin
eder. Yol suresi ayri ve deterministik hesaplanir (sehir ici ortalama hiz +
yol kivrim faktoru) — boylece haritadaki canli ilerleme animasyonu ile ayni
varsayimlari paylasir.

Egitim: scripts/train_eta_model.py  ·  Veri: data/synthetic_resolution.csv
"""

import os
from datetime import datetime, timezone

import joblib
import pandas as pd

ETA_NUMERIC_FEATURES = ["distance_km", "hour_of_day", "is_weekend", "historical_fault_count"]
ETA_CATEGORICAL_FEATURES = ["fault_type", "priority"]
ETA_ALL_FEATURES = ETA_NUMERIC_FEATURES + ETA_CATEGORICAL_FEATURES

# Sehir ici saha araci varsayimlari — frontend'deki canli rota animasyonu ile senkron
URBAN_AVG_SPEED_KMH = 34.0
ROAD_CURVE_FACTOR = 1.35   # kus ucusu -> gercek yol mesafesi duzeltmesi
DEPARTURE_PREP_MINUTES = 5.0


def travel_minutes(distance_km: float | None) -> float | None:
    """Kus ucusu mesafeden tahmini surus suresi (dakika)."""
    if distance_km is None:
        return None
    road_km = distance_km * ROAD_CURVE_FACTOR
    return round(DEPARTURE_PREP_MINUTES + (road_km / URBAN_AVG_SPEED_KMH) * 60.0, 1)


def build_eta_feature_row(
    fault_type: str,
    priority: str,
    distance_km: float | None,
    historical_fault_count: int = 0,
    when: datetime | None = None,
) -> dict:
    now = when or datetime.now(timezone.utc)
    return {
        "fault_type": fault_type,
        "priority": priority,
        "distance_km": float(distance_km if distance_km is not None else 8.0),
        "hour_of_day": now.hour,
        "is_weekend": int(now.weekday() >= 5),
        "historical_fault_count": int(historical_fault_count),
    }


class EtaEstimator:
    def __init__(self, model_path: str):
        self.pipeline = joblib.load(model_path)

    def estimate(
        self,
        fault_type: str,
        priority: str,
        distance_km: float | None,
        historical_fault_count: int = 0,
        when: datetime | None = None,
    ) -> dict:
        row = build_eta_feature_row(fault_type, priority, distance_km, historical_fault_count, when)
        X = pd.DataFrame([row])[ETA_ALL_FEATURES]
        work = float(self.pipeline.predict(X)[0])
        work = max(20.0, min(480.0, work))
        travel = travel_minutes(distance_km)
        total = round(work + (travel or 0.0), 1)
        return {
            "work_minutes": round(work, 1),
            "travel_minutes": travel,
            "total_eta_minutes": total,
            "features_used": row,
        }


_estimator: EtaEstimator | None = None


def get_eta_estimator() -> "EtaEstimator | None":
    """Model dosyasi yoksa None doner — ETA opsiyonel bir zenginlestirmedir,
    yoklugu atama akisini asla bloke etmez (graceful degradation)."""
    global _estimator
    if _estimator is None:
        from app.config import settings

        if not os.path.exists(settings.eta_model_path):
            return None
        _estimator = EtaEstimator(settings.eta_model_path)
    return _estimator
