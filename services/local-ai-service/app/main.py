"""Local AI Service — Gemini'ye ek, tamamen yerel/self-hosted ariza teshis servisi.

Bu servis varsayilan `docker compose up` akisinin PARCASI DEGILDIR (bkz.
docker-compose.yml `local-ai` profile'i) — model agirliklari (~6GB) ve
torch/transformers bagimliliklari nedeniyle opsiyoneldir. Etkinlestirmek icin:

    docker compose --profile local-ai up -d local-ai-service

Amac: musteri sikayetini/telemetriyi bulut API'sine (Gemini) hic gondermeden,
tamamen bu konteynerde calisan acik kaynakli bir modelle (Qwen2.5-1.5B-Instruct)
analiz edebilmek — veri gizliligi/offline calisma gerektiren senaryolar icin
ikinci bir secenek. Gemini'nin YERINE GECMEZ; ekip (NOC/teknisyen) tarafindan
"ikinci bir görüş / yerel model" olarak kullanilmasi hedeflenir.
"""

import logging
import os
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.engine import engine
from app.middleware import EnvelopeMiddleware
from app.security_headers import SecurityHeadersMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("local-ai-service")

app = FastAPI(
    title="Local AI Service",
    description="NetOpsCell - Yerel/self-hosted LLM ile ariza teshis (Qwen2.5-1.5B-Instruct)",
    version="0.1.0",
)

_allowed_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(CORSMiddleware, allow_origins=_allowed_origins, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(EnvelopeMiddleware)


@app.on_event("startup")
def _start_background_load():
    # Model yuklemesi (birkaç on saniye - iki dakika) health check'i bloklamasin diye
    # ayri bir thread'de baslatilir; servis hemen ayaga kalkar, ilk /diagnose istegi
    # yukleme bitene kadar 503 doner.
    threading.Thread(target=engine.load, daemon=True).start()


class DiagnoseRequest(BaseModel):
    text: str = Field(..., min_length=5, max_length=2000, description="Telemetri ozeti ve/veya saha/musteri bildirimi")


class DiagnoseResponse(BaseModel):
    ariza_turu: str | None = None
    oncelik: str | None = None
    kok_neden: str | None = None
    önerilen_aksiyonlar: list[str] | None = None
    gerekli_uzmanlik: str | None = None
    raw_response: str | None = None
    model: str
    adapter_loaded: bool


@app.get("/health")
def health():
    return {
        "success": True,
        "data": {
            "service": "local-ai-service",
            "status": "ok",
            "model_ready": engine.ready,
            "model_source": engine.model_source,
        },
        "error": None,
    }


@app.post("/api/v1/local-ai/diagnose", response_model=DiagnoseResponse)
def diagnose(payload: DiagnoseRequest):
    if not engine.ready:
        raise HTTPException(
            status_code=503,
            detail="Yerel model henuz yukleniyor, birazdan tekrar deneyin (ilk baslatmada birkaç dakika surebilir).",
        )
    result = engine.diagnose(payload.text)
    result["model"] = engine.model_source or "Qwen2.5-1.5B-Instruct"
    result["adapter_loaded"] = engine.adapter_loaded
    return DiagnoseResponse(**result)
