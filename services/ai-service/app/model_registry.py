"""Faz 3 - Model registry senkronizasyonu.

Egitim script'i (scripts/train_model.py) metrikleri bir JSON dosyasina yazar; bu
modul FastAPI baslangicinda o dosyayi okuyup ai-db'deki model_registry tablosuna
(zaten Faz 1'de tanimliydi ama hic doldurulmuyordu) kaydeder. Boylece "hangi model
versiyonu ne zaman, hangi veri seti ve metriklerle egitildi" sorusu Supervizor
dashboard'u veya bir DB sorgusu ile her zaman izlenebilir (model izlenebilirligi /
sustainability - bkz. ARCHITECTURE.md Bolum 9.3).
"""

import json
import logging
import os

from sqlalchemy.orm import Session

from app.config import settings
from app.models_db import ModelRegistry

logger = logging.getLogger("ai-service.model_registry")

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")


def sync_model_registry(db: Session) -> None:
    metrics_path = os.path.join(MODELS_DIR, f"model_{settings.model_version}_metrics.json")
    if not os.path.exists(metrics_path):
        logger.warning("Model metrik dosyasi bulunamadi (%s); model_registry guncellenmedi.", metrics_path)
        return

    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    existing = db.get(ModelRegistry, settings.model_version)
    if existing:
        logger.info("model_registry zaten guncel: %s", settings.model_version)
        return

    db.add(
        ModelRegistry(
            version=settings.model_version,
            metrics=metrics,
            artifact_path=settings.model_path,
        )
    )
    db.commit()
    logger.info(
        "model_registry kaydedildi: %s (macro-F1=%.4f, veri parmak izi=%s)",
        settings.model_version,
        metrics.get("test_macro_f1", 0),
        metrics.get("dataset_fingerprint", "?"),
    )
