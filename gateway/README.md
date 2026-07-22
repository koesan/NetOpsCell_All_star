# API Gateway

## Sorumluluk

Tek giriş noktası: routing, JWT doğrulama, rate limiting, CORS, correlation-id enjeksiyonu,
standart hata zarfı.

Detaylı mimari kararlar için bkz. [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) — Bölüm 4.1.

## Durum: Faz 3 tamamlandı

Routing + rate limiting + health-check + **JWT ön-doğrulama** aktif (`src/jwt-auth.middleware.js`).
Public key Docker secret'tan okunur (`/run/secrets/jwt_public_key`) ile RS256 doğrulama yapılır;
public auth rotaları (register/login/otp/refresh/logout) ve `/health` hariç tüm istekler burada
kontrol edilir — geçersiz token downstream servise hiç ulaşmadan `401` döner (savunma derinliği;
her servis kendi guard'ında da ayrıca doğrular).

**Faz 3:** Helmet güvenlik başlıkları, `CORS_ALLOWED_ORIGINS` ile kısıtlı CORS, endpoint bazlı ek
rate limit'ler (register/otp-verify/refresh). Proxy hata yakalama `http-proxy-middleware` v3'ün
`on: { error, proxyReq }` API'sine taşındı — hedef servis erişilemez olduğunda artık her zaman
standart `{success:false, error:{code:"SERVICE_UNAVAILABLE"}}` JSON zarfı döner (v1/v2 tarzı
`onError` seçeneği v3'te sessizce yok sayılıyordu — bkz. `docs/ARCHITECTURE.md` Bölüm 21.2).

## Routing Tablosu

| Path prefix | Hedef servis |
|---|---|
| `/api/v1/auth/**` | Identity Service |
| `/api/v1/admin/**` | Identity Service |
| `/api/v1/telemetry` | Incident Service |
| `/api/v1/incidents/**` | Incident Service |
| `/api/v1/dashboard/**` | Incident Service |
| `/api/v1/ai/**` | AI Service |
| `/api/v1/game/**` | Gamification Service |

## Rate Limiting

- Genel: 100 istek/dk/IP
- `/api/v1/auth/login`: 5 istek/dk/IP (brute-force savunması)

## Environment Değişkenleri

Bkz. [`.env.example`](./.env.example)

## Çalıştırma

```bash
npm install
npm run start:dev
```
