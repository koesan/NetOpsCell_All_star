"""Egitim ve inference arasinda paylasilan ozellik semasi (bkz. ARCHITECTURE.md Bolum 9.1).

Ozellik tutarliligi kritik: train_model.py bu sabitlerle bir sklearn Pipeline kurar,
predictor.py ayni sabitlerle inference sirasinda ayni sirada/isimde bir DataFrame olusturur.
"""

import math

NUMERIC_FEATURES = [
    "signal_strength",
    "packet_loss",
    "temperature",
    "historical_fault_count",
    "temperature_trend",
    "signal_delta",
    "packet_loss_ma",
    "fault_recency_score",
]

CATEGORICAL_FEATURES = ["power_status"]

ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

CLASSES = ["NORMAL", "DONANIM", "GUC_KESINTISI", "BAGLANTI", "YAZILIM", "ISINMA"]
FAULT_CLASSES = [c for c in CLASSES if c != "NORMAL"]

POWER_STATUS_VALUES = ["NORMAL", "UNSTABLE", "OUTAGE"]


def fault_recency_score(historical_fault_count: int) -> float:
    """Son 30 gunde tekrar eden ariza sayisini 0-1 araligina sikistiran ustel skor.

    historical_fault_count=0 -> 0.0, buyudukce 1.0'a yaklasir (asimptotik).
    """
    k = 0.35
    return round(1 - math.exp(-k * max(historical_fault_count, 0)), 4)


def build_feature_row(
    signal_strength: float,
    packet_loss: float,
    temperature: float,
    power_status: str,
    historical_fault_count: int,
    temperature_trend: float,
    signal_delta: float,
    packet_loss_ma: float,
) -> dict:
    return {
        "signal_strength": signal_strength,
        "packet_loss": packet_loss,
        "temperature": temperature,
        "power_status": power_status,
        "historical_fault_count": historical_fault_count,
        "temperature_trend": temperature_trend,
        "signal_delta": signal_delta,
        "packet_loss_ma": packet_loss_ma,
        "fault_recency_score": fault_recency_score(historical_fault_count),
    }
