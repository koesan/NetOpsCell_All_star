# Gamification Service

## Sorumluluk

Puan, rozet, seviye, liderlik tablosu. **Doğrudan çağrı almaz — sadece Incident Service'ten gelen
event'lerle çalışır** (event-tabanlı mimari, case gereksinimi).

Detaylı mimari kararlar için bkz. [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) — Bölüm 4.5, 5.4, 7.

## Durum: Faz 4 tamamlandı

Puan/rozet/seviye mantığı `gamification.service.spec.ts` ile birim test edildi (6/6 test yeşil,
`npm test`) ve gerçek vaka verisiyle uçtan uca doğrulandı. Event'ler gerçek RabbitMQ üzerinden
tüketilir (Faz 2).

**Faz 3:** Servis durdurulup yeniden başlatılarak, kapalıyken üretilen olayların durable kuyrukta
kayıpsız biriktiği ve geri geldiğinde otomatik işlendiği canlı ölçümle doğrulandı
(bkz. `docs/ARCHITECTURE.md` Bölüm 21.3).

**Faz 4:** `badge.earned` olayı artık Gateway üzerinden rozeti kazanan personele gerçek zamanlı
toast bildirimi olarak da iletiliyor (bkz. `gateway/src/websocket.js`, `EVENTS.md`).

## Endpoint'ler (bkz. ARCHITECTURE.md Bölüm 6.1)

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/health` | Servis sağlık kontrolü |
| GET | `/api/v1/game/leaderboard?period=daily\|weekly` | Liderlik tablosu (Redis sorted set) |
| GET | `/api/v1/game/profile/:userId` | Profil verisi (puan, seviye, rozetler) |
| GET | `/api/v1/game/badges` | Rozet kataloğu |

## Dinlediği Event'ler

`incident.resolved` (puan hesabı), `incident.resolution.rated` (kalıcı çözüm / tekrar eden arıza),
`incident.sla.exceeded` (SLA aşım cezası)

## Yayınladığı Event'ler

`badge.earned`, `points.updated`

## Environment Değişkenleri

Bkz. [`.env.example`](./.env.example) — PostgreSQL (durable puan defteri) + Redis (liderlik tablosu cache).

## Çalıştırma

```bash
npm install
npm run start:dev
```

Swagger dokümantasyonu: `http://localhost:3003/docs`
