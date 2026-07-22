"""Saha ekibi rosteri + anlik is yuku — operasyon haritasi ve manuel atama ekranlari icin.

Veri kaynagi AI Service'in kendi team_cache tablosudur (database-per-service ilkesi);
Identity Service'e senkron bagimlilik yoktur. Is yuku Incident Service'ten cekilir,
erisilemezse 0 varsayilir (bagimsizlik ilkesi).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.clients import fetch_workload
from app.config import settings
from app.db import get_db
from app.models_db import TeamCache
from app.schemas import TeamInfo

router = APIRouter(prefix="/api/v1/ai", tags=["teams"])


@router.get("/teams", response_model=list[TeamInfo])
def list_teams(db: Session = Depends(get_db)):
    teams = db.query(TeamCache).all()
    workload = fetch_workload()
    result = []
    for team in teams:
        active = workload.get(team.team_id, 0)
        result.append(
            TeamInfo(
                team_id=team.team_id,
                name=team.name,
                expertise=team.expertise or [],
                region=team.region or [],
                lat=team.lat,
                lng=team.lng,
                active_incidents=active,
                max_capacity=settings.team_max_capacity,
                available=active < settings.team_max_capacity,
            )
        )
    return result
