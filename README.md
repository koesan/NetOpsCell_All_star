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

**Faz 5 — Canlı Saha Operasyonu (case kapsamının ötesi):**

- ✅ **İkinci ML modeli — çözüm süresi (ETA) regresyonu:** Sınıflandırıcıdan bağımsız bir
  Ridge regresyon pipeline'ı (3 aday model, 5-fold CV, MAE kalite kapısı) atama anında sahadaki
  iş süresini tahmin eder; yol süresi deterministik hesaplanır (şehir içi hız + yol kıvrım
  faktörü). Atamalar artık `yol + saha işi = toplam ETA` kırılımıyla döner.
  Metodoloji ve gerçek metrikler: [`ML_APPROACH.md` Bölüm 10](./services/ai-service/ML_APPROACH.md).
- ✅ **Sentetik veri seti v2:** 1.500 örnek (250/sınıf), %12'si sınıflar arası sınır bölgesinde
  üretilen "zor örnek" — metrikler gerçekçi belirsizlik altında ölçülür (test macro-F1 0.957).
  Ayrıca ETA modeli için 2.400 örneklik ayrı bir üretici süreçle (latent parça değişkenli)
  çözüm süresi veri seti.
- ✅ **Operasyon haritası:** Baz istasyonu kataloğu (18 gerçek İstanbul lokasyonu), saha ekipleri
  (üs konumu + anlık iş yükü + müsaitlik), oncelik renkli nabız animasyonlu vaka marker'ları,
  atama **rota planları** (OSRM gerçek yol geometrisi, erişilemezse kuş uçuşu kavisli düşüş) ve
  YOLDA durumundaki her ekip için **canlı araç akışı** (departedAt + ETA'dan deterministik
  interpolasyon — tüm istemciler aynı konumu görür). Zoom/tam ekran/katman seçimi/lejant dahil.
- ✅ **Atama açıklanabilirliği ("Neden bu ekip?"):** Vaka detayında skor kırılımı
  (uzmanlık ×0.4 / mesafe ×0.3 / kapasite ×0.3), değerlendirilen alternatif ekipler ve
  ETA panosu; `assignmentDetail` alanında kalıcı olarak saklanır.
- ✅ **WhatsApp tarzı saha mesajlaşması:** Gün ayraçları, ardışık mesaj gruplama, gönderen adı +
  rol rozeti, tek/çift tik okundu bilgisi (MongoDB read-receipt), optimistik gönderim ve vaka
  yaşam döngüsü olaylarının (atama, yola çıkış, varış, çözüm) thread'e otomatik **sistem
  mesajı** olarak düşmesi.
- ✅ **Vaka zaman çizelgesi:** `GET /incidents/:id/history` + arayüzde dikey timeline; YOLDA/varış
  anları `departedAt/arrivedAt` olarak kaydedilir (ETA gerçekleşme analizi için).
- ✅ **Tek komut demo senaryosu:** `./scripts/seed-demo.sh` — 6 telemetri (1'i AI tarafından
  İZLE'ye ayrılır), NOC onayları, tam yaşam döngüsü + 5 yıldız değerlendirme (gamification),
  PARCA_BEKLENIYOR edge-case'i ve haritada canlı izlenen YOLDA vakası.

**Faz 0, Faz 1, Faz 2, Faz 3 ve Faz 4 tamamlandı ve uçtan uca test edildi:**

- ✅ **Gerçek zamanlı bildirimler (Faz 4, bonus):** Gateway'de Socket.IO relay'i — JWT ile
  kimlik doğrulanmış her istemci `user:<id>` odasına yerleşir; `incident.assigned` (atanan
  teknisyene toast + anlık liste yenileme) ve `badge.earned` (rozet toast'ı + profil/liderlik
  cache tazeleme) olayları RabbitMQ'dan tüketilip gerçek zamanlı iletilir. İş-kritik değildir
  (best-effort); Gateway yeniden başlarsa yalnızca bir toast kaçırılır, veri kaybı olmaz.
- ✅ **Kategori bazlı AI doğruluk paneli (Faz 4, bonus):** `GET /api/v1/ai/accuracy/by-category`
  artık Süpervizör dashboard'da her arıza türü için ayrı doğruluk oranı gösteren bir tabloya
  bağlandı.
- ✅ **CI/CD pipeline (Faz 4, bonus):** GitHub Actions (`.github/workflows/ci.yml`) her push/PR'da
  4 Node servisinin build+test'ini, frontend build'ini, AI servisi pytest'lerini ve tüm 7 Docker
  imajının derlenebilirliğini otomatik doğrular.
- ✅ **Test kapsamı tamamlandı (Faz 4):** Daha önce placeholder olan Identity (JWT imzalama/
  doğrulama, RS256, `alg:none`/issuer-karışıklığı savunması) ve Incident (durum makinesi, 14 test)
  birim testleri gerçek Jest testleriyle değiştirildi; AI servisine kural katmanı ve atama
  skorlama formülü için 22 pytest testi eklendi (`services/ai-service/tests/`).
- ✅ **AI yaklaşım dokümanı (Faz 4):** [`services/ai-service/ML_APPROACH.md`](./services/ai-service/ML_APPROACH.md)
  — veri seti üretim mantığı, model seçim metodolojisi, gerçek çapraz doğrulama/test metrikleri.

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

Tüm case bonus kalemleri (kendi eğitilmiş model, RabbitMQ, kategori bazlı AI doğruluk, WebSocket,
CI/CD) tamamlanmıştır. Kapsam dışı bırakılan üretim-seviyesi konular (mTLS, Kubernetes, Vault,
Kafka, Prometheus/Alertmanager) ve gerekçeleri için bkz. `docs/ARCHITECTURE.md` Bölüm 22.

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

**Demo senaryosu (opsiyonel ama önerilir):** sistemi gerçekçi bir "operasyon günü" ile doldurur —
farklı türlerde vakalar, tam yaşam döngüsü + gamification puanları, saha↔NOC mesajlaşma örneği
ve haritada canlı izlenen YOLDA vakası:

```bash
./scripts/seed-demo.sh
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
- [`services/ai-service/README.md`](./services/ai-service/README.md) ·
  [`ML_APPROACH.md`](./services/ai-service/ML_APPROACH.md) (veri seti, model seçimi, gerçek metrikler)
- [`services/gamification-service/README.md`](./services/gamification-service/README.md)
- [`frontend/README.md`](./frontend/README.md)

## Kaynak Case Dokümanı

Orijinal case dokümanı: [`CodeNight_FINAL_NetOpsCell_Case.pdf`](./CodeNight_FINAL_NetOpsCell_Case.pdf)
