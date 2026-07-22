# NetOpsCell — Teknik Mimari ve Geliştirme Yol Haritası

**Turkcell CodeNight 2026 Final — Şebeke Arıza Tahmini ve Saha Operasyon Platformu**

> Bu doküman projenin **tek referans kaynağıdır**. Ekipteki her geliştirici (veya AI ajanı), başka bir bağlama ihtiyaç duymadan sadece bu dokümana bakarak kendi sorumlu olduğu servisi geliştirebilmelidir. Mimari onaylandıktan sonra tüm geliştirme bu dokümana göre ilerler; kapsam değişikliği gerekiyorsa önce bu doküman güncellenir.

---

## İçindekiler

1. [Proje Özeti](#1-proje-özeti)
2. [Mimari Prensipler ve Teknoloji Kararları](#2-mimari-prensipler-ve-teknoloji-kararları)
3. [Genel Sistem Mimarisi](#3-genel-sistem-mimarisi)
4. [Mikroservis Detayları](#4-mikroservis-detayları)
5. [Veritabanı Mimarisi](#5-veritabanı-mimarisi)
6. [API Tasarımı](#6-api-tasarımı)
7. [Servisler Arası İletişim ve Event Mimarisi](#7-servisler-arasi-iletisim-ve-event-mimarisi)
8. [Kimlik Doğrulama ve Yetkilendirme](#8-kimlik-doğrulama-ve-yetkilendirme)
9. [AI/ML Bileşeni](#9-aiml-bileşeni)
10. [Güvenlik Mimarisi](#10-güvenlik-mimarisi)
11. [Ölçeklenebilirlik, Performans ve Dayanıklılık](#11-ölçeklenebilirlik-performans-ve-dayanıklılık)
12. [Deployment, Docker Compose ve CI/CD](#12-deployment-docker-compose-ve-cicd)
13. [UI/UX ve Frontend Mimarisi](#13-uiux-ve-frontend-mimarisi)
14. [Servis Bağımlılık Matrisi](#14-servis-bağımlılık-matrisi)
15. [Aşamalı Geliştirme Yol Haritası](#15-aşamalı-geliştirme-yol-haritası)
16. [Test Stratejisi ve Dokümantasyon Teslimatları](#16-test-stratejisi-ve-dokümantasyon-teslimatları)
17. [Değerlendirme Kriterleri Eşlemesi](#17-değerlendirme-kriterleri-eşlemesi)
18. [Varsayımlar ve Açık Kararlar](#18-varsayımlar-ve-açık-kararlar)
19. [Faz 3 — Secret ve Anahtar Yönetimi](#19-faz-3--secret-ve-anahtar-yönetimi)
20. [Faz 3 — Mesajlaşma Mimarisi (MongoDB)](#20-faz-3--mesajlaşma-mimarisi-mongodb)
21. [Faz 3 — Doğrulama Sonuçları (Uçtan Uca Test ve Hata Enjeksiyonu)](#21-faz-3--doğrulama-sonuçları-uçtan-uca-test-ve-hata-enjeksiyonu)
22. [Üretim Yol Haritası ve Bilinçli Kapsam Dışı Bırakılanlar](#22-üretim-yol-haritası-ve-bilinçli-kapsam-dışı-bırakılanlar)
23. [Faz 4 — Cilalama, Bonus Özellikler ve Test Kapsamı](#23-faz-4--cilalama-bonus-özellikler-ve-test-kapsamı)

---

## 1. Proje Özeti

NetOpsCell, Turkcell şebekesindeki arızaları yapay zekâ ile önceden tahmin eden, sınıflandıran, en uygun saha ekibine yönlendiren ve saha personelini oyunlaştırma (gamification) ile motive eden, **4 bağımsız mikroservis + API Gateway**'den oluşan bir operasyon platformudur.

**Zorunlu bileşenler:** API Gateway, Identity Service, Incident Service, AI Service, Gamification Service — her biri kendi veritabanına sahip, birbirinin veritabanına doğrudan erişemez, Docker Compose ile tek komutla ayağa kalkar.

**Kritik başarı kriteri:** Herhangi bir servis çökse dahi (özellikle canlı demoda `docker stop` ile durdurulan servis) sistemin geri kalanı çalışmaya devam etmelidir. Bu doküman baştan sona bu bağımsızlık ilkesi etrafında tasarlanmıştır.

---

## 2. Mimari Prensipler ve Teknoloji Kararları

| Karar Alanı | Seçim | Gerekçe |
|---|---|---|
| Mimari stil | Mikroservis + API Gateway | Case'in zorunlu koşulu; monolith diskalifiye sebebi |
| Identity / Incident / Gamification | **NestJS (TypeScript)** | Decorator tabanlı guard'lar rol/yetki matrisini doğal şekilde modelliyor; `@nestjs/swagger` ile otomatik OpenAPI; `@nestjs/microservices` ile RabbitMQ entegrasyonu hazır; 3 kişilik ekipte tek dilde tutarlılık |
| AI Service | **Python + FastAPI** | scikit-learn ile native ML entegrasyonu; Pydantic ile otomatik validasyon + OpenAPI; async performans |
| API Gateway | **Custom Node.js/Express reverse proxy** | JWT doğrulama, rate-limiting ve audit-403 loglama üzerinde tam kontrol gerekiyor (jüri canlı sızma testi yapacak); NestJS ekosistemiyle aynı dilde, öğrenme maliyeti yok |
| Servisler arası iletişim | REST (senkron, kritik yol) + **RabbitMQ** (asenkron, olay tabanlı) | Case'in Gamification için özellikle event-tabanlı mimari istemesi + bağımsızlık ilkesini güçlendirmesi (durable queue → servis kapalıyken olay kaybolmaz) + bonus (+5) |
| Veritabanı stratejisi | **Database-per-service, ağırlıklı olarak PostgreSQL + türetilmiş veri için Redis** | Bkz. Bölüm 5 |
| Frontend | **React + TypeScript (Vite) — Web** | Dashboard grafikleri, gerçek zamanlı liderlik tablosu ve responsive tasarım için en verimli platform |
| Auth token | JWT **RS256** (asimetrik) | Identity Service private key ile imzalar; Gateway ve servisler sadece public key ile doğrular — secret hiçbir yerde paylaşılmaz |
| Repo stratejisi | **Monorepo**, servis başına klasör | 3 kişilik takımda tek PR akışı, atomik commit, ortak `docker-compose.yml` yönetimi kolaylığı |
| Deployment | Docker Compose (zorunlu) | K8s bu case'in kapsamı dışında (bkz. Bölüm 11 — üretim yol haritası notu) |

---

## 3. Genel Sistem Mimarisi

```
                         ┌─────────────────────┐
                         │   React SPA (Web)    │
                         └──────────┬───────────┘
                                    │ HTTPS
                         ┌──────────▼───────────┐
                         │     API GATEWAY       │
                         │  (Express, Node.js)   │
                         │  • JWT doğrulama      │
                         │  • Rate limiting      │
                         │  • Routing            │
                         │  • Correlation-ID     │
                         │  • Standart error     │
                         └──┬──────┬──────┬──────┘
             ┌──────────────┘      │      └──────────────┐
             ▼                     ▼                      ▼
   ┌──────────────────┐  ┌──────────────────┐   ┌──────────────────┐
   │ Identity Service  │  │ Incident Service  │   │Gamification Svc  │
   │   (NestJS)        │  │   (NestJS)        │   │   (NestJS)       │
   │  ┌─────────────┐  │  │  ┌─────────────┐  │   │ ┌─────────────┐  │
   │  │ PostgreSQL  │  │  │  │ PostgreSQL  │  │   │ │ PostgreSQL  │  │
   │  └─────────────┘  │  │  └─────────────┘  │   │ │  + Redis    │  │
   └─────────┬──────────┘  └────────┬──────────┘   │ └─────────────┘  │
             │                      │ sync REST      └────────▲─────────┘
             │ events               │ (/predict)               │ events
             │              ┌───────▼──────────┐               │
             └─────────────►│    AI Service     │───────────────┘
                            │    (FastAPI)      │
                            │  ┌─────────────┐  │
                            │  │ PostgreSQL  │  │
                            │  └─────────────┘  │
                            └───────────────────┘
                                    ▲
                                    │ pub/sub
                         ┌──────────┴───────────┐
                         │   RabbitMQ            │
                         │ (netopscell.events)   │
                         └───────────────────────┘
```

**Bileşen özeti:**

| Bileşen | Rol |
|---|---|
| React SPA | Rol bazlı ekranlar (Müşteri, Saha Teknisyeni, NOC Operatörü, Süpervizör, Admin) |
| API Gateway | Tek giriş noktası, JWT doğrulama, rate limiting, routing |
| Identity Service | Kimlik, oturum, rol/yetki, audit log |
| Incident Service | Arıza yaşam döngüsü, SLA, saha iletişimi |
| AI Service | Tahmin, sınıflandırma, akıllı atama |
| Gamification Service | Puan, rozet, seviye, liderlik |
| RabbitMQ | Olay tabanlı asenkron iletişim omurgası |
| PostgreSQL ×4 | Her servisin kendi kalıcı veri deposu |
| Redis | Gamification liderlik tablosu / hızlı cache katmanı |

---

## 4. Mikroservis Detayları

### 4.1 API Gateway

**Sorumluluk:** Tek giriş noktası; routing, JWT doğrulama (Identity'nin yayınladığı public key ile), rate limiting, CORS, correlation-id enjeksiyonu, standart hata zarfı.

**Routing tablosu:**

| Path prefix | Hedef servis |
|---|---|
| `/api/v1/auth/**` | Identity Service |
| `/api/v1/admin/**` | Identity Service |
| `/api/v1/telemetry` | Incident Service |
| `/api/v1/incidents/**` | Incident Service |
| `/api/v1/ai/**` | AI Service |
| `/api/v1/game/**` | Gamification Service |

**Rate limiting:** Genel `100 req/dk/IP`; `/api/v1/auth/login` için `5 deneme/dk/IP` (brute-force testine karşı ilk savunma hattı).

### 4.2 Identity Service

**Sorumluluk:** Kayıt, giriş, token yönetimi, rol/yetki matrisi, hesap kilitleme, merkezi audit log.

**Ana işlevler:**
- Müşteri kaydı: GSM + OTP (simüle, sabit kod `1234`)
- Personel/Süpervizör/Admin girişi: email + şifre (argon2id hash)
- JWT üretimi (RS256): access token 15dk (payload: `user_id`, `role`, `expertise[]`, `region[]`), refresh token 7 gün (DB'de saklanır)
- Refresh token rotation + reuse detection (aile bazlı: bir refresh token tekrar kullanılırsa o kullanıcının tüm oturumları iptal edilir)
- Hesap kilitleme: 5 başarısız giriş → 15 dakika kilit, kalan süre response'da döner
- Rol/yetki matrisinin endpoint seviyesinde uygulanması (guard/decorator), ihlalde 403 + audit log
- Merkezi audit log: kendi ürettiği event'ler + diğer servislerden gelen `audit.log` event'lerinin toplanması

**Roller:** `MUSTERI`, `SAHA_TEKNISYENI`, `NOC_OPERATORU`, `SUPERVIZOR`, `ADMIN`. Yetki matrisinde "Personel" sütunu `SAHA_TEKNISYENI` ve `NOC_OPERATORU` için ortak izinleri ifade eder; ince taneli iş mantığı ayrımı (örn. sadece atanan teknisyen kendi vakasının durumunu değiştirebilir) servis katmanında uygulanır.

**Yayınladığı event'ler:** `team.profile.updated`, `audit.log` (kendi ürettiği), `account.locked`

**Dinlediği event'ler:** `audit.log` (diğer servislerden — merkezi toplama için)

### 4.3 Incident Service

**Sorumluluk:** Arıza/telemetri girişi, arıza yaşam döngüsü (state machine), SLA takibi, saha–NOC mesajlaşması, çözüm değerlendirmesi.

**State machine:**

```
YENI ──(Sistem/Süpervizör)──► ATANDI ──(Saha Tek.)──► YOLDA ──(Saha Tek.)──► MUDAHALE_EDILIYOR
                                                                                    │   ▲
                                                                    (Saha Tek.)     │   │ (Sistem: parça tedarik)
                                                                    parça gerekli   ▼   │
                                                                              PARCA_BEKLENIYOR
MUDAHALE_EDILIYOR ──(Saha Tek., çözüm notu zorunlu)──► COZULDU ──(NOC/Sistem: doğrulama veya 24s)──► KAPANDI
```

Kural dışı geçiş denemesi → `422 Unprocessable Entity`.

**Ana işlevler:**
- Telemetri girişi (`POST /api/v1/telemetry`, sadece `MUSTERI` rolü — bkz. Bölüm 18.1): baz istasyonu kodu, konum, metrikler
- Her telemetri **senkron REST** ile AI Service'e gönderilir; olasılık ≥ 0.85 → otomatik vaka açılır, 0.4–0.85 arası NOC onayına düşer, < 0.4 sadece izlenir
- AI Service erişilemezse (timeout 2sn veya bağlantı hatası): vaka yine oluşturulur, `fault_type=BELIRSIZ`, `priority=ORTA`, manuel atama kuyruğuna düşer — **circuit-breaker + fallback deseni**
- SLA hesabı: vaka oluşturma anından `COZULDU`'ya kadar sayılır; arka planda periyodik job SLA aşımını kontrol eder ve `incident.sla.exceeded` event'i yayınlar
- Saha–NOC mesaj thread'i (gönderen, zaman damgası, içerik)
- Çözüm notu + `KAPANDI` sonrası 1-5 yıldız değerlendirme (kalıcı/geçici)

**Yayınladığı event'ler:** `incident.created`, `incident.status.changed`, `incident.assigned`, `incident.type.changed`, `incident.resolved`, `incident.resolution.rated`, `incident.sla.exceeded`, `incident.parts.supplied`

**Dinlediği event'ler:** — (bağımsız çalışır; AI Service'e senkron çağrı yapar, cevap alamazsa fallback uygular)

### 4.4 AI Service

**Sorumluluk:** Arıza olasılığı tahmini, arıza türü sınıflandırma, akıllı saha ekibi ataması. Detaylı ML süreci için bkz. **Bölüm 9**.

**Ana işlevler:**
- `POST /api/v1/ai/predict`: telemetri girdisi → `{probability, fault_type, priority_hint, recommendation}`
- Akıllı atama skorlaması: `skor = uzmanlik_eslesme×0.4 + mesafe_yakinlik×0.3 + bosluk_orani×0.3`
- Doğruluk takibi: NOC/Süpervizör override'ları `misclassification` olarak loglanır, `doğru/toplam×100` metriği hesaplanır

**Çapraz servis veri ihtiyacı çözümü:** Atama skorlaması için personel uzmanlık/bölge bilgisi (Identity) ve güncel aktif vaka sayısı (Incident) gerekir. Database-per-service kuralı doğrudan sorgulamayı yasakladığından, AI Service bu verilerin **kendi salt-okunur kopyasını** event dinleyerek kendi DB'sinde tutar (`team_cache`, `workload_cache`). Böylece Identity veya Incident servisi çökse dahi AI Service son bilinen veriyle atama yapmaya devam edebilir.

**Yayınladığı event'ler:** `incident.predicted`

**Dinlediği event'ler:** `team.profile.updated` (→ `team_cache` günceller), `incident.status.changed` (→ `workload_cache` günceller), `incident.type.changed` (→ `misclassifications` tablosuna yazar)

### 4.5 Gamification Service

**Sorumluluk:** Puan, rozet, seviye, liderlik tablosu. **Doğrudan çağrı almaz, sadece event dinler.**

**Ana işlevler:**
- Puan tablosu (COZULDU +10, hızlı müdahale +5, kalıcı çözüm +10, KRİTİK-SLA-içi +15, SLA aşımı -5, tekrar eden arıza -3)
- Rozet kontrolü (İlk Müdahale, Hız Ustası, Kalıcı Çözüm, Maratoncu, Kriz Yöneticisi, Uzman)
- Seviye hesabı (Bronz/Gümüş/Altın/Platin)
- Günlük/haftalık liderlik tablosu (Redis sorted set), profil ekranı verisi

**Dinlediği event'ler:** `incident.resolved`, `incident.resolution.rated`, `incident.sla.exceeded`

**Yayınladığı event'ler:** `badge.earned`, `points.updated`

---

## 5. Veritabanı Mimarisi

**Genel ilke:** Case'in `database-per-service` zorunluluğu gereği her servis kendi veritabanına sahiptir ve başka servisin veritabanına doğrudan erişemez. Veri tipi seçimi, o servisin verisinin doğasına göre yapılmıştır.

| Servis | Veritabanı | İlişkisel mi? | Gerekçe |
|---|---|---|---|
| Identity | **PostgreSQL** | Evet | Kullanıcı–rol–token–audit-log arasında güçlü ilişkisel bütünlük ve ACID garantisi gerekir (örn. refresh token rotation'ın yarıda kesilmemesi kritik) |
| Incident | **PostgreSQL** | Evet | State machine geçişleri, SLA hesapları ve mesaj thread'i arasında foreign key ilişkileri + transactional tutarlılık şart |
| AI | **PostgreSQL** | Evet | Tahmin logları ve cache tabloları yapısal, sabit şemalı veridir; yüksek hacimli şemasız veri yok, dolayısıyla doküman tabanlı NoSQL'e gerekçe yok |
| Gamification | **PostgreSQL (durable) + Redis (türetilmiş/hızlı)** | Karma | Puan defteri **gerçek kaynak (source of truth)** olarak PostgreSQL'de tutulur (denetlenebilirlik, kalıcılık); liderlik tablosu gibi sık okunan, yeniden hesaplanabilir veri Redis sorted set'te tutulur — kaybolsa PostgreSQL'den yeniden inşa edilebilir |

> **Neden genel olarak ilişkisel (SQL)?** Case'in tüm alt alanları (kullanıcı/rol, arıza/durum, tahmin/log, puan/rozet) sabit şemalı, ilişkisel bütünlük gerektiren, ACID garantisi önemli olan verilerdir. Şema esnekliği gerektiren gerçek bir kullanım senaryosu yok. NoSQL yalnızca **türetilmiş, kaybı tolere edilebilir, çok hızlı okunması gereken** veri için (Redis: leaderboard, cache) kullanılmıştır — bu da case'in kendi örneğiyle uyumludur ("Gamification için Redis+PostgreSQL").

### 5.1 Identity DB — Şema Özeti

```
users(id, role, email?, gsm?, password_hash?, name, surname, expertise[], region[],
      status, failed_login_count, locked_until, created_at)
refresh_tokens(id, user_id→users, token_hash, family_id, used_at, revoked_at, expires_at)
audit_logs(id, user_id, action_type, timestamp, ip, result, detail jsonb, resource_id)
otp_codes(id, gsm, code, expires_at, verified_at)
```

### 5.2 Incident DB — Şema Özeti

```
incidents(id, incident_no, station_code, location(lat,lng), fault_type, priority, status,
          customer_id, assigned_team_id?, ai_probability, sla_deadline, created_at, resolved_at, closed_at)
incident_status_history(id, incident_id→incidents, from_status, to_status, changed_by, changed_at, reason)
incident_messages(id, incident_id→incidents, sender_id, content, created_at)
incident_resolutions(id, incident_id→incidents, resolution_note, rated_by, rating, is_permanent, rated_at)
telemetry_readings(id, station_code, signal_strength, packet_loss, temperature, power_status,
                   historical_fault_count, received_at, incident_id?→incidents)
```

### 5.3 AI DB — Şema Özeti

```
predictions(id, telemetry_id, station_code, probability, predicted_fault_type, recommendation,
            model_version, created_at)
misclassifications(id, incident_id, original_type, corrected_type, corrected_by, corrected_at)
team_cache(team_id, expertise[], region, lat, lng, updated_at)
workload_cache(team_id, active_incident_count, updated_at)
model_registry(version, trained_at, metrics jsonb, artifact_path)
```

### 5.4 Gamification DB — Şema Özeti

```
-- PostgreSQL (durable)
points_ledger(id, user_id, incident_id?, points, reason, created_at)
badges_earned(id, user_id, badge_code, earned_at)
user_stats(user_id, total_points, level, resolved_count, updated_at)

-- Redis (türetilmiş)
leaderboard:daily:{date}   → ZSET(user_id, score)
leaderboard:weekly:{week}  → ZSET(user_id, score)
profile_cache:{user_id}    → HASH (kısa TTL)
```

---

## 6. API Tasarımı

**Standart response zarfı (tüm servislerde ortak):**

```json
// Başarılı
{ "success": true, "data": { }, "error": null }

// Hatalı
{ "success": false, "data": null, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

**Versiyonlama:** Tüm endpoint'ler `/api/v1/` altında. Swagger/OpenAPI, en az Incident ve AI servisleri için zorunlu (case gereksinimi), pratikte tüm servislerde uygulanacak (NestJS/FastAPI'de otomatik üretim maliyeti düşük).

### 6.1 Ana Endpoint Listesi (tasarım iskeleti — detay kod aşamasında Swagger'da netleşir)

**Identity Service**
| Method | Endpoint | Rol | Açıklama |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Müşteri kaydı (GSM) |
| POST | `/api/v1/auth/otp/verify` | Public | OTP doğrulama |
| POST | `/api/v1/auth/login` | Public | Personel/Süpervizör/Admin girişi |
| POST | `/api/v1/auth/refresh` | Authenticated | Token yenileme (rotation) |
| POST | `/api/v1/auth/logout` | Authenticated | Refresh token iptali |
| GET | `/api/v1/auth/me` | Authenticated | Oturum sahibi bilgisi |
| POST | `/api/v1/admin/personnel` | Admin | Personel hesabı oluşturma |
| PATCH | `/api/v1/admin/personnel/:id/role` | Admin | Rol değişikliği |
| GET | `/api/v1/admin/audit-logs` | Admin | Audit log görüntüleme |
| GET | `/internal/teams` | Internal | AI Service tüketir (saha ekibi profil listesi) |

**Incident Service**
| Method | Endpoint | Rol | Açıklama |
|---|---|---|---|
| POST | `/api/v1/telemetry` | Müşteri | Telemetri/arıza girişi → AI'a sync çağrı |
| GET | `/api/v1/incidents` | Rol bazlı filtreli | Vaka listesi |
| GET | `/api/v1/incidents/:id` | Sahiplik kontrollü | Vaka detayı |
| PATCH | `/api/v1/incidents/:id/status` | Personel/Süpervizör | Durum geçişi (state machine) |
| PATCH | `/api/v1/incidents/:id/assign` | Süpervizör | Manuel atama |
| PATCH | `/api/v1/incidents/:id/classification` | Personel/Süpervizör | Tür/öncelik override (AI doğruluk takibine düşer) |
| POST | `/api/v1/incidents/:id/messages` | Saha Tek./NOC | Mesaj gönder |
| GET | `/api/v1/incidents/:id/messages` | Saha Tek./NOC | Thread getir |
| POST | `/api/v1/incidents/:id/resolution` | Saha Tek. / NOC | Çözüm notu + değerlendirme |
| GET | `/api/v1/dashboard/summary` | Süpervizör/Admin | Dashboard agregasyonu |
| GET | `/internal/teams/workload` | Internal | AI Service tüketir |

**AI Service**
| Method | Endpoint | Rol | Açıklama |
|---|---|---|---|
| POST | `/api/v1/ai/predict` | Internal (Incident→AI) | Olasılık + tür + atama önerisi |
| GET | `/api/v1/ai/accuracy` | Süpervizör/Admin | Genel doğruluk oranı |
| GET | `/api/v1/ai/accuracy/by-category` | Süpervizör/Admin | *(bonus)* Kategori bazlı kırılım |

**Gamification Service**
| Method | Endpoint | Rol | Açıklama |
|---|---|---|---|
| GET | `/api/v1/game/leaderboard?period=daily\|weekly` | Authenticated | Liderlik tablosu |
| GET | `/api/v1/game/profile/:userId` | Authenticated (sahiplik) | Profil verisi |
| GET | `/api/v1/game/badges` | Authenticated | Rozet kataloğu |

---

## 7. Servisler Arası İletişim ve Event Mimarisi

**İlke:** Anlık yanıt gerektiren tek akış — Incident → AI `/predict` çağrısı — **senkron REST**'tir (vaka açma kararı için hemen cevap gerekir). Bunun dışındaki tüm servisler arası etkileşim **RabbitMQ üzerinden asenkron event** ile yapılır. Bu, hem case'in "Gamification event ile tetiklenir" zorunluluğunu hem de bağımsızlık ilkesini (durable queue → alıcı servis kapalıyken olay kaybolmaz) karşılar.

**Exchange:** `netopscell.events` (topic exchange) · **Kuyruk dayanıklılığı:** durable queue + manual ack + dead-letter queue (poison message koruması)

### 7.1 Event Kataloğu

| Event | Yayıncı | Dinleyici(ler) | Amaç |
|---|---|---|---|
| `incident.created` | Incident | — (audit/log) | Vaka oluşturma kaydı |
| `incident.status.changed` | Incident | AI (workload_cache) | Aktif vaka sayısı güncel tutulur |
| `incident.assigned` | Incident | — *(bonus: WebSocket bildirimi)* | Atama bildirimi |
| `incident.type.changed` | Incident | AI (misclassifications) | Doğruluk metriği için override kaydı |
| `incident.resolved` | Incident | Gamification | Puan hesabı (+10, hızlıysa +5, KRİTİK-SLA-içi +15) |
| `incident.resolution.rated` | Incident | Gamification | Kalıcı çözüm +10 / tekrar eden arıza -3 |
| `incident.sla.exceeded` | Incident | Gamification | SLA aşım cezası (-5) |
| `incident.parts.supplied` | Incident | — (audit) | PARCA_BEKLENIYOR → MUDAHALE_EDILIYOR bilgilendirmesi |
| `incident.predicted` | AI | — (audit) | Tahmin geçmişi |
| `team.profile.updated` | Identity | AI (team_cache) | Uzmanlık/bölge güncellemesi |
| `badge.earned` | Gamification | *(bonus: WebSocket → Frontend toast)* | Rozet bildirimi |
| `audit.log` | Tüm servisler | Identity (merkezi toplama) | Denetim kaydı |

### 7.2 Örnek Payload — `incident.resolved`

```json
{
  "event_type": "incident.resolved",
  "timestamp": "2026-07-22T09:41:03Z",
  "payload": {
    "incident_id": "INC-2026-000123",
    "team_id": "a7f3...",
    "fault_type": "ISINMA",
    "priority": "KRITIK",
    "created_at": "2026-07-22T08:50:11Z",
    "resolved_at": "2026-07-22T09:41:03Z"
  }
}
```

Tüm event'ler ve payload şemaları geliştirme sırasında `EVENTS.md` dosyasında ayrıntılı olarak dokümante edilecektir (case'in zorunlu teslimat kalemi).

---

## 8. Kimlik Doğrulama ve Yetkilendirme

- **JWT RS256**: Identity Service private key ile imzalar; Gateway ve tüm servisler sadece public key (JWKS endpoint) ile doğrular. Secret hiçbir yerde paylaşılmaz — servisler arası izolasyon güçlenir.
- **Access token:** 15 dk, payload `{user_id, role, expertise[], region[]}`
- **Refresh token:** 7 gün, DB'de saklanır, kullanıldığında rotate edilir (eski geçersiz kılınır); geçersiz kılınmış token tekrar kullanılırsa **o kullanıcının tüm oturumları** sonlandırılır (token theft koruması)
- **Şifre politikası:** min 8 karakter, 1 büyük harf, 1 rakam, 1 özel karakter; ihlalde net hata mesajı
- **Hash:** argon2id (bcrypt kabul edilebilir alternatif; düz metin/MD5/SHA1 yasak)
- **Hesap kilitleme:** 5 başarısız giriş → 15 dk kilit, kalan süre response'da döner
- **Rol/yetki matrisi:** Case bölüm 3.3'teki tablo birebir endpoint guard'ları olarak uygulanır; ihlal → `403` + audit log
- **IDOR koruması:** Rol kontrolü yeterli değildir — her servis katmanında kaynak sahiplik kontrolü yapılır (örn. müşteri sadece `resource.customer_id === token.user_id` olan kaydı görebilir)
- **Audit log alanları:** `user_id`, `action_type`, `timestamp`, `ip`, `result`, `detail(resource_id)` — kayıt gereken olaylar: giriş denemeleri, hesap kilitlenmesi, rol değişiklikleri, 403 denemeleri, arıza silme/kritik durum değişiklikleri

---

## 9. AI/ML Bileşeni

Bu bölüm case'in kalbi olan AI Service'in veri, model ve inference sürecini uçtan uca tanımlar.

### 9.1 Sentetik Veri Seti

**Ne zaman üretilir:** Geliştirmenin **en erken adımlarından biri** (Faz 1 başlangıcı) — AI Service'in eğitimi bu veriye bağımlı olduğundan kritik yoldadır. Üretim script'i deterministik bir `random_seed` ile çalışır (tekrarlanabilirlik, jüri sorularına karşı savunulabilirlik).

**Ham özellikler (telemetri girdisi):**

```
signal_strength   : dBm            (tipik aralık: -110 .. -50)
packet_loss       : %              (0 .. 100)
temperature       : °C             (ortam + donanım sıcaklığı, tipik: 15 .. 95)
power_status      : NORMAL | UNSTABLE | OUTAGE
historical_fault_count : int       (son 30 gün, aynı istasyon)
```

**Türetilmiş özellikler (feature engineering — modelin ayırt edicilik gücünü artırır):**

| Türetilmiş özellik | Hesaplama | Hangi arıza türünü ayırt eder |
|---|---|---|
| `temperature_trend` | son N okumanın eğimi (°C/dk) | ISINMA (yavaş yükselen donanımdan, ani sıçrayan güç kesintisinden ayrılır) |
| `signal_delta` | `signal_strength` son okuma − ortalama | BAGLANTI |
| `packet_loss_ma` | hareketli ortalama (son 3 okuma) | BAGLANTI vs. geçici gürültü |
| `is_power_unstable` | `power_status != NORMAL` (binary) | GUC_KESINTISI |
| `fault_recency_score` | `historical_fault_count` üzerinden üstel ağırlıklı skor | tekrarlayan DONANIM/YAZILIM arızaları |

**Sınıf başına üretim mantığı (parametrik dağılımlar, her sınıf için ayrı bir üretici fonksiyon):**

| Sınıf | Karakteristik patern | Örnek üretim mantığı |
|---|---|---|
| `NORMAL` | Tüm metrikler stabil aralıkta | `signal ~ N(-70,5)`, `packet_loss ~ N(1,0.5)`, `temp ~ N(35,4)`, `power=NORMAL` |
| `ISINMA` | Sıcaklık kademeli/hızlı yükseliyor | `temp ~ N(75,8)` + pozitif trend enjekte edilir, sinyal hafif bozulur |
| `GUC_KESINTISI` | Güç durumu bozuk/kesik | `power ∈ {UNSTABLE, OUTAGE}`, sinyal ani düşer, sıcaklık normal kalabilir |
| `BAGLANTI` | Sinyal zayıf + paket kaybı yüksek | `signal ~ N(-100,6)`, `packet_loss ~ N(35,10)` |
| `YAZILIM` | Ara sıra kesinti, fiziksel metrik bozulması yok | düşük genlikli, düzensiz (non-monoton) osilasyon paterni, `historical_fault_count` yüksek |
| `DONANIM` | Birden fazla metrik aynı anda, kalıcı biçimde bozuk | sinyal + sıcaklık + paket kaybı birlikte eşik dışına çıkar |

- **Toplam minimum 200 örnek** (case'in önerdiği 100'ün üzerinde, güvenlik payı için), 6 sınıfa göre dengeli dağılım (~33 örnek/sınıf), her sınıf içinde ±%15 gürültü/varyasyon enjekte edilerek overfitting önlenir ve sınır (edge-case) durumlar temsil edilir
- Veri seti CSV olarak `ai-service/data/synthetic_telemetry.csv`, üretim script'i `ai-service/scripts/generate_dataset.py` olarak repoda paylaşılır; üretim mantığı AI yaklaşım dokümanında gerekçeleriyle anlatılır (bonus +8 koşulu)

### 9.2 Model Seçimi ve Görevler

| Görev | Yöntem | Girdi | Çıktı |
|---|---|---|---|
| Arıza olasılığı tahmini | Hibrit: eğitilmiş çok sınıflı model (`P(fault) = 1 - P(NORMAL)`) + eşik kuralları | Ham + türetilmiş özellik vektörü | `probability (0.0-1.0)` + öneri (İZLE / VAKA_AC / ACIL) |
| Arıza türü sınıflandırma | Aynı model, `argmax(P(sınıf))` | Aynı özellik vektörü | `DONANIM \| GUC_KESINTISI \| BAGLANTI \| YAZILIM \| ISINMA` |
| Akıllı saha ekibi ataması | Kural tabanlı skorlama (ML değil, deterministik formül) | Uzmanlık, mesafe, kapasite | En yüksek skorlu ekip |

**Model seçim metodolojisi (karşılaştırmalı, tesadüfi değil):** Üç aday algoritma 5-fold stratified cross-validation ile karşılaştırılır ve **macro-F1** skoruna göre (sınıflar dengeli olsa da yanlış negatifin — kaçırılan arıza — maliyeti yüksek olduğundan accuracy yerine macro-F1 esas alınır) en iyi performansı veren seçilir:

| Aday model | Neden değerlendirildi |
|---|---|
| `LogisticRegression` (baseline) | Basit, yorumlanabilir referans skor |
| `RandomForestClassifier` | Gürültüye dayanıklı, düşük veri hacminde overfit riski düşük |
| `GradientBoostingClassifier` | Sınıflar arası ince ayrımlarda (örn. YAZILIM vs. DONANIM) genelde daha yüksek F1 |

Seçilen model `scikit-learn Pipeline` içinde ön işleme adımlarıyla (sürekli değişkenler için `StandardScaler`, `power_status` için `OneHotEncoder`) birlikte tek bir nesne olarak serileştirilir — böylece eğitim ve inference arasında özellik dönüşüm tutarsızlığı riski ortadan kalkar.

**Açıklanabilirlik (explainability):** Eğitim sonrası `feature_importances_` (veya permütasyon önemi) çıkarılıp AI yaklaşım dokümanında paylaşılır. Bu hem Süpervizör dashboard'daki "AI doğruluk metriği" anlatısını güçlendirir hem de jüri Q&A'sında "modeliniz kararını neye dayandırıyor?" sorusuna somut, savunulabilir bir cevap sağlar (örn. beklenti: `temperature_trend`, ISINMA sınıfı için en belirleyici özellik olarak öne çıkar).

**Kural katmanı (model üzerine sarılır):**
- Eşik yönlendirme: `< 0.40` → İZLE, `0.40-0.85` → VAKA_AC (NOC onayına düşer), `≥ 0.85` → ACIL (otomatik vaka)
- Güvenlik ağı kuralları: örn. `power_status=OUTAGE` her koşulda `GUC_KESINTISI` + `probability ≥ 0.9` garantisi — hem "kural+ML hibrit" onaylı yaklaşımlardan biri hem de canlı demoda modelin beklenmedik tahmin verme riskine karşı güvence

**Atama skoru:**
```
skor = (uzmanlik_eslesme × 0.4) + (mesafe_yakinlik × 0.3) + (bosluk_orani × 0.3)
```
- `uzmanlik_eslesme`: ekip uzmanlığı arıza türüyle eşleşiyorsa 1, değilse 0
- `mesafe_yakinlik`: Haversine formülü ile ekip bölgesi–arıza konumu yakınlığı
- `bosluk_orani`: `1 - (aktif_vaka / 5)` (ekip başına maksimum kapasite 5)
- Ağırlıklar env variable ile konfigüre edilebilir

### 9.3 Eğitim, Doğrulama ve Inference Süreci

**Eğitim:**
1. Sentetik veri seti %80/%20 stratified train/test split (sınıf oranı korunur)
2. 5-fold stratified cross-validation ile 3 aday model karşılaştırılır (`ai-service/scripts/train_model.py`)
3. En iyi macro-F1'e sahip model + preprocessing pipeline birlikte seçilir
4. Test seti üzerinde nihai metrikler üretilir: accuracy, sınıf başına precision/recall/F1, confusion matrix, feature importance sıralaması → hepsi AI yaklaşım dokümanına **gerçek sayılarla** işlenir (eğitim tamamlandıktan sonra doldurulacak, önceden tahmini rakam paylaşılmaz)
5. Model `joblib` ile serialize edilir → `ai-service/models/model_v{n}.joblib`, versiyon + metrikler `model_registry` tablosuna kaydedilir

**Inference (`POST /api/v1/ai/predict`):**
1. FastAPI başlangıçta (`startup` event) modeli ve preprocessing pipeline'ı belleğe yükler — her istekte diskten okuma yapılmaz (performans)
2. Gelen telemetri + son N okuma (varsa) türetilmiş özelliklere dönüştürülür
3. Model tahmini (`predict_proba`) + kural katmanı son işlemesi uygulanır
4. Sonuç `predictions` tablosuna `model_version` ile loglanır, response döner (hedef gecikme: <200ms — canlı demoda akıcı görünüm için)

**Doğrulama (runtime, üretim sonrası):**
- NOC/Süpervizör tarafından yapılan tür/kategori override'ları `misclassifications` tablosuna düşer
- Runtime doğruluk oranı: `(toplam_tahmin - misclassification) / toplam_tahmin × 100` — Süpervizör dashboard'da gösterilir
- Kategori bazlı kırılım (bonus +3): her `fault_type` için ayrı doğruluk oranı — hangi arıza türünde modelin daha çok yanıldığı görünür kılınır
- Not: Bu case kapsamında otomatik yeniden eğitim (retraining) yoktur; toplanan override verisi gelecekte model iyileştirmesi için bir temel oluşturur (üretim yol haritası notu)

---

## 10. Güvenlik Mimarisi

Case, jürinin canlı sızma testi yapacağını açıkça belirtiyor. Aşağıdaki tablo her senaryoya karşı somut savunmayı eşler:

| Jüri Test Senaryosu | Savunma |
|---|---|
| SQL injection (`' OR 1=1 --`) | ORM/parametreli sorgular (TypeORM, SQLAlchemy) — hiçbir yerde raw string concatenation SQL yok; class-validator/Pydantic ile input validasyonu |
| Yetkisiz endpoint erişimi (müşteri token'ıyla süpervizör endpoint'i) | Gateway + servis seviyesinde rol guard; ihlal → `403` + audit log |
| IDOR (kayıt ID değiştirerek başkasının verisi) | Servis katmanında kaynak sahiplik kontrolü — rol kontrolü tek başına yeterli sayılmaz |
| JWT manipülasyonu (süresi dolmuş/değiştirilmiş token) | RS256 imza doğrulama (public key), `exp` kontrolü, algoritma whitelisting (`alg:none` saldırısı engellenir) |
| Geçersiz kılınmış refresh token'ın yeniden kullanımı | Token ailesi (family) takibi + reuse detection → tüm oturumlar iptal edilir |
| XSS (metin alanına script enjeksiyonu) | React otomatik escape + backend input sanitization/uzunluk sınırı + Gateway'de CSP header |
| Brute-force (ardışık hızlı giriş denemeleri) | İki katman: Gateway rate-limit (IP bazlı) + Identity Service hesap kilitleme (5 deneme/15dk) |

---

## 11. Ölçeklenebilirlik, Performans ve Dayanıklılık

**Hackathon kapsamında (Docker Compose):**
- Tüm servisler **stateless** — JWT bearer token ile oturum durumu server'da tutulmaz, yatay ölçeklenebilirliğin önkoşulu
- Incident → AI senkron çağrısında **2 saniyelik timeout + fallback** (BELIRSIZ/ORTA) — basit circuit-breaker deseni
- RabbitMQ: durable queue + manual ack + dead-letter queue (poison message koruması, retry limiti aşılan mesajlar DLQ'ya düşer)
- Her serviste `/health` endpoint + Docker healthcheck — hem Compose orkestrasyonu hem canlı demo için servis durumunun gözlemlenebilirliği

**Üretim olgunluk yol haritası (bu case'in kapsamı DIŞINDA — sadece mimari vizyon notu):**
- Kubernetes'e geçiş: Deployment + HorizontalPodAutoscaler + Ingress + ConfigMap/Secret yönetimi
- PostgreSQL read replica'ları, Redis Cluster, RabbitMQ quorum queue (yüksek erişilebilirlik)
- Gözlemlenebilirlik: yapılandırılmış JSON log + correlation-id (şimdiden var) → Prometheus/Grafana + OpenTelemetry distributed tracing

> Not: Demo senaryosu `docker compose up` ve tekil `docker stop` üzerine kurulu olduğundan, K8s bu teslimatta **kullanılmayacaktır** — bahsi geçen üretim yol haritası yalnızca mimari olgunluğu göstermek amacıyla dokümante edilmiştir.

---

## 12. Deployment, Docker Compose ve CI/CD

**Kök `docker-compose.yml` servisleri:**

```
gateway
identity-service      + identity-db (postgres)
incident-service      + incident-db (postgres)
ai-service            + ai-db (postgres)
gamification-service  + gamification-db (postgres) + gamification-cache (redis)
rabbitmq
frontend (nginx, React build)
```

- Her serviste ayrı `Dockerfile` + `.env.example`
- Tek bridge network (`netopscell-net`) üzerinden servis keşfi (Docker Compose DNS)
- Seed script: demo kullanıcıları otomatik oluşturur (1 admin, 1 süpervizör, 1 NOC operatörü, 2-3 farklı uzmanlıkta saha teknisyeni, 1 müşteri)
- Health check'ler ile servislerin hazır olma sırası yönetilir (`depends_on: condition: service_healthy`)

**CI/CD (bonus, zaman kalırsa — +2):** GitHub Actions ile her PR'da lint + unit test + Docker image build.

---

## 13. UI/UX ve Frontend Mimarisi

**Stack:** React + TypeScript (Vite), TailwindCSS.

**Marka paleti (Turkcell kurumsal kimliği):** Lacivert `#001E62` (kurumsal, header/nav), Turkcell Sarısı `#FFED00` (CTA/vurgu), destekleyici gri tonları. Semantik durum renkleri: KRİTİK `#E4002B` (kırmızı), YÜKSEK `#FF6900` (turuncu), ORTA sarı/amber, DÜŞÜK gri-yeşil.

**Rol bazlı ekran haritası:**

| Rol | Ekranlar |
|---|---|
| Müşteri | Kayıt/OTP giriş, arıza/telemetri oluşturma formu, kendi arızalarını görüntüleme |
| Saha Teknisyeni | Atanan arızalar listesi, arıza detayı (konum + AI türü + mesaj thread), durum güncelleme, çözüm notu formu, profil (puan/rozet/seviye/liderlik) |
| NOC Operatörü | Tahmin onay ekranı (ORTA güven aralığı), arıza listesi/detay, saha ekibine yönlendirme, mesajlaşma, çözüm değerlendirme |
| Süpervizör | Dashboard (6 zorunlu bileşen), tüm arızalar, manuel atama, kategori/öncelik override |
| Admin | Personel hesabı oluşturma/rol yönetimi, audit log görüntüleme |

**Zorunlu kalite noktaları (rubric UI/UX 10 puan):** her ana ekranda loading / error / empty state; responsive tasarım; rozet kazanıldığında toast/modal bildirim; liderlik tablosu gerçek zamanlı veya sayfa yenilemede güncel.

---

## 14. Servis Bağımlılık Matrisi

| Servis | Senkron bağımlılık | Asenkron (event) bağımlılık | Bağımlı olduğu servis çökerse |
|---|---|---|---|
| API Gateway | Identity (JWT public key, cache'lenir) | — | Public key cache'te olduğu sürece kısa kesintiden etkilenmez |
| Incident | AI (`/predict`, 2sn timeout) | — | AI çökerse: vaka `BELIRSIZ/ORTA` ile yine oluşturulur, manuel kuyruğa düşer |
| AI | — | `team.profile.updated` (Identity), `incident.status.changed` / `incident.type.changed` (Incident) | Identity/Incident çökerse: `team_cache`/`workload_cache`'teki son bilinen veriyle atama yapmaya devam eder |
| Gamification | — | `incident.resolved`, `incident.resolution.rated`, `incident.sla.exceeded` (Incident) | Incident çökerse: zaten kuyruklanmış event'ler işlenmeye devam eder; sadece yeni olay üretimi durur, servis ayakta kalır |

Bu tablo, canlı demoda "bir servisi kapat, sistemin geri kalanının çalıştığını kanıtla" adımının hangi servis için ne göstereceğini netleştirir — örneğin **AI Service kapatılarak** Incident'in fallback davranışı, **Identity Service kapatılarak** AI'ın cache ile atamaya devam edebildiği gösterilebilir.

---

## 15. Aşamalı Geliştirme Yol Haritası

**Varsayılan bütçe:** ~24-30 saat, 3 kişilik ekip. Kritik yol: **AI Service ve Incident Service en erken başlamalı** çünkü Gamification ve Dashboard bunlara bağımlıdır.

**Önerilen rol dağılımı:**
- **Geliştirici A:** Identity Service + API Gateway + Frontend (auth/admin ekranları)
- **Geliştirici B:** Incident Service + Frontend (saha teknisyeni/NOC ekranları + Süpervizör dashboard)
- **Geliştirici C:** AI Service (sentetik veri + model + skorlama) + Gamification Service + Frontend (gamification ekranları)

### Faz 0 — Kurulum (0-2. saat)
- Monorepo iskeleti (servis klasörleri), kök `docker-compose.yml` taslağı
- PostgreSQL×4, Redis, RabbitMQ container'larının ayağa kalkması
- Her serviste boş `/health` endpoint'li iskelet (NestJS×3, FastAPI×1)
- Gateway routing iskeleti, `.env.example` şablonları
- Bu doküman + kısa OpenAPI taslağının ekip içi paylaşımı

### Faz 1 — Çekirdek Domain (2-10. saat)
- **Identity:** kayıt/login/JWT/rol matrisi/audit log temel akışı
- **Incident:** state machine + CRUD + SLA alanları (event yayını henüz yok)
- **AI:** sentetik veri üretimi → model eğitimi → `/predict` endpoint (kural+ML)
- **Gamification:** puan/rozet mantığı (henüz event dinlemeden, saf fonksiyon olarak test edilir)

### Faz 2 — Entegrasyon ve Event Akışı (10-18. saat)
- RabbitMQ topolojisi kurulur, tüm event'ler bağlanır (`incident.resolved`→Gamification, cache senkron event'leri→AI)
- Gateway'de JWT doğrulama + rate limiting devreye alınır
- Frontend ekranları gerçek API'lara bağlanır
- Süpervizör dashboard verileri uçtan uca akar

### Faz 3 — Güvenlik Sertleştirme ve Dayanıklılık (18-24. saat)
- Bölüm 10'daki pentest tablosu tek tek doğrulanır
- Circuit-breaker/fallback senaryosu test edilir (AI Service durdurulup Incident'in BELIRSIZ üretmesi kontrol edilir)
- Docker Compose'da tam ayağa kalkma + servis durdurma testi (demo provası)

### Faz 4 — Cilalama ve Demo Provası (24-30. saat)
- UI/UX detayları (loading/error/empty state, marka paleti tutarlılığı)
- README'ler, `EVENTS.md`, Swagger/OpenAPI, AI yaklaşım dokümanı tamamlanır
- Zaman kalırsa bonus: WebSocket bildirimleri, CI/CD, kategori bazlı doğruluk paneli
- Case bölüm 11.3'teki zorunlu demo senaryosu eksiksiz en az iki kez prova edilir

---

## 16. Test Stratejisi ve Dokümantasyon Teslimatları

**Test:**
- Unit test: state machine geçiş kuralları, JWT/token rotation mantığı, skorlama formülü, puan/rozet hesaplama kuralları
- Integration test: en az Incident ve AI servisleri arası `/predict` akışı (başarılı + fallback senaryosu)
- Güvenlik doğrulama: Bölüm 10 tablosundaki her senaryo için manuel/otomatik test

**Dokümantasyon (case zorunlu teslimat kalemleri):**
- Ana `README.md`: sistem genel bakışı, mimari diyagram, kurulum (`docker compose up` + seed), demo kullanıcı bilgileri
- Servis başına `README.md`: sorumluluk, endpoint listesi, environment değişkenleri
- `EVENTS.md`: tüm event'ler ve payload şemaları
- AI yaklaşım dokümanı: yöntem seçimi, gerekçe, eğitim verisi ve süreci
- Swagger/OpenAPI: en az Incident ve AI servisleri (pratikte tüm servisler)

---

## 17. Değerlendirme Kriterleri Eşlemesi

| Rubric Kategorisi | Puan | Bu Dokümanda Karşılığı |
|---|---|---|
| Mimari ve Kod Kalitesi | 25 | Bölüm 2, 3, 4, 5, 7, 14 (bağımsızlık, database-per-service, event tasarımı, gateway kurgusu) |
| Fonksiyonellik | 25 | Bölüm 4, 9 (4 servisin zorunlu özellikleri, AI görevleri, state machine, gamification kuralları) |
| Güvenlik | 15 | Bölüm 8, 10 (token rotation, rol/yetki matrisi, audit log, rate limiting) |
| UI/UX Kalitesi | 10 | Bölüm 13 |
| Test ve Dokümantasyon | 10 | Bölüm 16 |
| Sunum ve Canlı Demo | 15 | Bölüm 15 (Faz 3-4 demo provası) + Bölüm 14 (servis kapatma kanıtı) |
| **Bonus (+20)** | — | Kendi eğitilmiş model (Bölüm 9, +8) · RabbitMQ (Bölüm 7, +5) · Kategori bazlı AI doğruluk (Bölüm 9.3, +3) · WebSocket (Faz 4, +2) · CI/CD (Bölüm 12, +2) |

---

## 18. Varsayımlar ve Açık Kararlar

Aşağıdaki noktalar case dokümanında net olmayan veya serbest bırakılan alanlardır; bu doküman için yapılan yorum/karar belirtilmiştir. Ekip onayı sonrası revize edilebilir.

1. **"Arıza oluşturma" yetkisi:** Case'in yetki matrisi (bölüm 3.3) bu işlemi sadece `Müşteri` rolüne açık gösteriyor. Bu doküman bunu literal olarak uygulamıştır — telemetri/arıza girişi, demo için seed'lenmiş bir müşteri hesabı üzerinden yapılan bir "simülatör" akışı olarak tasarlanmıştır.
2. **API Gateway teknolojisi:** Kong/Ocelot gibi hazır bir gateway yerine özel yazılmış Express tabanlı reverse proxy tercih edilmiştir (JWT/rate-limit üzerinde tam kontrol + ekip zaten Node/TS biliyor).
3. **Süpervizör Dashboard verisi:** Ayrı bir "Reporting/BFF" servisi kurulmamıştır; veriler Incident Service (`/api/v1/dashboard/summary`) ve AI Service (`/api/v1/ai/accuracy`) üzerinden ayrı ayrı çekilir. Case zaten 4 servisle sınırlı; 5. bir servis gereksiz karmaşıklık olur.
4. **Repo stratejisi:** Monorepo, servis başına klasör (case her iki seçeneği de kabul ediyor).
5. **OTP teslimatı:** Case simülasyon (sabit kod `1234`) yeterli görüyor; bu proje bunun ötesine geçip **gerçek Telegram Bot API teslimatını** uyguladı (Faz 8) — kod hiçbir koşulda API yanıtında/UI'da dönmez, gerçekten müşterinin bağladığı Telegram sohbetine gönderilir. Bot token tanımlı değilse (yerel geliştirme) sabit kodlu simülasyona zarifçe düşülür, ama o modda dahi kod yanıtta dönmez — yalnızca sunucu logunda görünür. Detay: kök README "Telegram OTP Kurulumu", `services/identity-service/src/auth/telegram.service.ts`.

---

## 19. Faz 3 — Secret ve Anahtar Yönetimi

Faz 1-2'de servisler `.env` dosyalarında düz metin şifre kullanıyordu. Faz 3'te bu, Docker Compose'un native `secrets:` mekanizmasına taşındı.

**Mekanizma:**
- `scripts/generate-secrets.sh`, tüm sırları (4× DB şifresi, Mongo şifresi, RabbitMQ şifresi, dahili API anahtarı, JWT RS256 anahtar çifti, Grafana admin şifresi) `secrets/` dizininde dosya olarak üretir. Bu dizin `.gitignore` ile repoya asla dahil edilmez.
- `docker-compose.yml`'daki her secret, ilgili container'a `/run/secrets/<isim>` olarak salt-okunur mount edilir.
- Her serviste ortak bir `readSecret(envVarBase, fallback)` yardımcı fonksiyonu (`src/common/secrets.ts` / Python `app/secrets_util.py`), `${VAR}_FILE` konvansiyonunu okuyup dosya yoksa doğrudan env değişkenine, o da yoksa (yalnızca yerel geliştirme için) fallback değerine düşer.
- JWT: yalnızca Identity Service private key'e erişir (`jwt_private_key.pem`); diğer tüm servisler ve Gateway yalnızca public key'i (`jwt_public_key.pem`) görür ve imzayı doğrular — asimetrik RS256 sayesinde token üretme yetkisi tek bir serviste toplanır.
- **Dosya izinleri hakkında önemli not:** Docker Compose (Swarm dışı, tek-host modu) secret'ları basit bir bind-mount olarak uygular ve HOST dosya izinlerini/sahipliğini olduğu gibi container'a taşır — Swarm'daki gibi kendi `tmpfs`/`0400` katmanını eklemez. Bu nedenle secret dosyaları `600` yerine `644` ile üretilir: container'ın çalışma zamanı kullanıcısı (örn. `mongodb`, `grafana`, `node`) host'taki dosya sahibiyle aynı UID olmayabileceği için `600` bazı container'larda "Permission denied" hatasına yol açar. Dosyalar yalnızca bu host'ta, repo dışında tutulduğu için `644` kabul edilebilir bir tolerans olarak değerlendirilmiştir.
- **RabbitMQ istisnası:** Resmi `rabbitmq:3.13` imajı `RABBITMQ_DEFAULT_PASS_FILE` değişkenini artık desteklemiyor (deprecated + fatal hata). Bunun için `infra/rabbitmq/` altında özel bir Dockerfile + `entrypoint.sh` yazıldı: sarmalayıcı, secret dosyasını okuyup `RABBITMQ_DEFAULT_PASS` olarak export eder, `_FILE` değişkenini `unset` eder (aksi halde resmi entrypoint deprecated kontrolünü yine de tetikler) ve ardından gerçek `docker-entrypoint.sh`'ı çalıştırır.
- **Gerçek üretimde** bu adım; HashiCorp Vault, AWS Secrets Manager/KMS veya bulut sağlayıcısının kendi secret servisi tarafından devralınır — `generate-secrets.sh` yalnızca Docker Compose tabanlı yerel/değerlendirme ortamı için bir kolaylıktır (bkz. Bölüm 22).

---

## 20. Faz 3 — Mesajlaşma Mimarisi (MongoDB)

İlk tasarımda saha/NOC mesajlaşması PostgreSQL'de ilişkisel bir `incident_message` tablosuydu. Faz 3'te, case'in "yüksek hacimli, ölçeklenebilir, düşük gecikmeli, doğru veri modeliyle" mesajlaşma talebi doğrultusunda MongoDB tabanlı bir alt sisteme taşındı.

**Neden MongoDB:** Mesaj verisi yüksek hacimli, ekleme-ağırlıklı (append-heavy), esnek şemalı (okunma bilgisi gibi alanlar zamanla genişleyebilir) ve neredeyse hiç güncellenmeyen (immutable) bir yapıya sahip — ilişkisel bütünlük kısıtlaması gerektirmeyen bu profil, doküman veritabanı için klasik bir kullanım örneğidir. Vaka/SLA/durum gibi güçlü tutarlılık gerektiren ilişkisel veri PostgreSQL'de kalmaya devam eder; **database-per-service** ilkesi ihlal edilmez — Incident Service kendi sınırları içinde ikinci bir veri deposu kullanır, başka bir servis Mongo'ya doğrudan erişmez.

**Veri modeli** (`messages` koleksiyonu):
```
{
  _id,
  incidentId,       // Postgres'teki vaka ID'sine referans (uygulama seviyesinde)
  senderId, senderRole,
  content, messageType,      // TEXT | (ileride SISTEM/DOSYA gibi türlere genişleyebilir)
  status,             // SENT | DELIVERED | READ
  readBy: [{ userId, readAt }],   // çoklu okuyucu desteği (grup thread'i)
  createdAt
}
```
- İndeks: `{ incidentId: 1, createdAt: 1 }` — bir vakanın mesaj geçmişini kronolojik sırayla getirmek en sık sorgu deseni.
- Okunma bilgisi (`readBy`), tekil "okundu/okunmadı" bayrağı yerine kullanıcı bazlı bir dizi olarak modellendi çünkü bir thread'de birden fazla rol (NOC + teknisyen + süpervizör) bulunabilir.

**Anti-spam / hız sınırlama:** `MessagingService.assertNotSpamming`, kullanıcı+vaka başına kayan pencere (sliding window) ile dakikada 20 mesajla sınırlar (in-memory `Map`). Bu, tekil container için yeterlidir; yatay ölçeklendirilirse (birden fazla `incident-service` replikası) pencere durumu Redis'e taşınmalıdır — bu, Bölüm 22'de bilinçli bir kapsam dışı madde olarak not edilmiştir.

**Dayanıklılık/zaman aşımı bütçesi:** `MongoService`, `serverSelectionTimeoutMS: 2500` ile başlatılır. Bu değer, Gateway'in proxy timeout'undan (`proxyTimeout: 5000`) belirgin şekilde düşük tutulur; aksi halde Mongo erişilemez olduğunda Gateway, incident-service kendi hatasını üretip temiz bir JSON gövdesi dönmeden önce bağlantıyı keser ve istemciye tutarsız/boş bir yanıt ulaşır (bu tam olarak Faz 3 doğrulamasında gözlemlenip düzeltilen bir bug'dı — bkz. Bölüm 21.3).

---

## 21. Faz 3 — Doğrulama Sonuçları (Uçtan Uca Test ve Hata Enjeksiyonu)

Faz 3 sertleştirmesi tamamlandıktan sonra, sistem `docker compose down -v && docker compose build && docker compose up -d` ile sıfırdan ayağa kaldırılmış ve gerçek API çağrılarıyla uçtan uca doğrulanmıştır. Bu süreçte üç konfigürasyon hatası ve iki gerçek uygulama hatası tespit edilip düzeltilmiştir.

### 21.1 Başlangıç hataları (kullanıcı tarafından bildirilen, kök nedeni bulunup giderilen)

| Hata | Kök Neden | Çözüm |
|---|---|---|
| `RABBITMQ_DEFAULT_PASS_FILE is set but deprecated` (fatal, container çöküyor) | RabbitMQ 3.13 resmi imajı bu değişkeni artık reddediyor | Özel `infra/rabbitmq/` imajı + entrypoint wrapper (Bölüm 19) |
| Mongo/Grafana `Permission denied` (secret dosyası okunamıyor) | Compose (Swarm dışı) secret bind-mount'ları host dosya izinlerini birebir taşıyor; `600` farklı container UID'lerinde okunamıyor | `generate-secrets.sh` ve mevcut dosyalar `644`'e çekildi (Bölüm 19) |
| Postgres `password authentication failed` (identity_user/gamification_user) | Var olan named volume'lar eski (`changeme`) şifreyle initialize edilmişti; Postgres şifre env değişkenini yalnızca **ilk** `initdb`'de uygular | `docker compose down -v` ile volume'lar temizlendi, yeni secret'larla temiz kurulum yapıldı |

### 21.2 Doğrulama sırasında bulunan gerçek uygulama hataları

Bu ikisi, yukarıdaki altyapı hatalarından bağımsız, kodun kendisinde bulunan ve secrets/Docker geçişinden önce de var olan gerçek hatalardır:

1. **`identity-service/src/seed.ts` eski secret konvansiyonunu kullanıyordu.** `readSecret()` yerine doğrudan `process.env.DB_PASSWORD || "changeme"` okuyordu — secrets migration'ı sırasında atlanmış. Uygulamanın kendisi (`app.module.ts`) doğru şekilde `readSecret` kullandığı için ana servis sorunsuz ayağa kalkıyordu, ama demo verisini yükleyen seed script'i her zaman "changeme" ile bağlanmaya çalışıp başarısız oluyordu. **Düzeltildi:** `seed.ts` artık `readSecret("DB_PASSWORD", "changeme")` kullanıyor.
2. **Daha önce kayıtlı (ACTIVE) müşteriler bir daha asla giriş yapamıyordu.** `AuthService.register()`, GSM zaten `ACTIVE` bir kullanıcıya aitse `ConflictException` fırlatıyordu; ama dönen müşteri için OTP'yi yeniden isteyecek ayrı bir "login/resend" uç noktası yoktu — yani ilk kayıttan sonra o müşteri sistemden tamamen kilitli kalıyordu. Bu, gerçek kullanım senaryosunda ciddi bir üretim açığıdır. **Düzeltildi:** `register()` artık ACTIVE kullanıcılarda da (GSM zaten kimlik doğrulama faktörü olduğu için) yeni bir OTP üretip döner; `ConflictException`/import'u tamamen kaldırıldı.
3. **Gateway'de `http-proxy-middleware` v3 API uyumsuzluğu.** `onError`/`onProxyReq` gibi üst-seviye seçenekler kütüphanenin v3 sürümünde kaldırıldı ve sessizce yok sayılıyordu; sonuç olarak bir hedef servis erişilemez olduğunda istemciye standart `{success:false, error:{...}}` JSON zarfı yerine kütüphanenin ham `"Error occurred while trying to proxy: ..."` metni dönüyordu (frontend'in hata ayrıştırması bunu işleyemezdi). **Düzeltildi:** seçenekler doğru `on: { proxyReq, error }` nesnesine taşındı; ayrıca `res.headersSent` kontrolü eklendi.

### 21.3 Hata enjeksiyonu (fault-injection) test matrisi

Case'in "bir servisi durdur, sistemin geri kalanının çalıştığını kanıtla" kritik demo gereksinimi, Faz 3 sertleştirmesi sonrası (ağ mikro-segmentasyonu + salt-okunur dosya sistemleri altında) yeniden doğrulanmıştır:

| Durdurulan Servis | Gözlemlenen Davranış |
|---|---|
| **AI Service** (`docker stop`) | Telemetri girişi kesintisiz devam eder; vaka `faultType: BELIRSIZ`, `priority: ORTA`, `status: YENI` ile manuel kuyruğa düşer (`aiAvailable: false`). 3 art arda hatadan sonra circuit breaker **ACIK** duruma geçer (log: `Circuit breaker ACIK (predict)`), sonraki istekler AI'a hiç gitmeden anında fallback'e düşer. AI Service geri geldiğinde 10sn sonra breaker **YARI-ACIK** → başarılı deneme sonrası **KAPALI** durumuna otomatik döner — hiçbir manuel müdahale gerekmez. |
| **MongoDB (incident-mongo)** | PostgreSQL tabanlı tüm çekirdek akış (arıza listeleme, atama, çözüm, puanlama) tamamen etkilenmez. Mesajlaşma uç noktaları, `serverSelectionTimeoutMS: 2500` sayesinde ~2.5 saniyede temiz bir `500 INTERNAL_SERVER_ERROR` JSON'ı döner (Gateway'in 5sn proxy timeout'undan önce) — bkz. Bölüm 21.2 madde 3'ün düzeltilmesinden önce bu senaryo boş/tutarsız bir yanıtla sonuçlanıyordu. |
| **Gamification Service** | Çekirdek arıza akışı (telemetri → AI → atama → çözüm → puanlama tetikleme) tamamen etkilenmez. RabbitMQ'daki `gamification.incident-events` kuyruğu, servis kapalıyken üretilen `incident.resolved`/`incident.resolution.rated` olaylarını **durable** olarak biriktirir (consumer=0, mesaj sayısı >0); servis geri geldiğinde kuyruk otomatik boşalır ve puanlar hiçbir veri kaybı olmadan işlenir — bu, canlı ölçümle (25 → 50 puan) doğrulanmıştır. |
| **Identity Service** | Zaten verilmiş JWT access token'lar, imza Gateway/servislerde **lokal olarak public key ile** doğrulandığı için (Identity Service'e senkron çağrı yapılmadan) geçerliliğini korur — Identity çökerken bile mevcut oturumlar kesintisiz çalışmaya devam eder. Yalnızca *yeni* login/register/refresh istekleri (Identity'ye proxy edilmesi gerektiği için) `503 SERVICE_UNAVAILABLE` JSON'ı ile başarısız olur. |

Ek olarak: RabbitMQ yönetim API'si üzerinden `netopscell.events` topic exchange + 3 durable kuyruk (`ai-service.events`, `gamification.incident-events`, `identity.audit-log`) + DLQ (`netopscell.events.dlq`) yapılandırması ve her kuyrukta tam olarak beklenen sayıda aktif consumer doğrulanmıştır. Merkezi loglama zinciri (Promtail → Loki → Grafana) Grafana'nın datasource-proxy API'si üzerinden sorgulanarak, tüm 16 container'ın log akışının gerçek zamanlı olarak toplandığı ve event yayın/tüketim kayıtlarının (`event yayinlandi: incident.resolution.rated` vb.) sorgulanabilir olduğu kanıtlanmıştır.

---

## 22. Üretim Yol Haritası ve Bilinçli Kapsam Dışı Bırakılanlar

Faz 3 sertleştirmesi bu sistemi "hackathon demo"dan "üretime yakın, savunulabilir bir mimari"ye taşımıştır; ancak bazı üretim-seviyesi konular bilinçli olarak bu Docker Compose tabanlı teslimatın kapsamı dışında bırakılmıştır. Aşağıdaki liste, bunların **unutulduğu** değil, **zaman/araç kısıtı altında bilinçli bir kapsam kararı olduğu** açık olsun diye tutulmaktadır:

| Konu | Bu Teslimatta Durum | Üretimde Yapılması Gereken | Neden Şimdi Değil |
|---|---|---|---|
| Servisler arası mTLS | Servisler arası düz HTTP (izole Docker network segmentasyonu ile korunur) | Her servis çifti arası karşılıklı TLS (örn. Istio/Linkerd service mesh veya manuel sertifika rotasyonu) | Service mesh kurulumu, tek-host Docker Compose demosunun kapsamını aşan bir altyapı yatırımı; ağ mikro-segmentasyonu (Bölüm 3) bu ortamda yeterli izolasyonu sağlıyor |
| Orkestrasyon | Docker Compose (tek host) | Kubernetes (Deployment + HPA + Ingress + NetworkPolicy + PodSecurityStandards) | Case'in demo şekli (`docker compose up`, tekil `docker stop`) K8s gerektirmiyor; K8s'e geçiş bağımsız bir sonraki faz olarak planlanmalı |
| Secret yönetimi | Dosya tabanlı Docker Compose secrets (Bölüm 19) | HashiCorp Vault / AWS Secrets Manager+KMS / bulut sağlayıcı secret servisi + otomatik rotasyon | Vault gibi bir servisin kendisi de yönetilmesi gereken ek bir bağımlılık; bu ölçekte gereksiz operasyonel yük |
| Mesaj kuyruğu | RabbitMQ (topic exchange + DLQ, tek node) | Kafka (yüksek olay hacminde) veya RabbitMQ quorum queue cluster (yüksek erişilebilirlik) | Mevcut olay hacmi RabbitMQ'nun rahatlıkla karşılayabileceği seviyede; Kafka'ya geçiş, ek operasyonel karmaşıklığı (Zookeeper/KRaft, partition yönetimi) haklı çıkaracak bir ölçek henüz yok |
| Metrik/alarm | Log tabanlı gözlemlenebilirlik (Loki/Promtail/Grafana, Bölüm 21.3) | Prometheus (metrik toplama) + Alertmanager (SLA ihlali/servis çökmesi için otomatik uyarı) + OpenTelemetry distributed tracing | Bu teslimatın odağı loglara dayalı gözlemlenebilirlikti; metrik+alarm katmanı doğal bir sonraki adım olarak not edilmiştir |
| Mesajlaşma hız sınırlama durumu | In-memory `Map` (tekil container için yeterli, Bölüm 20) | Redis tabanlı paylaşımlı sayaç (yatay ölçeklenmiş `incident-service` replikaları için) | Şu an tek replika ile çalışılıyor; çoklu replika senaryosu bu case'in kapsamında yok |
| Bağımlılık güvenlik taraması | `npm audit` çıktısı (14 zafiyet: 10 orta, 4 yüksek) manuel gözden geçirilmedi | CI/CD pipeline'ına `npm audit --audit-level=high` / Dependabot / Snyk entegrasyonu | Zaman bütçesi önceliği, bu turda mimari sertleştirmeye ve fonksiyonel doğrulamaya verildi; bir sonraki sprint'in ilk maddesi olarak işaretlenmiştir |

Bu tablo, jüri veya bir sonraki geliştirme ekibi için "neden X yok" sorusuna doğrudan, savunulabilir bir yanıt sağlamak amacıyla tutulmaktadır — amaç, kapsam dışı bırakılan konuların gözden kaçtığı değil, bilinçli önceliklendirmenin bir sonucu olduğunu göstermektir.

---

## 23. Faz 4 — Cilalama, Bonus Özellikler ve Test Kapsamı

Faz 4, orijinal yol haritasının (Bölüm 15) son aşamasıdır: kalan bonus kalemlerini tamamlamak,
belgelenmiş ama uygulanmamış test kapsamı boşluklarını kapatmak ve UI/UX'i son haline getirmek.

### 23.1 Gerçek zamanlı bildirimler (bonus +2 — WebSocket)

`incident.assigned` ve `badge.earned` event'leri, Bölüm 7'den beri "bonus: WebSocket" notuyla
işaretliydi ama hiçbir tüketicisi yoktu. Faz 4'te Gateway'e (`gateway/src/websocket.js`) eklenen
Socket.IO relay'i bu boşluğu kapatır:

- Gateway, aynı HTTP server üzerinde bir Socket.IO sunucusu çalıştırır (tek port, tek giriş
  noktası ilkesi korunur).
- Bağlanan her istemci, REST için kullanılan aynı RS256 access token ile kimlik doğrular
  (handshake `auth.token`); Gateway'in zaten sahip olduğu public key ile doğrulanır — ek bir
  secret veya anahtar gerekmez.
- Doğrulanan istemci `user:<userId>` odasına yerleştirilir.
- Gateway, `netopscell.events` topic exchange'ine kendi **geçici** (exclusive, auto-delete)
  kuyruğuyla bağlanır ve yalnızca `incident.assigned` + `badge.earned` routing key'lerini dinler.
  Bu kuyruk **durable değildir** — bilinçli bir tercih: bu tüketici iş-kritik değildir (bir
  toast bildirimi kaçırılması veri kaybı sayılmaz), Gamification/AI'nin durable kuyruklarındaki
  asıl iş mantığını etkilemez.
- Olay geldiğinde, payload'daki hedef kullanıcı kimliğine (`team_id` / `user_id`) göre yalnızca
  ilgili odaya (`user:<id>`) hedefli olarak yayınlanır — genel broadcast değildir.
- Frontend (`src/hooks/useRealtimeNotifications.ts`), oturum süresince bu soket bağlantısını
  tutar; olay geldiğinde `sonner` ile toast gösterir **ve** ilgili React Query cache'lerini
  (`incidents`, `gamification-profile`, `leaderboard`) geçersiz kılarak veriyi bir sonraki
  polling turu beklemeden tazeler.

### 23.2 Kategori bazlı AI doğruluk paneli (bonus +3 tamamlandı)

`GET /api/v1/ai/accuracy/by-category` endpoint'i Faz 3'ten beri vardı ama hiçbir arayüz onu
tüketmiyordu — yalnızca genel doğruluk oranı (`/accuracy`) Süpervizör dashboard'da görünüyordu.
Faz 4'te dashboard'a her `fault_type` için ayrı tahmin sayısı/yanlış sınıflandırma/doğruluk oranı
gösteren bir tablo eklendi (`frontend/src/features/supervisor/DashboardPage.tsx`).

### 23.3 CI/CD pipeline (bonus +2)

`.github/workflows/ci.yml`, her `push`/`pull_request`'te 7 paralel iş çalıştırır: 3 NestJS
servisinin (Identity, Incident, Gamification) build+test'i, Gateway'in sözdizimi doğrulaması,
frontend'in tip kontrolü+build'i, AI servisinin pytest paketi ve son olarak (hepsi başarılı
olursa) tüm 7 servisin Docker imajının derlenebilirliğini doğrulayan bir `docker compose build`
adımı. Docker secrets `build` aşamasında gerekmediği için (yalnızca `up` çalışma zamanında
mount edilir) CI'da secret üretimi gerekmez.

### 23.4 Eksik test kapsamının tamamlanması

Bölüm 16 (Test Stratejisi), "state machine geçiş kuralları" ve "JWT/token rotation mantığı" için
unit test sözü veriyordu, ancak Identity ve Incident servislerinde `test` script'i gerçekte bir
placeholder'dı (`echo "(test placeholder)" && exit 0`) — hiçbir gerçek test çalışmıyordu. Faz 4'te
bu boşluk kapatıldı:

- `services/identity-service/src/auth/jwt.util.spec.ts` (5 test): geçerli imzalama/doğrulama
  round-trip, süresi dolmuş token reddi, `alg:none` saldırısı reddi, farklı issuer ile üretilmiş
  token'ın reddi (token confusion savunması), bozulmuş imza reddi.
- `services/incident-service/src/incidents/state-machine.spec.ts` (14 test): tanımlı her yasal
  geçiş + doğru rol, adım atlamanın her koşulda reddi, yetkisiz rol geçişinin reddi, geriye
  dönüşün tanımsızlığı, `KAPANDI`'nın terminal durum olduğunun doğrulanması.
- `services/ai-service/tests/test_rules.py` + `test_scoring.py` (22 test): eşik yönlendirme
  kuralı, güç kesintisi güvenlik ağı, Haversine mesafesi, yakınlık/boşluk oranı sınır davranışı,
  uçtan uca atama skoru hesaplama — Bölüm 9.2'deki skorlama formülünün ilk kez otomatik testle
  doğrulanmasıdır.

Gamification Service'in birim testleri (6/6, Faz 1'den beri mevcut) değişmeden korunmuştur.

### 23.5 AI yaklaşım dokümanı

Bölüm 16'nın zorunlu teslimat kalemi olan "AI yaklaşım dokümanı", bu doküman içindeki Bölüm 9'un
ötesinde, gerçek eğitim çıktılarıyla (çapraz doğrulama skorları, confusion matrix, feature
importance) ayrı ve bağımsız bir dosya olarak yazıldı:
[`services/ai-service/ML_APPROACH.md`](../services/ai-service/ML_APPROACH.md).

## 24. Faz 5 — Canlı Saha Operasyonu (Case Kapsamının Ötesi)

Case'in "haritada vaka göster" beklentisi, uçtan uca bir **saha operasyon komuta ekranına**
genişletildi. Tasarım ilkeleri: her görsel öğe gerçek veriye dayanır (mock katman yok) ve
hiçbir yeni özellik servislerin bağımsızlık ilkesini bozmaz.

### 24.1 İkinci ML Modeli — Çözüm Süresi (ETA) Regresyonu

- Ayrı problem, ayrı model: tür tahmini sınıflandırma, süre tahmini regresyondur.
  `models/eta_model_v1.joblib` (Ridge; 3 aday, 5-fold CV, MAE kalite kapısı ≤ 40 dk).
- Atama akışına gömülü: `/api/v1/ai/assign` yanıtı `travel_minutes + work_minutes =
  total_eta_minutes` kırılımı döner; manuel atamada Incident Service `POST /api/v1/ai/estimate`
  çağırır. ETA modeli erişilemezse atama ETA'sız tamamlanır (graceful degradation).
- Yol süresi deterministiktir (5 dk hazırlık + mesafe × 1.35 / 34 km/s) ve frontend'deki canlı
  araç animasyonu aynı formülü paylaşır. Detay: `ML_APPROACH.md` Bölüm 10.

### 24.2 Operasyon Haritası ve Canlı Araç Akışı

- **Veri katmanları:** istasyon kataloğu (Incident DB, `stations` tablosu, ilk açılışta 18
  gerçek İstanbul lokasyonu seed edilir), ekip rosteri + anlık iş yükü (`GET /api/v1/ai/teams`,
  AI'ın kendi `team_cache`'inden — database-per-service korunur), vakalar ve atama uçları
  (`assignedTeamLat/Lng`, Incident DB).
- **Rota:** OSRM public API'den gerçek yol geometrisi (istemci tarafı, bellek içi cache);
  erişilemezse kuş uçuşu bezier düşüşü. Backend'e rota bağımlılığı bilinçli olarak konmadı —
  demo ortamında dış API kesintisi haritayı bozmaz, sadece sadeleştirir.
- **Canlı akış:** `YOLDA` geçişinde `departedAt` damgalanır; araç konumu
  `(now - departedAt) / etaTravelMinutes` oranıyla rota üzerinde interpolasyonla hesaplanır.
  Deterministik olduğu için tüm istemciler ek bir konum-yayını altyapısı olmadan aynı canlı
  konumu görür (WebSocket konum yayını üretim yol haritasında, Bölüm 22).
- `arrivedAt` da kaydedilir → gerçekleşen vs. tahmini ETA analizi için veri birikir.

### 24.3 Atama Açıklanabilirliği

Otomatik atamada skor kırılımı (uzmanlık/mesafe/kapasite), değerlendirilen alternatif ekipler
ve ETA, vakanın `assignmentDetail` (jsonb) alanına kalıcı yazılır; UI "Neden bu ekip?" paneli
ve süpervizörün manuel müdahale kararları bu veriden beslenir.

### 24.4 Mesajlaşma (WhatsApp Paritesi)

Faz 3 MongoDB altyapısının üzerine: gönderen adı (JWT `name` claim'i — Identity token'ına
eklendi), gün ayraçları + mesaj gruplama, tek/çift tik okundu göstergesi, optimistik gönderim
ve **sistem mesajları** — atama/yola çıkış/varış/parça/çözüm olayları thread'e otomatik düşer
(Mongo erişilemezse sessizce atlanır, akış bloke olmaz).

### 24.5 Demo Senaryo Yükleyici

`scripts/seed-demo.sh`: telemetriler (biri AI tarafından İZLE'ye ayrılır — yanlış alarm ayrımı
kanıtı), NOC onayları, **üç farklı teknisyenin** tam yaşam döngüsü (farklı puan/rozet/
değerlendirme kombinasyonlarıyla — liderlik tablosu gerçekçi görünsün diye), PARCA_BEKLENIYOR
edge-case'i ve haritada canlı izlenen YOLDA vakası. Jüri demosu tek komutla dolu bir sistemde
başlar.

## 25. Faz 7-8 — Canlı Denetim Bulguları ve Gerçek OTP Teslimatı

### 25.1 Kritik Güvenlik Düzeltmesi: Refresh Token Reuse-Detection

Canlı saldırı simülasyonunda (gerçek rotasyon + reuse zinciri çalıştırılarak) bulunan bir açık:
`refreshTokenRepo.update({ familyId, revokedAt: null }, { revokedAt: new Date() })` çağrısı,
TypeORM'un `update()` kriterinde düz `null` değerinin `IS NULL`'a güvenilir şekilde
dönüşmemesi nedeniyle rotasyondaki kardeş token'ı iptal etmiyordu — "tüm oturumlar
sonlandırıldı" mesajına rağmen bir sonraki token çalışmaya devam ediyordu. Düzeltme: TypeORM'un
`IsNull()` operatörü. Bu, salt kod incelemesinin neden canlı güvenlik testinin yerini
tutamayacağının somut bir kanıtıdır. Regresyon testi: `auth.service.spec.ts`.

### 25.2 Case 4.2 State Machine Düzeltmesi

`PARCA_BEKLENIYOR → MUDAHALE_EDILIYOR` geçişinin case tablosundaki "Kim Yapabilir" hanesi
"Sistem"dir — parça talebini teknisyen başlatır (önceki satır), ama tedarik onayını NOC/dispatch
yapar (bu satır). Kod başlangıçta bu ayrımı gözetmiyor, teknisyene her iki yönde de izin
veriyordu. Düzeltme sonrası bu geçiş yalnızca NOC/Süpervizör'e açık; ayrıca bu geçişte
`incident.parts.supplied` event'i gerçekten yayınlanıyor (bkz. Bölüm 9, EVENTS.md — önceden
"tasarlanacak" olarak işaretliydi).

### 25.3 Case 4.3 Kapsama-Farkındalıklı Öncelik Matrisi

AI'ın öncelik ataması artık case 4.3'ü birebir uyguluyor: arıza olasılığı + istasyonun gerçek
abone kapsama verisi (`stations.coverageUsers`, Incident Service → AI Service) birlikte
değerlendirilir. Ayrı bir "öncelik ML modeli" bilinçli olarak eğitilmedi — case önceliği bu iki
girdiden tanımlar, opak bir model yerine denetlenebilir bir karar matrisi (süpervizör
override'lanabilir) tercih edildi. Detay: kök README "Önceliklendirme Nasıl Yapılıyor?".

### 25.4 OTP Teslimatı — İki Kademeli Strateji ve Denenen/Geri Alınan Telegram Entegrasyonu

Case OTP için simülasyon (sabit kod) kabul eder. Bu proje iki kademeli bir strateji uygular
(`AuthService.register()`, `src/auth/email.service.ts`):

1. Müşteri kayıt sırasında e-posta girdiyse VE SMTP yapılandırılmışsa: kod **gerçekten**
   o adrese gönderilir (nodemailer/SMTP), rastgele üretilir, API yanıtında dönmez.
2. Aksi halde: müşterinin kodu başka bir kanaldan alma imkânı olmadığından, doğrulama adımının
   engellenmemesi için kod web arayüzünde gösterilir (`otpHint`).

Her iki durumda da kod `otp_codes` tablosuna **müşteri kaydıyla ilişkili** (`userId` + `gsm`)
yazılır — hangi kodun hangi müşteriye ait olduğu sunucu tarafında her zaman izlenebilir.

Gerçek bir Telegram Bot API entegrasyonu (long-polling, GSM↔chat_id bağlama akışı, gerçek
bot token ile) uçtan uca kurulup çalıştığı doğrulandı. Ancak Telegram'ın **tüm botlar için
geçerli, kaçınılmaz platform kısıtlaması** — bir bot, kullanıcı önce ona `/start` ile mesaj
atmadan hiçbir mesaj gönderemez (spam koruması) — demo akışına gereksiz bir tek-seferlik
"bağlama" adımı ekliyordu. Bu adım hiçbir Telegram botunda atlanamaz; SMS'in aksine "numarayı
gir, otomatik kod gelsin" davranışı Telegram ile mümkün değildir. E-posta, ek adım
gerektirmeyen daha sade bir gerçek teslimat kanalı olduğu için tercih edildi.

### 25.5 Bağımsızlık Doğrulaması — Dört Servisin Tamamı

Case'in en çok vurguladığı ilke ("bir servis çökerse diğerleri çökmesin") dört servisin her biri
tek tek durdurularak canlı doğrulandı:

| Durdurulan Servis | Gözlem |
|---|---|
| AI Service | Telemetri yine BELIRSIZ/ORTA vaka açar, manuel kuyruğa düşer; UI'da amber uyarı bandı |
| Gamification Service | Vaka çözme/telemetri akışı etkilenmez; `incident.resolved` event'i durable kuyrukta bekler, servis geri gelince otomatik işlenir (puanlar canlı doğrulandı) |
| Identity Service | Mevcut JWT'ler RS256 public key ile **yerel** doğrulandığı için incident/dashboard işlemleri kesintisiz sürer; yalnızca YENİ girişler 503 döner |
| Incident Service | Identity/AI/Gamification tamamen bağımsız çalışmaya devam eder; yalnızca incident'e bağlı çağrılar 503 döner |

---

*Bu doküman onaylandıktan sonra kod geliştirme sürecine geçilecek ve her servis için ayrı implementasyon planı (`writing-plans` süreciyle) hazırlanacaktır.*
