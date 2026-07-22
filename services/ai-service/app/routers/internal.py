import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.sync import sync_team_cache

router = APIRouter(prefix="/internal", tags=["internal"])


def verify_internal_key(x_internal_key: str = Header(default="")) -> None:
    # hmac.compare_digest: timing attack'e karsi sabit-zamanli karsilastirma
    if not settings.internal_api_key or not hmac.compare_digest(x_internal_key, settings.internal_api_key):
        raise HTTPException(status_code=401, detail="Dahili erisim anahtari gecersiz.")


# Manuel yeniden senkronizasyon (kolaylik icin birakildi; asil yol artik
# team.profile.updated event'inin RabbitMQ uzerinden dinlenmesidir - bkz. rabbitmq_consumer.py)
@router.post("/refresh-teams", dependencies=[Depends(verify_internal_key)])
def refresh_teams(db: Session = Depends(get_db)):
    count = sync_team_cache(db)
    return {"synced_teams": count}
