# Incident Service

## Sorumluluk

Arıza/telemetri girişi, arıza yaşam döngüsü state machine (YENI→ATANDI→YOLDA→MUDAHALE_EDILIYOR↔PARCA_BEKLENIYOR→COZULDU→KAPANDI),
SLA takibi, saha–NOC mesajlaşması, çözüm değerlendirmesi.

Detaylı mimari kararlar için bkz. [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) — Bölüm 4.3, 5.2, 7, 9.

## Durum: Faz 4 tamamlandı

State machine, SLA hesaplama + arka plan cron (aşım tespiti + 24s otomatik kapama), AI Service
entegrasyonu (senkron `/predict` + `/assign`, **Circuit Breaker** ile sarılı, fallback davranışı),
tekrar eden arıza tespiti, dashboard agregasyonları uçtan uca test edildi (bkz. kök
`docs/ARCHITECTURE.md` Bölüm 15 demo notları, Bölüm 21 doğrulama sonuçları).

**Faz 3:** Saha–NOC mesajlaşması PostgreSQL'den **MongoDB**'ye taşındı (okunma bilgisi, mesaj
durumu, anti-spam hız sınırlama dahil — bkz. `docs/ARCHITECTURE.md` Bölüm 20). Incident→AI çağrısı
`opossum` Circuit Breaker ile korunur.

**Faz 4:** Durum makinesi (`state-machine.ts`) için gerçek birim testler eklendi
(`src/incidents/state-machine.spec.ts`, 14 test — her yasal geçiş, rol ihlali, adım atlama ve
terminal durum davranışı; `npm test`, CI'da otomatik çalışır). `incident.assigned` olayı artık
Gateway üzerinden atanan teknisyene gerçek zamanlı bildirim olarak da iletiliyor.

## Endpoint'ler (bkz. ARCHITECTURE.md Bölüm 6.1)

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/health` | Servis sağlık kontrolü |
| POST | `/api/v1/telemetry` | Telemetri/arıza girişi (Müşteri) → AI Service'e sync çağrı |
| GET | `/api/v1/incidents` | Vaka listesi (rol bazlı filtreli) |
| GET | `/api/v1/incidents/:id` | Vaka detayı (sahiplik kontrollü) |
| PATCH | `/api/v1/incidents/:id/status` | Durum geçişi (state machine, kural dışı → 422) |
| PATCH | `/api/v1/incidents/:id/assign` | Manuel atama (Süpervizör) |
| POST | `/api/v1/incidents/:id/confirm` | NOC/Süpervizör: VAKA_AC tahminini onaylayıp AI ile otomatik atama tetikler |
| PATCH | `/api/v1/incidents/:id/classification` | Tür/öncelik override (AI'a bildirilir) |
| POST | `/api/v1/incidents/:id/messages` | Mesaj gönder (MongoDB, anti-spam hız sınırlamalı) |
| GET | `/api/v1/incidents/:id/messages` | Thread getir (MongoDB) |
| PATCH | `/api/v1/incidents/:id/messages/read` | Thread'i okundu olarak işaretle (okunma bilgisi) |
| POST | `/api/v1/incidents/:id/resolution` | Çözüm notu (MUDAHALE_EDILIYOR → COZULDU) |
| POST | `/api/v1/incidents/:id/resolution/rate` | 1-5 yıldız değerlendirme (KAPANDI sonrası, tek seferlik) |
| GET | `/api/v1/dashboard/summary` | Süpervizör dashboard agregasyonu |
| GET | `/internal/teams/workload` | AI Service için dahili endpoint |

## Yayınladığı Event'ler

`incident.created`, `incident.status.changed`, `incident.assigned`, `incident.type.changed`,
`incident.resolved`, `incident.resolution.rated`, `incident.sla.exceeded`, `incident.parts.supplied`

Detaylı payload şemaları için bkz. `EVENTS.md` (Faz 2'de eklenecek).

## Environment Değişkenleri

Bkz. [`.env.example`](./.env.example)

## Çalıştırma

```bash
npm install
npm run start:dev
```

Swagger dokümantasyonu: `http://localhost:3002/docs`
