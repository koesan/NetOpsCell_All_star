from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models_db import Misclassification, ModelRegistry, Prediction
from app.schemas import AccuracyResponse, CategoryAccuracy
from app.ml.features import FAULT_CLASSES

router = APIRouter(prefix="/api/v1/ai", tags=["accuracy"])


@router.get("/model-info")
def model_info(db: Session = Depends(get_db)):
    """Model izlenebilirligi: hangi versiyon, ne zaman, hangi veri seti ve metriklerle
    egitildi (bkz. ARCHITECTURE.md Bolum 9.3 - Model Dogrulama/Registry)."""
    rows = db.query(ModelRegistry).order_by(ModelRegistry.trained_at.desc()).all()
    return [
        {
            "version": r.version,
            "trained_at": r.trained_at,
            "artifact_path": r.artifact_path,
            "test_macro_f1": (r.metrics or {}).get("test_macro_f1"),
            "dataset_fingerprint": (r.metrics or {}).get("dataset_fingerprint"),
            "selected_model": (r.metrics or {}).get("selected_model"),
        }
        for r in rows
    ]


@router.get("/accuracy", response_model=AccuracyResponse)
def accuracy(db: Session = Depends(get_db)):
    total = db.query(func.count(Prediction.id)).filter(Prediction.predicted_fault_type != "BELIRSIZ").scalar() or 0
    misclassified = db.query(func.count(Misclassification.id)).scalar() or 0
    accuracy_percent = round(((total - misclassified) / total) * 100, 2) if total > 0 else 0.0

    return AccuracyResponse(total_predictions=total, misclassifications=misclassified, accuracy_percent=accuracy_percent)


@router.get("/accuracy/by-category", response_model=list[CategoryAccuracy])
def accuracy_by_category(db: Session = Depends(get_db)):
    results = []
    for fault_type in FAULT_CLASSES:
        total = db.query(func.count(Prediction.id)).filter(Prediction.predicted_fault_type == fault_type).scalar() or 0
        misclassified = (
            db.query(func.count(Misclassification.id)).filter(Misclassification.original_type == fault_type).scalar() or 0
        )
        accuracy_percent = round(((total - misclassified) / total) * 100, 2) if total > 0 else 0.0
        results.append(
            CategoryAccuracy(fault_type=fault_type, total=total, misclassified=misclassified, accuracy_percent=accuracy_percent)
        )
    return results
