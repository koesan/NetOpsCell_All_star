"""ETA (cozum suresi) modeli birim testleri — model dosyasi repoya gomulu oldugu icin
gercek pipeline ile calisir; travel_minutes deterministik yardimcisi ayrica test edilir."""

import os

import pytest

from app.ml.eta import (
    DEPARTURE_PREP_MINUTES,
    EtaEstimator,
    build_eta_feature_row,
    travel_minutes,
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "eta_model_v1.joblib")


def test_travel_minutes_none_when_distance_unknown():
    assert travel_minutes(None) is None


def test_travel_minutes_monotonic_in_distance():
    assert travel_minutes(2.0) < travel_minutes(10.0) < travel_minutes(30.0)


def test_travel_minutes_includes_prep_time():
    assert travel_minutes(0.0) == DEPARTURE_PREP_MINUTES


def test_feature_row_defaults_distance_when_missing():
    row = build_eta_feature_row("DONANIM", "KRITIK", None)
    assert row["distance_km"] == 8.0
    assert row["fault_type"] == "DONANIM"
    assert 0 <= row["hour_of_day"] <= 23


@pytest.fixture(scope="module")
def estimator():
    if not os.path.exists(MODEL_PATH):
        pytest.skip("eta_model_v1.joblib bulunamadi")
    return EtaEstimator(MODEL_PATH)

def test_estimate_returns_sane_ranges(estimator):
    result = estimator.estimate("DONANIM", "YUKSEK", distance_km=12.0)
    assert 20.0 <= result["work_minutes"] <= 480.0
    assert result["travel_minutes"] > 0
    assert result["total_eta_minutes"] == pytest.approx(
        result["work_minutes"] + result["travel_minutes"], abs=0.2
    )


def test_hardware_takes_longer_than_software(estimator):
    donanim = estimator.estimate("DONANIM", "ORTA", distance_km=5.0)
    yazilim = estimator.estimate("YAZILIM", "ORTA", distance_km=5.0)
    assert donanim["work_minutes"] > yazilim["work_minutes"]
