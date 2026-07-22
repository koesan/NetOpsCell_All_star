import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import SessionLocal, init_db
from app.middleware import EnvelopeMiddleware
from app.model_registry import sync_model_registry
from app.rabbitmq_consumer import consume_forever
from app.routers import accuracy, assign, eta, internal, predict, teams
from app.security_headers import SecurityHeadersMiddleware
from app.sync import sync_team_cache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        sync_team_cache(db)
    except Exception as exc:  # noqa: BLE001 - baslangicta Identity erisilemezse servis yine de acilmali
        logger.warning("Baslangic team_cache senkronu basarisiz (bagimsizlik ilkesi geregi devam ediliyor): %s", exc)
    try:
        sync_model_registry(db)
    except Exception as exc:  # noqa: BLE001 - registry senkronu basarisiz olsa da servis acilmali
        logger.warning("model_registry senkronu basarisiz: %s", exc)
    finally:
        db.close()

    consumer_task = asyncio.create_task(consume_forever())
    yield
    consumer_task.cancel()


app = FastAPI(
    title="AI Service",
    description="NetOpsCell - Ariza tahmini, tur siniflandirma, akilli saha ekibi atamasi",
    version="0.1.0",
    lifespan=lifespan,
)

# Faz 3: CORS artik acik (*) degil - sadece bilinen frontend/gateway origin'lerine izin verilir.
_allowed_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(CORSMiddleware, allow_origins=_allowed_origins, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(EnvelopeMiddleware)

app.include_router(predict.router)
app.include_router(assign.router)
app.include_router(eta.router)
app.include_router(teams.router)
app.include_router(accuracy.router)
app.include_router(internal.router)


@app.get("/health")
def health():
    return {
        "success": True,
        "data": {
            "service": "ai-service",
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        "error": None,
    }
