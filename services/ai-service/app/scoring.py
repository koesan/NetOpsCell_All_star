"""Akilli saha ekibi atama skorlamasi (bkz. ARCHITECTURE.md Bolum 9.2, case 5.3).

skor = (uzmanlik_eslesme x agirlik) + (mesafe_yakinlik x agirlik) + (bosluk_orani x agirlik)
"""

import math

from app.config import settings


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def mesafe_yakinlik(distance_km: float, max_relevant_km: float = 50.0) -> float:
    """Mesafe arttikca 1'den 0'a dogru lineer azalan yakinlik skoru."""
    if distance_km <= 0:
        return 1.0
    return max(0.0, 1 - (distance_km / max_relevant_km))


def bosluk_orani(active_incident_count: int, max_capacity: int | None = None) -> float:
    capacity = max_capacity or settings.team_max_capacity
    return max(0.0, 1 - (active_incident_count / capacity))


def score_team(
    team_expertise: list[str],
    fault_type: str,
    team_lat: float | None,
    team_lng: float | None,
    incident_lat: float | None,
    incident_lng: float | None,
    active_incident_count: int,
) -> dict:
    uzmanlik_eslesme = 1.0 if fault_type in (team_expertise or []) else 0.0

    if team_lat is not None and team_lng is not None and incident_lat is not None and incident_lng is not None:
        distance_km = haversine_km(team_lat, team_lng, incident_lat, incident_lng)
        mesafe_skor = mesafe_yakinlik(distance_km)
    else:
        distance_km = None
        mesafe_skor = 0.5  # konum bilgisi eksikse notr skor

    bosluk_skor = bosluk_orani(active_incident_count)

    skor = (
        uzmanlik_eslesme * settings.score_weight_uzmanlik
        + mesafe_skor * settings.score_weight_mesafe
        + bosluk_skor * settings.score_weight_bosluk
    )

    return {
        "skor": round(skor, 4),
        "uzmanlik_eslesme": uzmanlik_eslesme,
        "mesafe_yakinlik": round(mesafe_skor, 4),
        "bosluk_orani": round(bosluk_skor, 4),
        "distance_km": round(distance_km, 2) if distance_km is not None else None,
        "has_capacity": bosluk_skor > 0,
    }
