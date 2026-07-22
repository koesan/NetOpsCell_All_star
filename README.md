# NetOpsCell

**Turkcell CodeNight 2026 Final — Şebeke Arıza Tahmini ve Saha Operasyon Platformu**

Turkcell şebeke altyapısındaki arızaları önceden tahmin eden, sınıflandıran, en uygun saha ekibine
yönlendiren ve saha personelini oyunlaştırma ile motive eden; API Gateway arkasında çalışan 4
bağımsız mikroservisten oluşan bir operasyon platformu.

> **Tek referans kaynağı:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — sistem mimarisi,
> teknoloji kararları ve aşamalı geliştirme yol haritasının tamamı bu dokümandadır. Herhangi bir
> tasarım sorusu için önce oraya bakılmalıdır.

## Mimari Özet

```
React SPA → API Gateway (Express) → Identity / Incident / AI / Gamification
                                          │           │        │         │
                                     PostgreSQL   PostgreSQL+ PostgreSQL  PostgreSQL+Redis
                                                   MongoDB
                                          └───────────┴────────┴─────────┘
                                                   RabbitMQ (event bus)

                              Loki + Promtail + Grafana (merkezi loglama, tüm servisler)
```

| Bileşen | Teknoloji |
|---|---|
| API Gateway | Node.js / Express (Helmet, CORS allowlist, rate limiting, JWT ön-doğrulama) |
| Identity Service | NestJS (TypeScript) + PostgreSQL |
| Incident Service | NestJS (TypeScript) + PostgreSQL (ilişkisel veri) + MongoDB (saha mesajlaşması) |
| AI Service | Python / FastAPI + PostgreSQL + scikit-learn |
| Gamification Service | NestJS (TypeScript) + PostgreSQL + Redis |
| Event bus | RabbitMQ (topic exchange + DLQ) |
| Merkezi loglama | Loki + Promtail + Grafana |
| Frontend | React + TypeScript (Vite), Tailwind, TanStack Query, Framer Motion, Recharts, React Leaflet |

