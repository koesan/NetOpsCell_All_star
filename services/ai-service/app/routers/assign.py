from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.clients import fetch_workload
from app.config import settings
from app.db import get_db
from app.ml.eta import get_eta_estimator
from app.models_db import TeamCache
from app.schemas import AssignCandidate, AssignedTeam, AssignRequest, AssignResponse
from app.scoring import score_team

router = APIRouter(prefix="/api/v1/ai", tags=["assign"])


@router.post("/assign", response_model=AssignResponse)
def assign(payload: AssignRequest, db: Session = Depends(get_db)):
    teams = db.query(TeamCache).all()
    workload = fetch_workload()

    scored: list[tuple[TeamCache, dict]] = []
    for team in teams:
        active_count = workload.get(team.team_id, 0)
        result = score_team(
            team_expertise=team.expertise or [],
            fault_type=payload.fault_type,
            team_lat=team.lat,
            team_lng=team.lng,
            incident_lat=payload.latitude,
            incident_lng=payload.longitude,
            active_incident_count=active_count,
        )
        scored.append((team, result))

    # Skor tablosu (supervizor panelindeki "neden bu ekip?" aciklanabilirligi icin)
    scored.sort(key=lambda item: item[1]["skor"], reverse=True)
    candidates = [
        AssignCandidate(
            team_id=team.team_id,
            name=team.name,
            score=result["skor"],
            uzmanlik_eslesme=result["uzmanlik_eslesme"],
            mesafe_yakinlik=result["mesafe_yakinlik"],
            bosluk_orani=result["bosluk_orani"],
            distance_km=result["distance_km"],
            has_capacity=result["has_capacity"],
        )
        for team, result in scored[:5]
    ]

    eligible = [(team, result) for team, result in scored if result["has_capacity"]]
    if not eligible:
        return AssignResponse(assigned_team=None, queued=True, candidates_evaluated=len(teams), candidates=candidates)

    best_team, best_score = eligible[0]

    # Ikinci model (ETA regresyonu): yol suresi + sahadaki is suresi tahmini.
    # Model yuklu degilse atama yine tamamlanir (graceful degradation).
    eta = None
    estimator = get_eta_estimator()
    if estimator is not None:
        try:
            eta = estimator.estimate(
                fault_type=payload.fault_type,
                priority=getattr(payload, "priority", None) or "ORTA",
                distance_km=best_score["distance_km"],
            )
        except Exception:  # noqa: BLE001 - ETA hicbir kosulda atamayi bloke etmez
            eta = None

    return AssignResponse(
        assigned_team=AssignedTeam(
            team_id=best_team.team_id,
            name=best_team.name,
            score=best_score["skor"],
            uzmanlik_eslesme=best_score["uzmanlik_eslesme"],
            mesafe_yakinlik=best_score["mesafe_yakinlik"],
            bosluk_orani=best_score["bosluk_orani"],
            distance_km=best_score["distance_km"],
            team_lat=best_team.lat,
            team_lng=best_team.lng,
            travel_minutes=eta["travel_minutes"] if eta else None,
            work_minutes=eta["work_minutes"] if eta else None,
            total_eta_minutes=eta["total_eta_minutes"] if eta else None,
            eta_model_version=settings.eta_model_version if eta else None,
        ),
        queued=False,
        candidates_evaluated=len(teams),
        candidates=candidates,
    )
