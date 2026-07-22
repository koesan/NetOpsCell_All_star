"""Eskalasyon riski (ariza siddeti) modeli — GERCEK Kaggle verisiyle egitim.

Veri seti: Telstra Network Disruptions (Kaggle yarismasi, Avustralya'nin en buyuk
telekom operatorunun gercek sebeke log verisi):
https://www.kaggle.com/c/telstra-recruiting-network
Yerel kopya: data/telstra/ (train.csv + event_type/log_feature/resource_type/severity_type)

Hedef degisken `fault_severity`: 0 = ariza yok/onemsiz, 1 = lokal ariza,
2 = kritik (toplam hizmet kaybi). NetOpsCell'de bu model, yeni bir vakanin
"eskalasyon riski"ni (DUSUK/ORTA/YUKSEK) tahmin etmek icin kullanilir — istasyonun
olay gecmisi yogunlugu ve cesitliligi girdi alinir (bkz. app/ml/severity.py ve
ML_APPROACH.md Bolum 11'deki alan uyarlamasi/domain adaptation notu).

Ozellik muhendisligi (yarismanin klasik yaklasimindan uyarlanmistir):
her `id` icin olay/log/kaynak tablolarindan toplam sayilar, cesitlilik (distinct)
ve hacim toplamlari cikarilir. Konum-encoding gibi runtime'da karsiligi olmayan
sizinti-egilimli (leaky) ozellikler BILINCLI olarak kullanilmaz — model uretimde
istasyon gecmisinden turetilebilen ozelliklerle sinirli tutulur.

Calistirma (ai-service kok dizininden): python -m scripts.train_severity_model
"""

import csv
import hashlib
import json
import os
import sys
from collections import defaultdict

import joblib
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, f1_score, log_loss
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.ml.severity import SEVERITY_FEATURES

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "telstra")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_VERSION = os.environ.get("SEVERITY_MODEL_VERSION", "v1")
RANDOM_SEED = 42
# Kalite kapisi: gercek/dengesiz veri oldugu icin esik sentetik modellerden dusuktur.
MIN_ACCEPTABLE_MACRO_F1 = float(os.environ.get("MIN_ACCEPTABLE_SEVERITY_MACRO_F1", "0.45"))


def _read_grouped(filename: str, key: str = "id"):
    grouped = defaultdict(list)
    with open(os.path.join(DATA_DIR, filename), newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            grouped[row[key]].append(row)
    return grouped


def build_features() -> pd.DataFrame:
    events = _read_grouped("event_type.csv")
    logs = _read_grouped("log_feature.csv")
    resources = _read_grouped("resource_type.csv")
    severities = _read_grouped("severity_type.csv")

    rows = []
    with open(os.path.join(DATA_DIR, "train.csv"), newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            iid = row["id"]
            ev = events.get(iid, [])
            lg = logs.get(iid, [])
            rs = resources.get(iid, [])
            sv = severities.get(iid, [])
            rows.append(
                {
                    "event_count": len(ev),
                    "distinct_event_types": len({e["event_type"] for e in ev}),
                    "log_count": len(lg),
                    "distinct_log_features": len({l["log_feature"] for l in lg}),
                    "log_volume_sum": sum(int(l["volume"]) for l in lg),
                    "resource_count": len(rs),
                    "severity_type_ord": int(sv[0]["severity_type"].split()[-1]) if sv else 0,
                    "fault_severity": int(row["fault_severity"]),
                }
            )
    return pd.DataFrame(rows)


def dataset_fingerprint() -> str:
    h = hashlib.sha256()
    for name in sorted(os.listdir(DATA_DIR)):
        with open(os.path.join(DATA_DIR, name), "rb") as f:
            h.update(f.read())
    return h.hexdigest()[:16]


def candidate_models() -> dict:
    return {
        "LogisticRegression": LogisticRegression(max_iter=2000, class_weight="balanced", random_state=RANDOM_SEED),
        "RandomForestClassifier": RandomForestClassifier(
            n_estimators=300, max_depth=10, min_samples_leaf=5, class_weight="balanced", random_state=RANDOM_SEED
        ),
        "GradientBoostingClassifier": GradientBoostingClassifier(
            n_estimators=300, max_depth=3, learning_rate=0.05, random_state=RANDOM_SEED
        ),
    }


def main() -> None:
    df = build_features()
    print(f"Telstra ozellik matrisi: {len(df)} ornek, sinif dagilimi: {df['fault_severity'].value_counts().to_dict()}")

    X = df[SEVERITY_FEATURES]
    y = df["fault_severity"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=RANDOM_SEED)

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
    cv_results = {}
    for name, estimator in candidate_models().items():
        pipeline = Pipeline([("scale", StandardScaler()), ("clf", estimator)])
        scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring="f1_macro")
        cv_results[name] = {"mean_macro_f1": float(scores.mean()), "std": float(scores.std())}
        print(f"{name}: CV macro-F1 = {scores.mean():.4f} (+/- {scores.std():.4f})")

    best_name = max(cv_results, key=lambda k: cv_results[k]["mean_macro_f1"])
    print(f"\nSecilen model: {best_name}")

    best_pipeline = Pipeline([("scale", StandardScaler()), ("clf", candidate_models()[best_name])])
    best_pipeline.fit(X_train, y_train)

    y_pred = best_pipeline.predict(X_test)
    y_proba = best_pipeline.predict_proba(X_test)
    test_macro_f1 = float(f1_score(y_test, y_pred, average="macro"))
    test_logloss = float(log_loss(y_test, y_proba))
    test_accuracy = float((y_pred == y_test).mean())
    print(f"\nTest macro-F1: {test_macro_f1:.4f} · accuracy: {test_accuracy:.4f} · logloss: {test_logloss:.4f}")
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    print(classification_report(y_test, y_pred, zero_division=0))

    if test_macro_f1 < MIN_ACCEPTABLE_MACRO_F1:
        print(f"HATA: macro-F1 ({test_macro_f1:.4f}) esigin ({MIN_ACCEPTABLE_MACRO_F1}) altinda; model kaydedilmedi.")
        sys.exit(1)

    os.makedirs(MODELS_DIR, exist_ok=True)
    model_path = os.path.join(MODELS_DIR, f"severity_model_{MODEL_VERSION}.joblib")
    joblib.dump(best_pipeline, model_path)

    feature_importance = None
    clf = best_pipeline.named_steps["clf"]
    if hasattr(clf, "feature_importances_"):
        feature_importance = sorted(
            zip(SEVERITY_FEATURES, [float(i) for i in clf.feature_importances_]), key=lambda x: x[1], reverse=True
        )

    metrics = {
        "model_version": MODEL_VERSION,
        "task": "escalation_risk_classification",
        "dataset": "Telstra Network Disruptions (Kaggle) — https://www.kaggle.com/c/telstra-recruiting-network",
        "selected_model": best_name,
        "cross_validation": cv_results,
        "test_macro_f1": test_macro_f1,
        "test_accuracy": test_accuracy,
        "test_logloss": test_logloss,
        "classification_report": report,
        "feature_importance": feature_importance,
        "dataset_fingerprint": dataset_fingerprint(),
        "training_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
    }
    with open(os.path.join(MODELS_DIR, f"severity_model_{MODEL_VERSION}_metrics.json"), "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    print(f"\nModel kaydedildi: {model_path}")


if __name__ == "__main__":
    main()
