import math

from app.scoring import bosluk_orani, haversine_km, mesafe_yakinlik, score_team


def test_haversine_zero_distance_for_identical_points():
    assert haversine_km(41.0, 29.0, 41.0, 29.0) == 0.0


def test_haversine_known_distance_istanbul_ankara():
    # Istanbul (41.0082, 28.9784) - Ankara (39.9334, 32.8597) yaklasik 350-400km
    distance = haversine_km(41.0082, 28.9784, 39.9334, 32.8597)
    assert 300 < distance < 450


def test_mesafe_yakinlik_perfect_score_at_zero_distance():
    assert mesafe_yakinlik(0) == 1.0


def test_mesafe_yakinlik_decreases_linearly():
    assert mesafe_yakinlik(25, max_relevant_km=50) == 0.5
    assert mesafe_yakinlik(50, max_relevant_km=50) == 0.0


def test_mesafe_yakinlik_never_negative_beyond_max_range():
    assert mesafe_yakinlik(500, max_relevant_km=50) == 0.0


def test_bosluk_orani_full_capacity_available():
    assert bosluk_orani(0, max_capacity=5) == 1.0


def test_bosluk_orani_at_capacity_is_zero():
    assert bosluk_orani(5, max_capacity=5) == 0.0


def test_bosluk_orani_never_negative_when_over_capacity():
    assert bosluk_orani(10, max_capacity=5) == 0.0


def test_score_team_matching_expertise_close_distance_free_capacity_scores_high():
    result = score_team(
        team_expertise=["DONANIM"],
        fault_type="DONANIM",
        team_lat=41.0,
        team_lng=29.0,
        incident_lat=41.0,
        incident_lng=29.0,
        active_incident_count=0,
    )
    assert result["uzmanlik_eslesme"] == 1.0
    assert result["mesafe_yakinlik"] == 1.0
    assert result["has_capacity"] is True
    assert math.isclose(result["skor"], 1.0, rel_tol=1e-6)


def test_score_team_no_expertise_match_scores_lower():
    matching = score_team(["DONANIM"], "DONANIM", 41.0, 29.0, 41.0, 29.0, 0)
    non_matching = score_team(["YAZILIM"], "DONANIM", 41.0, 29.0, 41.0, 29.0, 0)
    assert non_matching["skor"] < matching["skor"]


def test_score_team_missing_location_uses_neutral_distance_score():
    result = score_team(["DONANIM"], "DONANIM", None, None, 41.0, 29.0, 0)
    assert result["distance_km"] is None
    assert result["mesafe_yakinlik"] == 0.5


def test_score_team_at_full_capacity_has_no_capacity_flag():
    result = score_team(["DONANIM"], "DONANIM", 41.0, 29.0, 41.0, 29.0, active_incident_count=5)
    assert result["has_capacity"] is False
