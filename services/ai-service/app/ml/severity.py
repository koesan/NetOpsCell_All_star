"""Eskalasyon riski modeli — GERCEK veriyle (Telstra/Kaggle) egitilmis ucuncu model.

Yeni bir vaka acilirken istasyonun yakin gecmis "olay yogunlugu" profiline bakarak
arizanin buyume/eskalasyon riskini (DUSUK / ORTA / YUKSEK) tahmin eder. NOC operatoru
bu sinyali onceliklendirme ve kaynak planlamada ek bir gosterge olarak kullanir —
SLA onceligini DEGISTIRMEZ (o, case 4.3'teki kurallarla belirlenir), yaninda gosterilir.

Alan uyarlamasi (domain adaptation) — DURUST SINIRLAR:
Model Telstra'nin log-tabanli ozellikleriyle egitilmistir; NetOpsCell calisma aninda
ayni OLCEKTE benzer anlamli ozellikler istasyon gecmisinden turetilir:
  event_count            <- son 30 gunde istasyondaki tahmin (telemetri degerlendirme) sayisi
  distinct_event_types   <- ayni pencerede gorulen farkli ariza turu sayisi
  log_count              <- istasyonun toplam telemetri kaydi sayisi
  distinct_log_features  <- farkli oneri bandi sayisi (IZLE/VAKA_AC/ACIL)
  log_volume_sum         <- ariza olasiliklarinin toplami x10 (yogunluk vekili)
  resource_count         <- ACIL onerisi sayisi
  severity_type_ord      <- son onerinin siddet sirasi (IZLE=0, VAKA_AC=1, ACIL=2)
Bu esleme birebir ayni dagilimi garanti etmez; kisit ML_APPROACH.md Bolum 11'de
acikca belgelenmistir. Cikti bir "risk gostergesi"dir, kesin karar mekanizmasi degildir.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

import joblib
import pandas as pd

if TYPE_CHECKING:  # egitim scripti sqlalchemy olmadan da calisabilmeli
    from sqlalchemy.orm import Session

SEVERITY_FEATURES = [
    "event_count",
    "distinct_event_types",
    "log_count",
    "distinct_log_features",
    "log_volume_sum",
    "resource_count",
    "severity_type_ord",
]

RISK_LABELS = {0: "DUSUK", 1: "ORTA", 2: "YUKSEK"}
_RECOMMENDATION_ORD = {"IZLE": 0, "VAKA_AC": 1, "ACIL": 2}
HISTORY_WINDOW_DAYS = 30


def build_runtime_features(db: "Session", station_code: str) -> dict:
    from app.models_db import Prediction

    since = datetime.now(timezone.utc) - timedelta(days=HISTORY_WINDOW_DAYS)
    recent = (
        db.query(Prediction)
        .filter(Prediction.station_code == station_code, Prediction.created_at >= since)
        .order_by(Prediction.created_at.desc())
        .limit(200)
        .all()
    )
    total_count = db.query(Prediction).filter(Prediction.station_code == station_code).count()

    fault_types = {p.predicted_fault_type for p in recent if p.predicted_fault_type and p.predicted_fault_type != "BELIRSIZ"}
    recommendations = [p.recommendation for p in recent if p.recommendation]
    last_ord = _RECOMMENDATION_ORD.get(recommendations[0], 0) if recommendations else 0

    return {
        "event_count": len(recent),
        "distinct_event_types": len(fault_types),
        "log_count": total_count,
        "distinct_log_features": len(set(recommendations)),
        "log_volume_sum": round(sum(float(p.probability or 0) for p in recent) * 10, 1),
        "resource_count": sum(1 for r in recommendations if r == "ACIL"),
        "severity_type_ord": last_ord,
    }


class SeverityEstimator:
    def __init__(self, model_path: str):
        self.pipeline = joblib.load(model_path)

    def estimate(self, db: "Session", station_code: str) -> dict:
        features = build_runtime_features(db, station_code)
        X = pd.DataFrame([features])[SEVERITY_FEATURES]
        proba = self.pipeline.predict_proba(X)[0]
        classes = list(self.pipeline.classes_)
        prob_by_class = {RISK_LABELS[int(c)]: round(float(p), 4) for c, p in zip(classes, proba)}
        predicted = int(classes[int(proba.argmax())])
        return {
            "risk": RISK_LABELS[predicted],
            "probabilities": prob_by_class,
            "features_used": features,
        }


_estimator: "SeverityEstimator | None" = None


def get_severity_estimator() -> "SeverityEstimator | None":
    """Model dosyasi yoksa None — eskalasyon riski opsiyonel bir zenginlestirmedir."""
    global _estimator
    if _estimator is None:
        from app.config import settings

        if not os.path.exists(settings.severity_model_path):
            return None
        _estimator = SeverityEstimator(settings.severity_model_path)
    return _estimator
