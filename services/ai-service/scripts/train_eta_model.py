"""Cozum suresi (ETA) regresyon modeli egitim pipeline'i.

Siniflandirma pipeline'inin (train_model.py) regresyon karsiligi: uc aday model
(Ridge, RandomForestRegressor, GradientBoostingRegressor) 5-fold CV ile MAE'ye
gore karsilastirilir; en iyisi test setinde dogrulanir ve kalite kapisindan
(MAX_ACCEPTABLE_MAE) gecerse serilestirilir. Veri setindeki "yedek parca" gizli
degiskeni nedeniyle irreducible error bilincli olarak yuksektir — model ortalama
davranisi ogrenir, uc degerler SLA guvenlik payi ile karsilanir.

Calistirma (ai-service kok dizininden): python -m scripts.train_eta_model
"""

import hashlib
import json
import os
import sys

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.ml.eta import ETA_ALL_FEATURES, ETA_CATEGORICAL_FEATURES, ETA_NUMERIC_FEATURES

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_resolution.csv")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_VERSION = os.environ.get("ETA_MODEL_VERSION", "v1")
RANDOM_SEED = 42
# Kalite kapisi: test MAE bu esigin ustundeyse model kaydedilmez (mevcut korunur).
MAX_ACCEPTABLE_MAE = float(os.environ.get("MAX_ACCEPTABLE_ETA_MAE", "40"))
TARGET = "resolution_minutes"


def dataset_fingerprint(path: str) -> str:
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("numeric", StandardScaler(), ETA_NUMERIC_FEATURES),
            ("categorical", OneHotEncoder(handle_unknown="ignore"), ETA_CATEGORICAL_FEATURES),
        ]
    )


def candidate_models() -> dict:
    return {
        "Ridge": Ridge(alpha=1.0, random_state=RANDOM_SEED),
        "RandomForestRegressor": RandomForestRegressor(
            n_estimators=300, max_depth=10, min_samples_leaf=4, random_state=RANDOM_SEED
        ),
        "GradientBoostingRegressor": GradientBoostingRegressor(
            n_estimators=300, max_depth=3, learning_rate=0.05, random_state=RANDOM_SEED
        ),
    }


def main() -> None:
    df = pd.read_csv(DATA_PATH)
    if df[ETA_ALL_FEATURES + [TARGET]].isnull().any().any():
        raise ValueError("ETA veri setinde eksik deger var; egitim durduruldu.")
    data_hash = dataset_fingerprint(DATA_PATH)

    X = df[ETA_ALL_FEATURES]
    y = df[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_SEED)

    cv = KFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
    cv_results = {}
    for name, estimator in candidate_models().items():
        pipeline = Pipeline([("preprocess", build_preprocessor()), ("reg", estimator)])
        scores = -cross_val_score(pipeline, X_train, y_train, cv=cv, scoring="neg_mean_absolute_error")
        cv_results[name] = {"mean_mae_minutes": float(scores.mean()), "std": float(scores.std())}
        print(f"{name}: CV MAE = {scores.mean():.2f} dk (+/- {scores.std():.2f})")

    best_name = min(cv_results, key=lambda k: cv_results[k]["mean_mae_minutes"])
    print(f"\nSecilen model: {best_name}")

    best_pipeline = Pipeline([("preprocess", build_preprocessor()), ("reg", candidate_models()[best_name])])
    best_pipeline.fit(X_train, y_train)

    y_pred = best_pipeline.predict(X_test)
    test_mae = float(mean_absolute_error(y_test, y_pred))
    test_rmse = float(root_mean_squared_error(y_test, y_pred))
    test_r2 = float(r2_score(y_test, y_pred))
    print(f"\nTest MAE: {test_mae:.2f} dk · RMSE: {test_rmse:.2f} dk · R2: {test_r2:.3f}")

    feature_importance = None
    reg = best_pipeline.named_steps["reg"]
    if hasattr(reg, "feature_importances_"):
        feature_names = ETA_NUMERIC_FEATURES + list(
            best_pipeline.named_steps["preprocess"]
            .named_transformers_["categorical"]
            .get_feature_names_out(ETA_CATEGORICAL_FEATURES)
        )
        feature_importance = sorted(
            zip(feature_names, [float(i) for i in reg.feature_importances_]),
            key=lambda x: x[1],
            reverse=True,
        )
        print("\nOzellik onem sirasi:")
        for feat, score in feature_importance:
            print(f"  {feat}: {score:.4f}")

    if test_mae > MAX_ACCEPTABLE_MAE:
        print(
            f"\nHATA: test MAE ({test_mae:.2f} dk) kabul edilebilir esigin ({MAX_ACCEPTABLE_MAE:.0f} dk) "
            "ustunde. Model KAYDEDILMEDI, mevcut model korunuyor."
        )
        sys.exit(1)

    os.makedirs(MODELS_DIR, exist_ok=True)
    model_path = os.path.join(MODELS_DIR, f"eta_model_{MODEL_VERSION}.joblib")
    joblib.dump(best_pipeline, model_path)

    metrics = {
        "model_version": MODEL_VERSION,
        "task": "resolution_time_regression",
        "selected_model": best_name,
        "cross_validation": cv_results,
        "test_mae_minutes": test_mae,
        "test_rmse_minutes": test_rmse,
        "test_r2": test_r2,
        "max_acceptable_mae": MAX_ACCEPTABLE_MAE,
        "dataset_fingerprint": data_hash,
        "feature_importance": feature_importance,
        "training_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
    }
    metrics_path = os.path.join(MODELS_DIR, f"eta_model_{MODEL_VERSION}_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)

    print(f"\nModel kaydedildi: {model_path}")
    print(f"Metrikler kaydedildi: {metrics_path}")


if __name__ == "__main__":
    main()
