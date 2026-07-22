from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.clients import fetch_workload
from app.db import get_db
from app.models_db import TeamCache
from app.schemas import AssignedTeam, AssignRequest, AssignResponse
from app.scoring import score_team

router = APIRouter(prefix="/api/v1/ai", tags=["assign"])


@router.post("/assign", response_model=AssignResponse)
def assign(payload: AssignRequest, db: Session = Depends(get_db)):
    teams = db.query(TeamCache).all()
    workload = fetch_workload()

    best_team = None
    best_score = None
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
        if not result["has_capacity"]:
            continue
        if best_score is None or result["skor"] > best_score["skor"]:
            best_score = result
            best_team = team

    if best_team is None:
        return AssignResponse(assigned_team=None, queued=True, candidates_evaluated=len(teams))

    return AssignResponse(
        assigned_team=AssignedTeam(
            team_id=best_team.team_id,
            name=best_team.name,
            score=best_score["skor"],
            uzmanlik_eslesme=best_score["uzmanlik_eslesme"],
            mesafe_yakinlik=best_score["mesafe_yakinlik"],
            bosluk_orani=best_score["bosluk_orani"],
            distance_km=best_score["distance_km"],
        ),
        queued=False,
        candidates_evaluated=len(teams),
    )
