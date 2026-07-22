"""Identity ve Incident Service'in dahili (internal) endpoint'lerine senkron REST cagrilari.

Bu cagrilar dogrudandir (event-driven cache'e ek olarak, orn. workload her istekte guncel
olmali). team.profile.updated event'i ile ana veri zaten yerel team_cache'e senkronize
edilir (bkz. rabbitmq_consumer.py); bu modul workload gibi anlik/degisken veriler icindir.
Faz 3: gecici (transient) hatalara karsi ustel geri cekilmeli (exponential backoff) yeniden
deneme eklendi - AI Service kullanici isteklerini bloke etmedigi icin (predict/assign gibi
canli bir HTTP yanitini beklemez), birkac kisa deneme burada kabul edilebilir bir maliyettir.
Identity/Incident tamamen erisilemezse (tum denemeler basarisiz) notr/varsayilan degerlerle
devam edilir - bagimsizlik ilkesi (bkz. ARCHITECTURE.md Bolum 4.4, 11).
"""

import logging
import random
import time
from typing import Callable, TypeVar

import httpx

from app.config import settings

logger = logging.getLogger("ai-service.clients")

REQUEST_TIMEOUT_SECONDS = 2.0
MAX_RETRIES = 3
BASE_BACKOFF_SECONDS = 0.2

T = TypeVar("T")


def _with_retry(operation_name: str, fn: Callable[[], T], default: T) -> T:
    last_exc: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fn()
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            last_exc = exc
            if attempt < MAX_RETRIES:
                # Ustel geri cekilme + jitter: ardisik denemelerin ayni anda cakismasini
                # (thundering herd) onler, hedef servise nefes alma payi tanir.
                delay = BASE_BACKOFF_SECONDS * (2 ** (attempt - 1)) + random.uniform(0, 0.1)
                logger.info("%s denemesi %d basarisiz, %.2fsn sonra tekrar denenecek: %s", operation_name, attempt, delay, exc)
                time.sleep(delay)
    logger.warning("%s tum denemeler (%d) basarisiz oldu, varsayilan deger kullanilacak: %s", operation_name, MAX_RETRIES, last_exc)
    return default


def fetch_teams() -> list[dict]:
    def _call():
        response = httpx.get(
            f"{settings.identity_service_internal_url}/internal/teams",
            headers={"x-internal-key": settings.internal_api_key},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json().get("data") or []

    return _with_retry("Identity /internal/teams", _call, [])


def fetch_workload() -> dict[str, int]:
    """team_id -> aktif vaka sayisi. Incident Service erisilemezse bos sozluk doner
    (scoring.py bunu 'kapasite bilgisi yok' olarak yorumlar, bosluk_orani=1.0 varsayar)."""

    def _call():
        response = httpx.get(
            f"{settings.incident_service_internal_url}/internal/teams/workload",
            headers={"x-internal-key": settings.internal_api_key},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json().get("data") or {}

    return _with_retry("Incident /internal/teams/workload", _call, {})
