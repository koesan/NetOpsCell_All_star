"""Model egitim ve karsilastirma pipeline'i.

Bkz. docs/ARCHITECTURE.md - Bolum 9.2, 9.3 (Model Secimi, Egitim/Dogrulama). Uc aday model
(LogisticRegression, RandomForest, GradientBoosting) 5-fold stratified CV ile macro-F1'e gore
karsilastirilir; en iyisi secilip preprocessing pipeline'i ile birlikte serilestirilir.

Calistirma (ai-service kok dizininden): python -m scripts.train_model
"""

import hashlib
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.ml.features import ALL_FEATURES, CATEGORICAL_FEATURES, CLASSES, NUMERIC_FEATURES

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_telemetry.csv")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_VERSION = os.environ.get("MODEL_VERSION", "v1")
RANDOM_SEED = 42
MIN_SAMPLES_PER_CLASS = 20
# Faz 3 - Model dogrulama kalite kapisi: bu esigin altinda macro-F1 ureten bir model
# ASLA devreye alinmaz (mevcut model_v*.joblib dosyasinin ustune yazilmaz). Bu, "kotu"
# bir yeniden egitimin sessizce prodüksiyona sizmasini engelleyen basit bir surdurulebilirlik
# onlemidir (bkz. docs/ARCHITECTURE.md Bolum 9.3 - Model Dogrulama).
MIN_ACCEPTABLE_MACRO_F1 = float(os.environ.get("MIN_ACCEPTABLE_MACRO_F1", "0.85"))


def validate_dataset(df: pd.DataFrame) -> None:
    """Egitim oncesi veri kalitesi kontrolleri. Herhangi biri basarisiz olursa egitim durur."""
    missing = df[ALL_FEATURES + ["fault_type"]].isnull().sum()
    if missing.any():
        raise ValueError(f"Veri setinde eksik (NaN) deger bulundu:\n{missing[missing > 0]}")

    class_counts = df["fault_type"].value_counts()
    under_represented = class_counts[class_counts < MIN_SAMPLES_PER_CLASS]
    if not under_represented.empty:
        raise ValueError(
            f"Su siniflarda minimum {MIN_SAMPLES_PER_CLASS} ornek yok (dengesiz veri riski):\n{under_represented}"
        )

    missing_classes = set(CLASSES) - set(class_counts.index)
    if missing_classes:
        raise ValueError(f"Veri setinde hic ornegi olmayan siniflar var: {missing_classes}")

    print(f"Veri kalitesi kontrolu gecti: {len(df)} ornek, sinif dagilimi:\n{class_counts.to_dict()}")


def dataset_fingerprint(path: str) -> str:
    """Veri setinin SHA-256 hash'i - model_registry'de hangi verinin hangi modeli
    urettigini izlenebilir kilar (veri versiyonlama, bkz. Bolum 9.3)."""
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("numeric", StandardScaler(), NUMERIC_FEATURES),
            ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ]
    )


def candidate_models() -> dict:
    return {
        "LogisticRegression": LogisticRegression(max_iter=1000, random_state=RANDOM_SEED),
        "RandomForestClassifier": RandomForestClassifier(n_estimators=200, max_depth=8, random_state=RANDOM_SEED),
        "GradientBoostingClassifier": GradientBoostingClassifier(
            n_estimators=200, max_depth=3, learning_rate=0.05, random_state=RANDOM_SEED
        ),
    }


def main() -> None:
    df = pd.read_csv(DATA_PATH)
    # historical_fault_count uzerinden turetilen fault_recency_score egitim setinde de tutarli olmali
    from app.ml.features import fault_recency_score

    df["fault_recency_score"] = df["historical_fault_count"].apply(fault_recency_score)

    validate_dataset(df)
    data_hash = dataset_fingerprint(DATA_PATH)

    X = df[ALL_FEATURES]
    y = df["fault_type"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_SEED
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
    preprocessor = build_preprocessor()

    cv_results = {}
    for name, estimator in candidate_models().items():
        pipeline = Pipeline([("preprocess", preprocessor), ("clf", estimator)])
        scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring="f1_macro")
        cv_results[name] = {"mean_macro_f1": float(scores.mean()), "std": float(scores.std())}
        print(f"{name}: macro-F1 = {scores.mean():.4f} (+/- {scores.std():.4f})")

    best_name = max(cv_results, key=lambda k: cv_results[k]["mean_macro_f1"])
    print(f"\nSecilen model: {best_name}")

    best_pipeline = Pipeline([("preprocess", build_preprocessor()), ("clf", candidate_models()[best_name])])
    best_pipeline.fit(X_train, y_train)

    y_pred = best_pipeline.predict(X_test)
    test_macro_f1 = f1_score(y_test, y_pred, average="macro")
    report = classification_report(y_test, y_pred, labels=CLASSES, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_test, y_pred, labels=CLASSES)

    print(f"\nTest seti macro-F1: {test_macro_f1:.4f}")
    print(classification_report(y_test, y_pred, labels=CLASSES, zero_division=0))
    print("Confusion matrix (siralama:", CLASSES, "):")
    print(cm)

    feature_importance = None
    clf = best_pipeline.named_steps["clf"]
    if hasattr(clf, "feature_importances_"):
        feature_names = NUMERIC_FEATURES + list(
            best_pipeline.named_steps["preprocess"].named_transformers_["categorical"].get_feature_names_out(CATEGORICAL_FEATURES)
        )
        importances = clf.feature_importances_
        feature_importance = sorted(
            zip(feature_names, [float(i) for i in importances]), key=lambda x: x[1], reverse=True
        )
        print("\nOzellik onem sirasi:")
        for feat, score in feature_importance:
            print(f"  {feat}: {score:.4f}")

    # Kalite kapisi: esigin altinda kalan bir model ASLA devreye alinmaz - mevcut
    # (uretimdeki) model dosyasi korunur, script hata koduyla sonlanir. Bu, CI/CD
    # pipeline'inda otomatik yeniden egitim yapilsa dahi bir regresyonun prodüksiyona
    # sizmasini engeller (bkz. ARCHITECTURE.md Bolum 9.3).
    if test_macro_f1 < MIN_ACCEPTABLE_MACRO_F1:
        print(
            f"\nHATA: test macro-F1 ({test_macro_f1:.4f}) minimum kabul edilebilir esigin "
            f"({MIN_ACCEPTABLE_MACRO_F1:.4f}) altinda. Model KAYDEDILMEDI, mevcut model korunuyor."
        )
        sys.exit(1)

    os.makedirs(MODELS_DIR, exist_ok=True)
    model_path = os.path.join(MODELS_DIR, f"model_{MODEL_VERSION}.joblib")
    joblib.dump(best_pipeline, model_path)

    metrics = {
        "model_version": MODEL_VERSION,
        "selected_model": best_name,
        "cross_validation": cv_results,
        "test_macro_f1": float(test_macro_f1),
        "min_acceptable_macro_f1": MIN_ACCEPTABLE_MACRO_F1,
        "dataset_fingerprint": data_hash,
        "classification_report": report,
        "confusion_matrix": {"labels": CLASSES, "matrix": cm.tolist()},
        "feature_importance": feature_importance,
        "training_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
    }
    metrics_path = os.path.join(MODELS_DIR, f"model_{MODEL_VERSION}_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)

    print(f"\nModel kaydedildi: {model_path}")
    print(f"Metrikler kaydedildi: {metrics_path}")


if __name__ == "__main__":
    main()