Faz 3 ile birlikte: Docker Compose native `secrets:` mekanizması (düz metin şifre yok), ağ
mikro-segmentasyonu (her veritabanı yalnızca kendi servisinin bulunduğu network'te), non-root
container'lar, salt-okunur kök dosya sistemleri, Circuit Breaker (Incident→AI) ve retry+backoff
(AI→Identity/Incident) dayanıklılık desenleri. Detaylar: [`docs/ARCHITECTURE.md`
Bölüm 19-22](./docs/ARCHITECTURE.md#19-faz-3--secret-ve-anahtar-yönetimi).

Detaylar için: [Mimari Prensipler](./docs/ARCHITECTURE.md#2-mimari-prensipler-ve-teknoloji-kararları) ·
[Servis Detayları](./docs/ARCHITECTURE.md#4-mikroservis-detayları) ·
[Event Kataloğu](./EVENTS.md) · [Geliştirme Yol Haritası](./docs/ARCHITECTURE.md#15-aşamalı-geliştirme-yol-haritası)

## Proje Durumu

**Faz 0, Faz 1, Faz 2 ve Faz 3 tamamlandı ve uçtan uca test edildi:**

- ✅ **Secret yönetimi (Faz 3):** Tüm şifreler/anahtarlar `scripts/generate-secrets.sh` ile üretilip
  Docker Compose `secrets:` mekanizmasıyla mount edilir; repoda düz metin sır yoktur (bkz. Kurulum).
- ✅ **Ağ mikro-segmentasyonu (Faz 3):** `edge-net`, `services-net` ve her servis için ayrı
  `*-data-net` network'leri; veritabanları host'a hiç port açmaz, yalnızca kendi servisinden erişilir.
- ✅ **Container sertleştirme (Faz 3):** Tüm Node/Python servisleri non-root kullanıcıyla çalışır,
  `read_only: true` kök dosya sistemi + `tmpfs` geçici dizin, CPU/bellek limitleri.
- ✅ **Dayanıklılık desenleri (Faz 3):** Incident→AI çağrısı `opossum` Circuit Breaker ile sarılı
  (ACIK/YARI-ACIK/KAPALI geçişleri loglanır); AI→Identity/Incident çağrıları exponential
  backoff+jitter ile retry edilir. Fault-injection testleriyle doğrulandı (bkz. Bölüm 21.3).
- ✅ **Mesajlaşma mimarisi yeniden tasarlandı (Faz 3):** Saha/NOC mesajlaşması PostgreSQL'den
  MongoDB'ye taşındı; okunma bilgisi (`readBy`), mesaj durumu (`SENT/DELIVERED/READ`) ve
  kullanıcı+vaka bazlı anti-spam hız sınırlaması (20 msj/dk) eklendi.
  Zaman aşımı bütçesi (Mongo `serverSelectionTimeoutMS: 2500` < Gateway `proxyTimeout: 5000`)
  ile Mongo kesintisinde temiz ve hızlı hata dönüşü garanti edilir.
  Detaylar: [`docs/ARCHITECTURE.md` Bölüm 20](./docs/ARCHITECTURE.md#20-faz-3--mesajlaşma-mimarisi-mongodb).
- ✅ **Merkezi loglama (Faz 3):** Loki + Promtail (Docker service discovery ile tüm 16 container'ı
  otomatik keşfeder) + Grafana; Grafana datasource-proxy üzerinden log sorgulama doğrulandı.
- ✅ **AI model kalite kapısı ve registry (Faz 3):** Eğitim script'i veri seti doğrulaması
  (NaN/eksik sınıf kontrolü, SHA-256 fingerprint) ve minimum macro-F1 eşiği ile üretim modelini
  regresyona karşı korur; `GET /api/v1/ai/model-info` ile model geçmişi sorgulanabilir.
- ✅ **Uçtan uca hata enjeksiyonu testi (Faz 3):** AI, MongoDB, Gamification ve Identity Service
  tek tek durdurularak sistemin geri kalanının zarif şekilde bozulduğu (graceful degradation)
  kanıtlandı — detaylı sonuç tablosu [`docs/ARCHITECTURE.md` Bölüm 21.3](./docs/ARCHITECTURE.md#21-faz-3--doğrulama-sonuçları-uçtan-uca-test-ve-hata-enjeksiyonu).

**Daha önce tamamlanan fazlar:**

- ✅ Identity: OTP/personel auth, RS256 JWT + refresh rotation/reuse-detection, rol/yetki matrisi,
  hesap kilitleme, merkezi audit log
- ✅ Incident: state machine, SLA cron (aşım + 24s otomatik kapama), tekrar eden arıza tespiti,
  dashboard agregasyonu
- ✅ AI: sentetik veri (240 örnek) + 3 model karşılaştırması (RandomForest seçildi, test macro-F1 0.979),
  kural+ML hibrit tahmin, akıllı saha ekibi ataması, model **repoya gömülü** (ek eğitim adımı gerekmez)
- ✅ Gamification: puan/rozet/seviye mantığı birim test edildi (6/6 yeşil) ve gerçek vaka verisiyle doğrulandı
- ✅ **RabbitMQ gerçek event akışı (Faz 2):** `netopscell.events` topic exchange + DLQ; Incident→Gamification
  ve Identity/Incident→AI event'leri artık gerçek mesaj kuyruğu ile taşınıyor (stub log değil).
  Durable queue ile **kalıcılık testi** de doğrulandı: Gamification Service kapalıyken çözülen bir vaka
  kuyrukta bekledi, servis geri gelince otomatik işlendi.
- ✅ **Gateway JWT ön-doğrulama (Faz 2):** Public auth rotaları hariç tüm istekler Gateway'de RS256 ile
  doğrulanıyor; geçersiz/eksik token downstream servise hiç ulaşmadan 401 dönüyor.
- ✅ **Frontend (Faz 2):** Kurumsal tasarım sistemi (Tailwind + Inter + Turkcell lacivert/sarı palet),
  5 rol için tam ekran seti (Müşteri, Saha Teknisyeni, NOC Operatörü, Süpervizör, Admin), canlı harita
  (React Leaflet), grafikler (Recharts), animasyonlar (Framer Motion), responsive mobil navigasyon.
  Gerçek tarayıcıda (Playwright) tüm roller test edildi, konsol hatası yok.
- ✅ Uçtan uca demo zinciri (case Bölüm 11.3) canlı test edildi: müşteri kaydı → kritik telemetri →
  AI tahmini → otomatik atama → teknisyen çözümü → NOC değerlendirmesi → puan/rozet → liderlik tablosu
- ✅ Güvenlik testleri doğrulandı: 403 yetkisiz erişim, IDOR koruması, JWT manipülasyonu (401),
  brute-force hesap kilitleme, geçersiz durum geçişi (422)
- ✅ **Bağımsızlık testi doğrulandı:** AI Service ve Gamification Service ayrı ayrı `docker stop` ile
  durdurulup sistemin geri kalanının çalışmaya devam ettiği kanıtlandı

**Sırada (opsiyonel bonus):** WebSocket/SSE ile gerçek zamanlı rozet bildirimleri, CI/CD pipeline,
kategori bazlı AI doğruluk kırılımı paneli (bkz. yol haritası Bölüm 15, Faz 2 sonrası notlar).

## Kurulum ve Çalıştırma

**1. Secret'ları üret (yalnızca ilk kurulumda gerekli):**

```bash
./scripts/generate-secrets.sh
```

Bu, `secrets/` dizininde tüm DB şifrelerini, RabbitMQ kimlik bilgisini, dahili API anahtarını,
JWT RS256 anahtar çiftini ve Grafana admin şifresini üretir. Bu dizin repoya dahil edilmez.

**2. Sistemi ayağa kaldır:**

```bash
docker compose up --build
```

Ayağa kalkan servisler:

| Servis | Adres |
|---|---|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:8080 |
| Identity Service (+ Swagger) | http://localhost:3001/docs |
| Incident Service (+ Swagger) | http://localhost:3002/docs |
| AI Service (+ Swagger) | http://localhost:8000/docs |
| Gamification Service (+ Swagger) | http://localhost:3003/docs |
| RabbitMQ Management UI | http://localhost:15672 (`netopscell_app` / `secrets/rabbitmq_password.txt`) |
| Grafana (merkezi loglama) | http://localhost:3100 (`admin` / `secrets/grafana_admin_password.txt`) |

Veritabanları (Postgres×4, MongoDB, Redis) ve Loki artık host'a port açmaz — yalnızca kendi
servislerinin bulunduğu izole Docker network'ünden erişilebilirler (Faz 3 ağ mikro-segmentasyonu).

Her serviste `/health` endpoint'i mevcuttur; kök `docker-compose.yml` bu endpoint'leri healthcheck
olarak kullanır.

**Demo verisi (ilk kurulumda bir kez çalıştırılmalı):**

```bash
docker compose exec identity-service node dist/seed.js
curl -X POST http://localhost:8000/internal/refresh-teams -H "x-internal-key: $(cat secrets/internal_api_key.txt)"
```

| Rol | Email / GSM | Şifre / OTP |
|---|---|---|
| Admin | admin@netopscell.com | Demo123! |
| Süpervizör | supervizor@netopscell.com | Demo123! |
| NOC Operatörü | noc@netopscell.com | Demo123! |
| Saha Teknisyeni (Donanım/Isınma) | saha.donanim@netopscell.com | Demo123! |
| Saha Teknisyeni (Bağlantı/Yazılım) | saha.baglanti@netopscell.com | Demo123! |
| Saha Teknisyeni (Güç Kesintisi) | saha.guc.kesintisi@netopscell.com | Demo123! |
| Müşteri | 05551234567 | OTP: 1234 (simülasyon) |

## Servis Dokümantasyonu

- [`gateway/README.md`](./gateway/README.md)
- [`services/identity-service/README.md`](./services/identity-service/README.md)
- [`services/incident-service/README.md`](./services/incident-service/README.md)
- [`services/ai-service/README.md`](./services/ai-service/README.md)
- [`services/gamification-service/README.md`](./services/gamification-service/README.md)
- [`frontend/README.md`](./frontend/README.md)

## Kaynak Case Dokümanı

Orijinal case dokümanı: [`CodeNight_FINAL_NetOpsCell_Case.pdf`](./CodeNight_FINAL_NetOpsCell_Case.pdf)
