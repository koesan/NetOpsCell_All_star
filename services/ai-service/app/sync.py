"""Identity Service'ten takim rosterinin AI Service'in kendi team_cache tablosuna cekilmesi.

Faz 1: uygulama baslangicinda tek seferlik REST pull. Faz 2'de bu, team.profile.updated
event'inin surekli dinlenmesiyle degistirilecek (bkz. ARCHITECTURE.md Bolum 4.4) - boylece
Identity Service sonradan erisilemez olsa da bu tablodaki son bilinen veriyle atama
yapilmaya devam edilebilir.
"""

import logging

from sqlalchemy.orm import Session

from app.clients import fetch_teams
from app.models_db import TeamCache

logger = logging.getLogger("ai-service.sync")


def sync_team_cache(db: Session) -> int:
    teams = fetch_teams()
    if not teams:
        logger.warning("Identity Service'ten takim verisi alinamadi; team_cache guncellenmedi.")
        return 0

    for team in teams:
        existing = db.get(TeamCache, team["team_id"])
        if existing:
            existing.name = team.get("name")
            existing.expertise = team.get("expertise") or []
            existing.region = team.get("region") or []
            existing.lat = team.get("lat")
            existing.lng = team.get("lng")
        else:
            db.add(
                TeamCache(
                    team_id=team["team_id"],
                    name=team.get("name"),
                    expertise=team.get("expertise") or [],
                    region=team.get("region") or [],
                    lat=team.get("lat"),
                    lng=team.get("lng"),
                )
            )
    db.commit()
    logger.info("team_cache guncellendi: %d ekip", len(teams))
    return len(teams)
