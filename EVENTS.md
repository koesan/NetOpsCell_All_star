# NetOpsCell — Event Kataloğu

> Bu dosya, servisler arası olay (event) sözleşmesinin tek referans kaynağıdır. Mimari gerekçe
> için bkz. [`docs/ARCHITECTURE.md` Bölüm 7](./docs/ARCHITECTURE.md#7-servisler-arasi-iletisim-ve-event-mimarisi).

> **Durum (Faz 2 tamamlandı):** Tüm event'ler `netopscell.events` topic exchange (durable, DLQ'lu)
> üzerinden **gerçekten** yayınlanıyor ve tüketiliyor — artık stub log değil. Durable queue sayesinde
> alıcı servis kapalıyken yayınlanan event kaybolmaz; servis geri geldiğinde otomatik işlenir (canlı
> olarak test edildi: Gamification Service durdurulup bir vaka çözülmüş, servis tekrar başlatılınca
> RabbitMQ kuyruğundaki event otomatik işlenmiştir). Gamification Service'te `POST
> /internal/simulate-event` hâlâ manuel test amaçlı kullanılabilir ama artık birincil yol değil.

> **Faz 4 (bonus):** Gateway, `netopscell.events` exchange'ine ek olarak kendi geçici (exclusive,
> auto-delete) kuyruğuyla bağlanıp `incident.assigned` ve `badge.earned` olaylarını dinler ve
> Socket.IO üzerinden ilgili kullanıcıya (`user:<id>` odası) gerçek zamanlı iletir. Bu tüketici
> **iş-kritik değildir** — durable kuyruklardaki asıl iş mantığını (Gamification puanlama,
> AI cache güncelleme vb.) etkilemez; Gateway yeniden başlarsa kaçırılan bir bildirim yalnızca
> o anki toast'ın gösterilmemesi anlamına gelir, veri kaybı olmaz.

| Event | Yayıncı | Dinleyici(ler) | Durum |
|---|---|---|---|
| `incident.created` | Incident Service | — (audit) | ✅ RabbitMQ'ya yayınlanıyor |
| `incident.status.changed` | Incident Service | — | ✅ RabbitMQ'ya yayınlanıyor |
| `incident.assigned` | Incident Service | Gateway (WebSocket relay → atanan teknisyen) | ✅ RabbitMQ'ya yayınlanıyor; **Faz 4:** Gateway'in Socket.IO relay'i (`gateway/src/websocket.js`) ile `user:<team_id>` odasına `incident:assigned` olarak iletiliyor, frontend toast + anlık liste yenileme yapıyor |
| `incident.type.changed` | Incident Service | AI Service (`misclassifications`) | ✅ RabbitMQ ile tüketiliyor (aio-pika consumer, `rabbitmq_consumer.py`) — senkron REST kaldırıldı |
| `incident.resolved` | Incident Service | Gamification Service | ✅ RabbitMQ ile otomatik tüketiliyor (`gamification-consumer.service.ts`) |
| `incident.resolution.rated` | Incident Service | Gamification Service | ✅ RabbitMQ ile otomatik tüketiliyor |
| `incident.sla.exceeded` | Incident Service | Gamification Service | ✅ cron ile üretiliyor (`sla.scheduler.ts`) + RabbitMQ ile tüketiliyor |
| `incident.repeated` | Incident Service | Gamification Service | ✅ RabbitMQ ile otomatik tüketiliyor |
| `incident.parts.supplied` | Incident Service | — (audit) | Bonus/gelecek iyileştirme (durum geçişi `/status` ile yapılıyor, ayrı event yok) |
| `incident.predicted` | AI Service | — (audit) | Bonus/gelecek iyileştirme (şimdilik `predictions` tablosuna doğrudan yazılıyor) |
| `team.profile.updated` | Identity Service | AI Service (`team_cache`) | ✅ RabbitMQ ile otomatik tüketiliyor (aio-pika); ayrıca başlangıçta + `/internal/refresh-teams` ile manuel senkron REST pull de mevcut (yedek yol) |
| `badge.earned` | Gamification Service | Gateway (WebSocket relay → rozeti kazanan personel) | ✅ RabbitMQ'ya yayınlanıyor; **Faz 4:** Gateway'in Socket.IO relay'i ile `user:<user_id>` odasına `badge:earned` olarak iletiliyor, frontend toast gösterip profil/liderlik tablosu cache'ini anında tazeliyor |
| `audit.log` | Tüm servisler | Identity Service (merkezi toplama) | ✅ RabbitMQ ile otomatik tüketiliyor (`audit-consumer.service.ts`); Identity kendi auth olaylarını doğrudan kendi `audit_logs` tablosuna yazıyor |

## Payload Şemaları

### `incident.resolved`

```json
{
  "event_type": "incident.resolved",
  "timestamp": "2026-07-22T09:41:03Z",
  "payload": {
    "incident_id": "INC-2026-000123",
    "team_id": "a7f3...",
    "fault_type": "ISINMA",
    "priority": "KRITIK",
    "created_at": "2026-07-18T08:50:11Z",
    "resolved_at": "2026-07-18T09:41:03Z",
    "within_half_sla": true,
    "within_sla": true
  }
}
```

### `incident.status.changed`
```json
{ "incident_id": "INC-2026-000123", "from_status": "YOLDA", "to_status": "MUDAHALE_EDILIYOR", "changed_by": "<user_id>", "changed_at": "..." }
```

### `incident.type.changed`
```json
{ "incident_id": "INC-2026-000123", "original_type": "BELIRSIZ", "corrected_type": "DONANIM", "corrected_by": "<user_id>", "corrected_at": "..." }
```

### `incident.resolution.rated`
```json
{ "incident_id": "INC-2026-000123", "team_id": "<team_id>", "rating": 5, "is_permanent": true, "rated_by": "<noc_user_id>", "rated_at": "..." }
```

### `incident.sla.exceeded`
```json
{ "incident_id": "INC-2026-000123", "team_id": "<team_id>", "priority": "KRITIK", "sla_deadline": "...", "exceeded_at": "..." }
```

### `incident.repeated`
```json
{ "incident_id": "INC-2026-000200", "prior_incident_id": "INC-2026-000123", "team_id": "<team_id>", "station_code": "BTS-034", "detected_at": "..." }
```

### `team.profile.updated`
```json
{ "team_id": "<user_id>", "expertise": ["DONANIM", "ISINMA"], "region": ["Kadikoy"], "lat": 40.99, "lng": 29.02, "updated_at": "..." }
```

### `audit.log`
```json
{ "user_id": "<user_id>", "action_type": "YETKISIZ_ERISIM_DENEMESI", "timestamp": "...", "ip": "...", "result": "FAILURE", "detail": { "path": "...", "requiredRoles": ["SUPERVIZOR"], "actualRole": "MUSTERI" } }
```
