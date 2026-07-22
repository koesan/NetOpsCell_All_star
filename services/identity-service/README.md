# Identity Service

## Sorumluluk

Kayıt (müşteri OTP, personel email+şifre), giriş, JWT token yönetimi (RS256, access+refresh, rotation),
rol/yetki matrisi, hesap kilitleme, merkezi audit log.

Detaylı mimari kararlar için bkz. [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) — Bölüm 4.2, 5.1, 8.

## Durum: Faz 4 tamamlandı

Tüm auth akışları (OTP kayıt/giriş, personel email+şifre girişi, RS256 JWT + refresh rotation +
reuse-detection, hesap kilitleme, rol/yetki matrisi guard'ları, merkezi audit log) uçtan uca test
edildi. Demo kullanıcıları için `npm run seed` (bkz. `src/seed.ts`).

**Faz 3:** DB şifresi ve JWT private key artık Docker secrets üzerinden okunur (`readSecret()`,
bkz. `docs/ARCHITECTURE.md` Bölüm 19). `register()` uç noktası, daha önce kayıtlı (ACTIVE)
müşterilerin de yeni bir OTP isteyip tekrar giriş yapabilmesini destekler (Faz 3 doğrulamasında
bulunan bir hatanın düzeltmesi — bkz. Bölüm 21.2).

**Faz 4:** RS256 imzalama/doğrulama için gerçek birim testler eklendi (`src/auth/jwt.util.spec.ts`)
— geçerli token, süresi dolmuş token, `alg:none` saldırısı, farklı issuer ile token karışıklığı ve
bozulmuş imza senaryoları test edilir (`npm test`, CI'da otomatik çalışır).

**Faz 8:** Gerçek OTP teslimatı — Telegram Bot API (`src/auth/telegram.service.ts`). Kod hiçbir
koşulda API yanıtında/UI'da dönmez. Bot token tanımlı değilse (`TELEGRAM_BOT_TOKEN`) sabit kodlu
simülasyon fallback'i devreye girer (yalnızca sunucu logunda görünür). Ayrıca: refresh token
reuse-detection'da canlı testte bulunan kritik bir açık (`IsNull()` operatörü eksikliği) düzeltildi
— bkz. kök README "Güvenlik" bölümü ve `src/auth/auth.service.spec.ts`.

## Endpoint'ler (bkz. ARCHITECTURE.md Bölüm 6.1)

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/health` | Servis sağlık kontrolü |
| POST | `/api/v1/auth/register` | Müşteri kaydı + OTP tetikleme (Telegram'a gerçek gönderim; henüz bağlanmamışsa bağlantı linki döner) |
| GET | `/api/v1/auth/telegram/link-status` | Telegram bağlantısının tamamlanıp tamamlanmadığını sorgular (frontend polling) |
| POST | `/api/v1/auth/otp/verify` | OTP doğrulama |
| POST | `/api/v1/auth/login` | Personel/Süpervizör/Admin girişi |
| POST | `/api/v1/auth/refresh` | Token yenileme |
| POST | `/api/v1/auth/logout` | Oturum kapatma |
| GET | `/api/v1/auth/me` | Oturum sahibi bilgisi |
| POST | `/api/v1/admin/personnel` | Personel hesabı oluşturma (Admin) |
| PATCH | `/api/v1/admin/personnel/:id/role` | Rol değişikliği (Admin) |
| GET | `/api/v1/admin/audit-logs` | Audit log (Admin) |
| GET | `/internal/teams` | AI Service için dahili endpoint |

## Environment Değişkenleri

Bkz. [`.env.example`](./.env.example)

## Çalıştırma

```bash
npm install
npm run start:dev
npm run seed   # demo kullanicilarini olusturur (admin, supervizor, noc, 3 saha teknisyeni, 1 musteri)
```

Demo şifresi (email ile giriş yapan roller): `Demo123!` · Demo müşteri GSM: `05551234567` (OTP: `1234`)

Swagger dokümantasyonu: `http://localhost:3001/docs`
