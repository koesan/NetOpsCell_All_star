# NetOpsCell

<div align="center">

![Turkcell Logo](frontend/public/turkcell-logo.svg)

### Turkcell CodeNight 2026 Final — Şebeke Arıza Tahmini ve Saha Operasyon Platformu

*Turkcell şebeke altyapısındaki arızaları önceden tahmin eden, sınıflandıran, akıllı algoritmalarla en uygun saha ekibine yönlendiren ve saha personelini oyunlaştırma ile motive eden; API Gateway arkasında 4 bağımsız mikroservisle çalışan uçtan uca operasyon platformu.*

[![React](https://img.shields.io/badge/Frontend-React_18_%7C_TypeScript_%7C_Tailwind-61DAFB?logo=react)](https://reactjs.org/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS_%7C_Express-E0234E?logo=nestjs)](https://nestjs.com/)
[![FastAPI](https://img.shields.io/badge/AI_Service-FastAPI_%7C_Python-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Deployment-Docker_Compose-2496ED?logo=docker)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_%7C_MongoDB_%7C_Redis-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![RabbitMQ](https://img.shields.io/badge/Event_Bus-RabbitMQ-FF6600?logo=rabbitmq)](https://www.rabbitmq.com/)

</div>

---

## 📌 Proje Nedir?

**NetOpsCell**, Turkcell'in geniş coğrafyadaki baz istasyonu ağında oluşabilecek arızaları **yapay zekâ ve telemetri analizleri** ile henüz kesinti yaşamadan veya yaşandığı anda tespit eden, arıza türünü ve tahmini çözüm süresini (ETA) belirleyen, coğrafi yakınlık, uzmanlık ve iş yüküne göre **en doğru saha ekibine otomatik atayan** kurumsal bir operasyon platformudur.

Platform; **Müşteri**, **Saha Teknisyeni**, **NOC (Şebeke Operasyon Merkezi) Operatörü**, **Süpervizör** ve **Sistem Yöneticisi (Admin)** olmak üzere 5 farklı kullanıcı rolüne özel ekranlar, canlı harita takibi, saha mesajlaşması ve oyunlaştırma (gamification) mekanizmaları sunar.

---

## ⚡ Hızlı Başlangıç & Nasıl Çalıştırılır?

Sistemi yerel ortamınızda **tek komutla** ayağa kaldırabilir ve demo verisi yükleyebilirsiniz.

### 📋 Ön Koşullar
- **Docker** & **Docker Compose** (v2+)
- **Node.js** (v18+ — opsiyonel, sadece lokal geliştirme için)
- **Bash** shell (Linux / macOS / WSL2)

---

### 🚀 3 Adımda Çalıştırma

#### Adım 1: Gizli Anahtarları Üretin
```bash
./scripts/generate-secrets.sh
```
> *Bu script; PostgreSQL şifrelerini, JWT RS256 anahtar çiftini, RabbitMQ ve Grafana kimlik bilgilerini `secrets/` klasöründe güvenli şekilde üretir.*

*(Opsiyonel Gemini AI Entegrasyonu)*: Müşteri şikayeti LLM ön analizi için ücretsiz bir Gemini API Key alıp `secrets/gemini_api_key.txt` dosyasına tek satır olarak kaydedebilirsiniz. Girilmezse sistem diğer tüm ML modelleriyle eksiksiz çalışır.

#### Adım 2: Konteynırları Ayağa Kaldırın
```bash
docker compose up --build -d
```
> *Sistemdeki 16 konteynır (4 mikroservis + Gateway + Frontend + PostgreSQL×4 + MongoDB + Redis + RabbitMQ + Loki + Promtail + Grafana) otomatik derlenir ve başlatılır.*

#### Adım 3: Demo Verisini ve Senaryosunu Yükleyin
```bash
# Temel veri tohumlama (Kullanıcılar, İstasyonlar, Ekipler)
docker compose exec identity-service node dist/seed.js
curl -X POST http://localhost:8000/internal/refresh-teams -H "x-internal-key: $(cat secrets/internal_api_key.txt)"

# Gerçekçi operasyon demo akışı (Vakalar, Canlı Rotalar, Mesajlaşma)
./scripts/seed-demo.sh
```

---

## 🌐 Servis Adresleri ve Kullanıcı Bilgileri

Sistem ayağa kalktıktan sonra aşağıdaki adreslerden erişilebilir:

| Servis / Panel | URL | Açıklama |
|---|---|---|
| 🖥️ **Web Kullanıcı Arayüzü** | [http://localhost:3000](http://localhost:3000) | React SPA (Tüm roller için ana giriş) |
| 🛡️ **API Gateway** | [http://localhost:8080](http://localhost:8080) | Tüm API isteklerinin ortak noktası |
| 🔑 **Identity Service Swagger** | [http://localhost:3001/docs](http://localhost:3001/docs) | Kullanıcı, Yetki, OTP & Audit API |
| 🚨 **Incident Service Swagger** | [http://localhost:3002/docs](http://localhost:3002/docs) | Arıza Kaydı, Mesajlaşma & SLA API |
| 🧠 **AI Service Swagger** | [http://localhost:8000/docs](http://localhost:8000/docs) | Tahmin, ETA, Atama & LLM API |
| 🏆 **Gamification Service Swagger** | [http://localhost:3003/docs](http://localhost:3003/docs) | Puan, Rozet & Liderlik Tablosu API |
| 🐰 **RabbitMQ Management** | [http://localhost:15672](http://localhost:15672) | Event Bus Yönetim Paneli (`netopscell_app`) |
| 📊 **Grafana Loglama** | [http://localhost:3100](http://localhost:3100) | Merkezi Loki Log Paneli (`admin`) |

### 🔐 Örnek Kullanıcı Hesapları (Demo Şifresi: `Demo123!`)

| Rol | E-posta / GSM | Açıklama |
|---|---|---|
| **Süpervizör** | `supervizor@netopscell.com` | Tüm şebekeyi izler, manuel atama yapar, SLA & AI metriklerini görür. |
| **NOC Operatörü** | `noc@netopscell.com` | Şebeke arıza girişlerini inceler, vakaları onaylar veya atar. |
| **Saha Teknisyeni 1** | `saha.donanim@netopscell.com` | Donanım/Aşırı Isınma uzmanı. Kendisine atanan rotayı ve vakaları görür. |
| **Saha Teknisyeni 2** | `saha.baglanti@netopscell.com` | Bağlantı/Yazılım uzmanı. |
| **Saha Teknisyeni 3** | `saha.guc.kesintisi@netopscell.com` | Güç Kesintisi uzmanı. |
| **Admin** | `admin@netopscell.com` | Personel yönetimi ve sistem güvenlik audit loglarını inceler. |
| **Müşteri** | `05551234567` | GSM + OTP ile giriş yapar, arıza bildirir, Gemini AI ön analizi alır. *(OTP varsayılan: `1234`)* |

---

## 🏗 Mimari ve Teknolojik Altyapı

Platform, yüksek erişilebilirlik ve mikroservis bağımsızlığı (Fault-Tolerance) ilkesiyle tasarlanmıştır.

```
                    ┌─────────────────────────────────────────┐
                    │     React SPA (Vite / Tailwind / TS)    │
                    └────────────────────┬────────────────────┘
                                         │ WebSocket / HTTP
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │    API Gateway (Express / Socket.IO)    │
                    └────┬───────────────┬───────────────┬────┘
                         │               │               │
      ┌──────────────────┴───┐       ┌───┴───────────────────┐       ┌───┴───────────────────┐
      │   Identity Service   │       │   Incident Service    │       │ Gamification Service  │
      │   (NestJS / Auth)    │       │ (NestJS / StateMach)  │       │ (NestJS / Puan-Rozet) │
      └──────────┬───────────┘       └──────────┬────────────┘       └──────────┬────────────┘
                 │                              │                               │
                 ▼                              ▼                               ▼
            PostgreSQL                  PostgreSQL + MongoDB              PostgreSQL + Redis
                 │                              │                               │
                 └──────────────────────────────┴───────────────────────────────┘
                                                │
                                                ▼
                                    RabbitMQ (Event Bus) ◄───► AI Service (Python FastAPI)
                                                │
                                                ▼
                                     Loki + Promtail + Grafana (Merkezi Loglama)
```

### Teknolojik Bileşenler Matrixi

| Katman | Teknoloji | Görev / Kullanım Amacı |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS | Modern UI, React-Leaflet Canlı Harita, Recharts Grafikler, Framer Motion |
| **API Gateway** | Node.js, Express, Socket.IO, Helmet | JWT Ön-Doğrulama, CORS, Rate Limiting, Canlı Bildirim Relay |
| **Identity Service** | NestJS, TypeORM, PostgreSQL | Kullanıcı Yönetimi, RS256 JWT, Refresh Token Rotation, OTP, Audit Log |
| **Incident Service** | NestJS, TypeORM, Mongoose | Vaka Yaşam Döngüsü (State Machine), SLA Takibi, MongoDB Saha Chat |
| **AI Service** | Python, FastAPI, Scikit-Learn | Arıza Tahmini (RF), ETA Regresyonu (Ridge), Eskalasyon (Telstra), Akıllı Atama |
| **Gamification Service** | NestJS, TypeORM, Redis | Puanlama, Rozet Kazanımı, Günlük/Haftalık Liderlik Tablosu (Leaderboard) |
| **Event Bus** | RabbitMQ (Topic Exchange + DLQ) | Servisler arası asenkron olay iletimi (durable queues) |
| **Loglama & Gözlemlenebilirlik**| Loki, Promtail, Grafana | 16 konteynırdan canlı log toplama ve merkezi analiz |

---

## 🤖 Yapay Zeka Mimarisi & ML Modelleri

NetOpsCell AI katmanı, tek bir model yerine **3 bağımsız ML modeli + 1 LLM entegrasyonu + Akıllı Atama Algoritması** çalıştırır:

```
                                  [ Telemetri Verisi ]
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
   [ 1. Arıza Sınıflandırıcı ]     [ 2. ETA Regresyonu ]         [ 3. Eskalasyon Riski ]
   RandomForest (F1: 0.957)        Ridge (MAE: 32.9 dk)          RandomForest (Telstra Data)
   Arıza Türü ve Olasılığı         Saha İş Süresi Tahmini        Risk Şiddeti (Düşük/Orta/Yüksek)
             │                             │                             │
             └─────────────────────────────┼─────────────────────────────┘
                                           ▼
                            [ 4. Akıllı Saha Ekibi Ataması ]
                            Deterministik Skorlama Karar Matrisi:
                            (Uzmanlık × 0.4) + (Mesafe × 0.3) + (Kapasite × 0.3)
```

1. **Arıza Tahmini ve Tür Sınıflandırma (RandomForest)**:
   - Telemetri verilerini (sinyal gücü, paket kaybı, sıcaklık, güç durumu) analiz ederek arıza olasılığını ve türünü tesciller.
   - **Test macro-F1: 0.957**. (İTÜ 5G Saha Ölçüm Verileri ile kalibre edilmiş 1.500 sentetik v2.1 örneği ile eğitildi).

2. **Çözüm Süresi / ETA Regresyonu (Ridge)**:
   - Arıza türü, öncelik ve saha koşullarına göre ekibin sahada ne kadar süre geçireceğini tahmin eder.
   - **Test MAE: 32.9 dk**.

3. **Eskalasyon Riski Tahmini (RandomForest - Gerçek Veri Seti)**:
   - **Kaggle Telstra Network Disruptions** (7.381 gerçek telekom arıza örneği) verisiyle doğrudan eğitilmiştir. İstasyonun geçmiş arıza profiline göre arızanın büyüme riskini sınıflandırır.

4. **Şikayet Ön Analizi (Google Gemini 2.5 Flash LLM)**:
   - Müşterinin serbest metin olarak girdiği arıza şikayetini analiz eder. Şema zorlamalı JSON çıktısı ile muhtemel arıza alanını, olası nedeni ve kullanıcıya yapması gereken öneriyi anında sunar.

5. **Akıllı Saha Ekibi Ataması (Optimizasyon Algoritması)**:
   - Ekip uzmanlık eşleşmesi (%40), Haversine coğrafi mesafe yakınlığı (%30) ve anlık iş yükü kapasitesi (%30) ağırlıklarıyla deterministik skorlama hesaplar. En yüksek skora sahip ekibi otomatik görevlendirir.

---

## ✨ Öne Çıkan Platform Özellikleri

### 🗺️ 1. Canlı Operasyon Haritası ve Çoklu-Durak Rota Planı
- **İstasyon ve Saha Ekipleri Katmanı**: Baz istasyonları, kapsama alanı nüfusları, aktif saha ekiplerinin üs konumları.
- **Çoklu Durak Rotaları (OSRM)**: Bir ekibe birden fazla vaka atandığında OSRM yol ağı kullanılarak en optimal durak sırası ve tahmini varış saatleri hesaplanır.
- **Canlı Araç Animasyonu**: YOLDA durumundaki ekipler, hareket anı ve ETA interpolasyonuyla haritada canlı olarak ilerler.

### 📝 2. NOC Manuel Telemetri / Arıza Girişi
- Şebeke operasyon ekibi, portal üzerinden manuel telemetri kaydı ve arıza bildirimi açabilir.
- Açılan arıza anında AI modelleri tarafından taranarak haritada ve atama kuyruğunda görünür.

### 💬 3. WhatsApp Tarzı Saha Mesajlaşması
- Teknisyen, NOC ve Müşteri arasında vaka bazlı sohbet kanalı (MongoDB altyapılı).
- Okundu bilgisi (çift tik), zaman damgalı durum değişiklikleri ve vaka yaşam döngüsü olaylarının otomatik **sistem mesajı** olarak düşmesi.

### 🏆 4. Saha Oyunlaştırma (Gamification) & Rozetler
- Zamanında çözülen vakalar, yüksek müşteri puanları ve zorlu müdahaleler için puan kazanımı.
- Günlük ve haftalık dinamik Liderlik Tablosu (Leaderboard).
- Kilitlenebilir uzmanlık rozetleri ve seviye (Level) ilerleme sistemi.

### 🔒 5. Güvenlik ve Yetkilendirme
- **JWT RS256**: Asimetrik anahtar imzalamalı token'lar.
- **Refresh Token Rotation & Reuse Detection**: Çalınan veya yeniden kullanılan refresh token tespit edildiğinde kullanıcının tüm aktif oturumları anında iptal edilir.
- **IDOR Koruması**: Teknisyen sadece kendi vakasını, müşteri sadece kendi bildirimini görebilir. Yetkisiz erişimler audit log'a kaydedilir.
- **Rate Limiting**: Brute-force saldırılarına karşı IP ve kullanıcı bazlı istek sınırlaması.

---

## 🎁 Bonus Özellik Karşılıkları (Case 12.1 — 20/20 Puan)

| Bonus Madde | Puan | Uygulama Detayı |
|---|---|---|
| **Kendi Eğittiğiniz ML Modelleri** | **+8** | 3 ayrı ML modeli (RandomForest Sınıflandırıcı, Ridge ETA, Telstra Eskalasyon) eğitilmiş ve `services/ai-service/models/` altında sunulmuştur. |
| **Message Queue Entegrasyonu** | **+5** | RabbitMQ topic exchange & DLQ entegrasyonu; servisler arası olaylar kalıcı (durable) mesaj kuyrukları ile iletilir. |
| **Kategori Bazlı AI Doğruluğu** | **+3** | Süpervizör panelinde arıza türlerine göre AI tahmin doğruluğunu ve yanlış alarm (false alarm) oranlarını gösteren canlı tablo. |
| **Gerçek Zamanlı Bildirimler** | **+2** | Gateway Socket.IO relay'i ile vaka atamaları ve rozet kazanımları web arayüzüne anlık toast ve sesli bildirim olarak iletilir. |
| **CI/CD Pipeline** | **+2** | GitHub Actions (`.github/workflows/ci.yml`) üzerinde otomatik test, lint ve Docker derleme süreçleri. |

---

## 📂 Proje Dizin Yapısı

```
all_star/
├── frontend/                   # React 18 + TypeScript + Vite + Tailwind SPA
├── gateway/                    # Node.js Express API Gateway & WebSocket Relay
├── services/
│   ├── identity-service/       # NestJS Auth, User, OTP & Audit Service
│   ├── incident-service/       # NestJS Vaka Yönetimi, State Machine & Chat Service
│   ├── ai-service/             # Python FastAPI ML Modelleri & Gemini LLM Service
│   └── gamification-service/   # NestJS Puan, Rozet & Liderlik Tablosu Service
├── scripts/
│   ├── generate-secrets.sh     # Güvenli secret/anahtar üretme scripti
│   └── seed-demo.sh            # Demo senaryosu ve canlı veri yükleme scripti
├── docs/                       # Mimari dokümanlar ve case detayları
└── docker-compose.yml          # 16 konteynırlı orkestrasyon dosyası
```

---

## 📄 Lisans ve Referanslar

- **Kurum**: Turkcell CodeNight 2026 Final
- **Case Dokümanı**: [`CodeNight_FINAL_NetOpsCell_Case.pdf`](./CodeNight_FINAL_NetOpsCell_Case.pdf)
- **Mimari Detaylar**: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- **ML Metodolojisi**: [`services/ai-service/ML_APPROACH.md`](./services/ai-service/ML_APPROACH.md)
