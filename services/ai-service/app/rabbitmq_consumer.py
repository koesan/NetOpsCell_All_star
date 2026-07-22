"""RabbitMQ tuketicisi: team.profile.updated ve incident.type.changed event'lerini dinler.

Faz 1'de bu guncellemeler senkron REST (Identity /internal/teams pull, Incident'in
notifyClassificationChanged cagrisi) ile yapiliyordu. Faz 2'de tamamen event-tabanli:
Identity/Incident gecici erisilemez olsa da, event'ler durable queue'da bekler ve bu
servis ayaga kalktiginda islenir (bkz. ARCHITECTURE.md Bolum 4.4, 7).
"""

import asyncio
import json
import logging
import uuid

import aio_pika

from app.config import settings
from app.db import SessionLocal
from app.models_db import Misclassification, TeamCache

logger = logging.getLogger("ai-service.rabbitmq")

EXCHANGE = "netopscell.events"
QUEUE_NAME = "ai-service.events"
ROUTING_KEYS = ["team.profile.updated", "incident.type.changed"]


async def _handle_team_profile_updated(payload: dict) -> None:
    db = SessionLocal()
    try:
        team_id = payload["team_id"]
        existing = db.get(TeamCache, team_id)
        if existing:
            existing.expertise = payload.get("expertise") or []
            existing.region = payload.get("region") or []
            existing.lat = payload.get("lat")
            existing.lng = payload.get("lng")
        else:
            db.add(
                TeamCache(
                    team_id=team_id,
                    expertise=payload.get("expertise") or [],
                    region=payload.get("region") or [],
                    lat=payload.get("lat"),
                    lng=payload.get("lng"),
                )
            )
        db.commit()
        logger.info("team_cache guncellendi (event): %s", team_id)
    finally:
        db.close()


async def _handle_incident_type_changed(payload: dict) -> None:
    db = SessionLocal()
    try:
        db.add(
            Misclassification(
                id=uuid.uuid4(),
                incident_id=payload["incident_id"],
                original_type=payload["original_type"],
                corrected_type=payload["corrected_type"],
                corrected_by=payload.get("corrected_by"),
            )
        )
        db.commit()
        logger.info("misclassification kaydedildi (event): %s", payload["incident_id"])
    finally:
        db.close()


HANDLERS = {
    "team.profile.updated": _handle_team_profile_updated,
    "incident.type.changed": _handle_incident_type_changed,
}


async def consume_forever() -> None:
    while True:
        try:
            connection = await aio_pika.connect_robust(
                process_rabbitmq_url(), timeout=10
            )
            async with connection:
                channel = await connection.channel()
                exchange = await channel.declare_exchange(EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True)
                queue = await channel.declare_queue(QUEUE_NAME, durable=True)
                for key in ROUTING_KEYS:
                    await queue.bind(exchange, routing_key=key)

                logger.info("RabbitMQ consumer basladi: %s <- %s", QUEUE_NAME, ROUTING_KEYS)

                async with queue.iterator() as queue_iter:
                    async for message in queue_iter:
                        async with message.process():
                            body = json.loads(message.body.decode())
                            event_type = body.get("event_type")
                            handler = HANDLERS.get(event_type)
                            if handler:
                                await handler(body.get("payload", {}))
                            else:
                                logger.warning("Bilinmeyen event_type: %s", event_type)
        except Exception as exc:  # noqa: BLE001 - baglanti kopsa da servis ayakta kalmali
            logger.warning("RabbitMQ baglantisi kesildi/kurulamadi, 5sn sonra tekrar denenecek: %s", exc)
            await asyncio.sleep(5)


def process_rabbitmq_url() -> str:
    return settings.rabbitmq_url
