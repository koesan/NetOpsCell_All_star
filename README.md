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

## Yapay Zekâ Mimarisi

Case'in kalbi olan AI Service, tek bir model değil **üç ayrı ML modeli + bir LLM entegrasyonu +
deterministik atama skorlaması**ndan oluşan katmanlı bir yapay zekâ mimarisi çalıştırır. Her
bileşen ayrı bir problemi, o probleme uygun yöntemle çözer; hepsi bağımsızlık ilkesine uyar
(herhangi biri devre dışı kalsa sistem çalışmaya devam eder).

| # | Bileşen | Problem | Yöntem | Veri | Gerçek Sonuç |
|---|---|---|---|---|---|
| 1 | **Arıza Tahmini + Tür Sınıflandırma** (case 5.1–5.2) | Telemetriden arıza olasılığı ve türü | RandomForest (3 aday arasından 5-fold CV ile seçildi) + kural katmanı (hibrit) | Sentetik v2.1 — 1.500 örnek, gerçek İTÜ 5G ölçümleriyle kalibre | **Test macro-F1 0.957** |
| 2 | **Çözüm Süresi (ETA) Regresyonu** | Ekip atandığında saha işi ne kadar sürecek? | Ridge (Ridge/RF/GB arasından CV MAE ile seçildi) | Sentetik — 2.400 örnek, latent parça değişkenli üretici süreç | **Test MAE 32.9 dk · R² 0.49** |
| 3 | **Eskalasyon Riski** | Bu istasyondaki yeni arıza büyür mü? | RandomForest (class-weight dengeli) | **Gerçek veri: Telstra Network Disruptions (Kaggle)** — 7.381 örnek | **Test macro-F1 0.56 · kritik sınıf recall 0.82** |
| 4 | **Şikayet Ön Analizi** | Müşterinin serbest metin şikayeti ne anlatıyor? | LLM — Google **Gemini 2.5 Flash-Lite** (yapılandırılmış JSON çıktı) | — (few-shot'sız, şema zorlamalı) | Muhtemel alan + olası neden + öneri + güven |
| 5 | **Akıllı Saha Ekibi Ataması** (case 5.3) | En uygun ekip kim? | Deterministik skorlama: `uzmanlık×0.4 + mesafe×0.3 + kapasite×0.3` (Haversine) + ETA modeli entegrasyonu | Canlı ekip rosteri + iş yükü | Skor kırılımı UI'da ("Neden bu ekip?") |

### Kullanılan Veri Setleri

| Veri Seti | Kaynak | Kullanım |
|---|---|---|
| **Telstra Network Disruptions** | Kaggle — https://www.kaggle.com/c/telstra-recruiting-network (yerel kopya: `services/ai-service/data/telstra/`) | Avustralya'nın en büyük telekom operatörünün **gerçek** şebeke arıza/log verisi (7.381 eğitim örneği, 3 şiddet sınıfı). Eskalasyon riski modeli doğrudan bu veriyle eğitildi. Konum-tabanlı sızıntı (leakage) eğilimli özellikler bilinçli olarak dışlandı. |
| **İTÜ Kampüsü 5G Saha Ölçümleri** | Turkcell CodeNight case ekinde sağlanan gerçek sürüş testi verisi (`docs/Raw/5G Saha Ölçüm Verileri/`) | 1.943 gerçek RSRP/RSRQ/SINR ölçümü. Sentetik telemetri üreticisinin NORMAL sınıf sinyal dağılımı bu veriden kalibre edildi (ortalama −92.6 dBm, medyan −87, σ 20.8 → üreticide N(−85,10)). |
| **Sentetik Telemetri v2.1** | `scripts/generate_dataset.py` → `data/synthetic_telemetry.csv` | 1.500 örnek (250/sınıf); %12'si karışabilir sınıf çiftlerinin sınır bölgesinde üretilen "zor örnek" — metriklerin şişmesini önler. Deterministik seed ile tekrarlanabilir. |
| **Sentetik Çözüm Süresi** | `scripts/generate_dataset.py` → `data/synthetic_resolution.csv` | 2.400 örnek; arıza türü taban süresi, öncelik kaynak çarpanı, gece/hafta sonu etkisi ve **modele verilmeyen** latent yedek-parça değişkeni (gerçekçi indirgenemez hata payı). |

Neden hâlâ sentetik veri de var? Telemetri şeması (sinyal/paket kaybı/sıcaklık/güç) ile birebir
örtüşen, etiketli ve halka açık bir baz istasyonu arıza veri seti bulunmuyor — bu yüzden
telemetri sınıflandırıcısı gerçek ölçümlerle **kalibre edilmiş** sentetik veriyle, eskalasyon
modeli ise **doğrudan gerçek Kaggle verisiyle** eğitildi. Tüm eğitim verileri repoda, tüm
eğitim script'leri tek komutla çalıştırılabilir durumda:

```bash
cd services/ai-service
python -m scripts.generate_dataset        # sentetik veri setlerini yeniden üret
python -m scripts.train_model             # 1) arıza türü sınıflandırıcısı
python -m scripts.train_eta_model         # 2) çözüm süresi (ETA) regresyonu
python -m scripts.train_severity_model    # 3) eskalasyon riski (Telstra gerçek verisi)
```

Her script 3 aday modeli 5-fold cross-validation ile karşılaştırır, en iyisini seçer ve bir
**kalite kapısından** (macro-F1 / MAE eşiği) geçmeden asla üretim model dosyasının üstüne
yazmaz. Tüm gerçek metrikler `services/ai-service/models/*_metrics.json` dosyalarında; metodoloji,
model karşılaştırma tabloları, confusion matrix ve bilinçli sınırlamalar
[`ML_APPROACH.md`](./services/ai-service/ML_APPROACH.md)'dedir. AI doğruluk takibi (case 5.4)
canlıdır: operatör tür değiştirdiğinde yanlış sınıflandırma kaydedilir, süpervizör panelinde
genel + kategori bazlı doğruluk gösterilir.

### Gemini API Anahtarı Kurulumu (Şikayet Ön Analizi)

Müşteri, arıza bildirirken serbest metin şikayet yazabilir; bu metin düşük maliyetli
**gemini-2.5-flash-lite** modeline gönderilir ve form yanında "büyük ihtimalle … alanında sorun
var" tarzı bir ön analiz (muhtemel alan + olası neden + öneri + güven) gösterilir. Analiz vakaya
kaydedilir ve NOC/teknisyen detay ekranında da görünür.

Anahtar **repoda tutulmaz** (güvenlik: `secrets/` dizini `.gitignore`'dadır ve anahtar koda asla
gömülmez). Kurulum:

1. https://aistudio.google.com/apikey adresinden ücretsiz bir Gemini API anahtarı alın.
2. Anahtarı tek satır olarak şu dosyaya yazın: `secrets/gemini_api_key.txt`
3. `docker compose up -d ai-service` ile servisi yeniden başlatın.

Anahtar girilmezse özellik **zarifçe kapalı** kalır: form çalışmaya devam eder, yalnızca "AI Ön
Analiz" düğmesi hata mesajı döndürür; bildirim/atama akışının hiçbir adımı etkilenmez. LLM
çıktısı yalnızca bilgilendirme amaçlıdır — telemetri tabanlı ML sınıflandırıcısının ve atama
kararlarının yerine geçmez (prompt-injection yüzeyi de bu izolasyonla sınırlandırılmıştır).

### Müşteri OTP Doğrulaması

Case, OTP için simülasyon (sabit kod) kabul eder. Bu proje iki kademeli bir teslimat
stratejisi uygular:

1. **Müşteri kayıt sırasında e-posta girdiyse VE SMTP yapılandırılmışsa:** kod **gerçekten**
   o adrese gönderilir (rastgele 4 haneli), API yanıtında hiçbir zaman dönmez.
2. **Aksi halde** (e-posta yok veya SMTP yapılandırılmamış): müşterinin kodu başka hiçbir
   kanaldan alma imkânı olmadığından, doğrulama adımının (case gereği zorunlu) engellenmemesi
   için kod **web arayüzünde gösterilir**.

Her iki durumda da üretilen kod, veritabanında **müşteri kaydıyla ilişkili** olarak saklanır
(`otp_codes` tablosunda `userId` + `gsm`, bkz. `src/entities/otp-code.entity.ts`) — sunucu
tarafında hangi kodun hangi müşteriye ait olduğu her zaman izlenebilir. Doğrulama adımı her
zaman zorunludur; doğru kod girilmeden giriş yapılamaz. Kod `OTP_FIXED_CODE` ortam
değişkeniyle değiştirilebilir (varsayılan `1234`).

**E-posta OTP Kurulumu (opsiyonel):**

1. `secrets/smtp_password.txt` dosyasına e-posta sağlayıcınızın SMTP şifresini (Gmail için
   ["uygulama şifresi"](https://myaccount.google.com/apppasswords)) yazın.
2. `docker-compose.yml`'de veya ortamda `SMTP_HOST`, `SMTP_USER`, `SMTP_FROM` değişkenlerini
   tanımlayın (örn. `SMTP_HOST=smtp.gmail.com SMTP_USER=siz@gmail.com docker compose up -d
   identity-service`).
3. Boş bırakılırsa özellik zarifçe kapalı kalır, kod web'de gösterilmeye devam eder.

> Gerçek bir Telegram Bot API entegrasyonu da uçtan uca çalışır durumda denendi (bkz. Faz 8
> notları), ancak Telegram'ın "bot önce kullanıcıdan mesaj almadan mesaj gönderemez" platform
> kısıtlaması (tüm Telegram botlarında geçerli, kaçınılmaz bir kural) demo akışına gereksiz
> bir tek-seferlik bağlama adımı eklediği için tercih edilmedi — e-posta, ek adım
> gerektirmeyen daha sade bir gerçek teslimat kanalıdır.

### Önceliklendirme Nasıl Yapılıyor? (case 4.3)

Öncelik ataması **AI güdümlüdür ve case 4.3'ü birebir uygular**: "AI etkilenen kullanıcı sayısı
ve arıza olasılığına göre atar; büyük kapsama alanı + yüksek olasılık → KRITIK". ML modelinin
ürettiği arıza olasılığı, istasyon kataloğundaki **gerçek abone kapsama verisiyle**
(`stations.coverageUsers`, telemetriyle birlikte AI'a iletilir) şeffaf bir karar matrisinde
birleşir (`app/ml/rules.py`, birim testli):

| Olasılık | Kapsama ≥ 35K abone veya OUTAGE | Diğer |
|---|---|---|
| ≥ 0.85 (ACİL) | **KRITIK** | YUKSEK |
| 0.40 – 0.85 | YUKSEK | ORTA |
| < 0.40 | DUSUK | DUSUK |

Canlı doğrulama (demo verisiyle): aynı olasılık bandındaki 5 vakadan 4'ü büyük kapsamalı
istasyonlarda (Kadıköy, Taksim, Ataşehir, Maslak — 38-55K abone) KRITIK'e yükseldi, düşük
kapsamalı Bakırköy vakası (29K abone) YUKSEK'te kaldı — matris gerçekten kapsamaya göre ayrım
yapıyor, sabit bir eşik değil.

Ayrı bir "öncelik ML modeli" bilinçli olarak eğitilmedi: case önceliği bu iki girdiden
tanımlar ve elimizde öncelik etiketli veri yoktur — opak bir model yerine denetlenebilir,
süpervizörün her zaman override edebildiği (ve override'ın AI doğruluk metriğine yansıdığı)
bir matris hem case'e hem mühendislik pratiğine daha uygundur. Eskalasyon riski modeli
(Telstra, Bölüm 3. satır) bu kararın YANINDA bağımsız bir gösterge olarak sunulur.

## Bonus Özellikler (case 12.1 — beşi de tam)

| Bonus | Puan | Bu projede | Kanıt |
|---|---|---|---|
| **Kendi eğittiğiniz ML modeli** (eğitim verisi + süreç dokümante) | +8 | **3 ayrı model** kendi verimizle eğitildi; tüm eğitim verileri repoda (`data/`), süreç + gerçek metrikler dokümante | [`ML_APPROACH.md`](./services/ai-service/ML_APPROACH.md) · `models/*_metrics.json` · eğitim scriptleri `scripts/train_*.py` |
| **Message queue ile event iletimi** | +5 | RabbitMQ topic exchange + DLQ; Incident→Gamification/AI, Identity→AI, audit toplama — tümü gerçek kuyruk (durable, kalıcılık testi yapıldı) | [`EVENTS.md`](./EVENTS.md) · RabbitMQ UI `localhost:15672` |
| **Kategori bazlı AI doğruluk kırılımı** (süpervizör paneli) | +3 | `GET /api/v1/ai/accuracy/by-category` + Süpervizör dashboard'da tür bazlı doğruluk tablosu | Dashboard → "Kategori Bazlı AI Doğruluğu" |
| **Gerçek zamanlı bildirimler** (WebSocket) | +2 | Gateway Socket.IO relay: `incident.assigned` (ETA'lı toast) ve `badge.earned` anlık iletilir, cache'ler tazelenir | `gateway/src/websocket.js` · `frontend/src/hooks/useRealtimeNotifications.ts` |
| **CI/CD pipeline** | +2 | GitHub Actions: 4 Node servis build+test, frontend build, AI pytest, 7 Docker imajı derleme | [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) |

## Zorunlu Demo Senaryosu (case 11.3) — Adım Adım Karşılıklar

| # | Case adımı | Bu projede nasıl gösterilir |
|---|---|---|
| 1 | `docker compose up` ile tüm sistem | `./scripts/generate-secrets.sh` + `docker compose up --build` → 16 konteyner, hepsi healthcheck'li |
| 2 | Kritik telemetri oluştur | Müşteri girişi → "Arıza Bildir" → "Güç Kesintisi" hızlı senaryosu (veya `./scripts/seed-demo.sh` hepsini kurar) |
| 3 | AI olasılık + tür + öncelik | Sonuç panelinde olasılık çubuğu + eskalasyon riski; vaka detayında tür/öncelik rozetleri (kapsama-farkındalıklı matris) |
| 4 | Doğru uzmanlıkta ve yakın ekibe atama | Vaka detayı → "Neden bu ekip?" skor kırılımı (uzmanlık/mesafe/kapasite) + değerlendirilen alternatifler + haritada rota |
| 5 | Saha teknisyeni çözer | Teknisyen girişi → YOLDA (haritada canlı araç) → MUDAHALE → çözüm notu |
| 6 | Puan liderlik tablosuna yansır | WebSocket toast + Liderlik Tablosu / Profil (rozetler) anında güncellenir |
| 7 | **Servis kapat, sistem çalışsın** | `docker stop netopscell-ai-service` → telemetri yine vaka açar (BELIRSIZ/ORTA, manuel kuyruk), UI'da amber "AI Service erişilemiyor" bandı çıkar, geri kalan her şey çalışır. Aynı test Gamification/Identity/Mongo için de doğrulandı (bkz. `ARCHITECTURE.md` Bölüm 21.3) |
| 8 | Jüri güvenlik testleri | Aşağıdaki "Güvenlik" bölümü — tüm senaryolar canlı doğrulandı |

## Güvenlik (case 10 — jüri saldırı senaryolarına karşı)

Aşağıdaki senaryoların hepsi **çalışan sisteme karşı canlı olarak** yeniden test edildi (curl ile
gerçek saldırı payload'ları gönderilerek, sadece kod okunarak değil):

| Saldırı | Savunma | Canlı test sonucu |
|---|---|---|
| SQL injection | Tüm sorgular ORM/parametrik (TypeORM, SQLAlchemy); class-validator + Pydantic girdi doğrulama | `' OR 1=1 --` → 400 (alan format doğrulamasında reddedildi) |
| Yetkisiz endpoint (müşteri → süpervizör) | Her endpoint'te sunucu tarafı rol guard'ı → 403 + audit log | Müşteri token'ıyla `/dashboard/summary`, `/admin/audit-logs`, manuel atama → hepsi 403 |
| IDOR (başkasının kaydı) | Sahiplik kontrolü (`assertOwnership`): müşteri yalnız kendi, teknisyen yalnız atanan vakayı görür | İkinci müşteri hesabıyla başka müşterinin vaka ID'sine erişim → 403 + `IDOR_DENEMESI` audit log kaydı |
| JWT manipülasyonu | RS256 + algoritma whitelist (`alg:none`/HS256 downgrade reddi) + issuer/audience doğrulama; Gateway'de ön-doğrulama | Payload/imza ortası değiştirilmiş token → 401; `alg:none` sahte token → 401; süresi dolmuş token → 401 |
| **Refresh token yeniden kullanımı** | Token rotation + reuse detection: geçersiz kılınmış token kullanılırsa **ailedeki TÜM oturumlar** sonlandırılır | 🔧 Canlı testte gerçek bir hata bulundu ve düzeltildi: rotasyondaki kardeş token, TypeORM `update()` kriterinde düz `null` yerine `IsNull()` operatörü gerektiği için iptal edilmiyordu — düzeltme sonrası doğrulandı, regresyon testi eklendi (`auth.service.spec.ts`) |
| XSS | React çıktı kaçışlama (`dangerouslySetInnerHTML` hiçbir yerde kullanılmıyor) + Helmet güvenlik başlıkları + CSP | `<script>alert(1)</script>` şikayet metnine enjekte edildi → ham metin olarak saklanıyor, tarayıcıda salt metin olarak (escaped) render ediliyor, CSP `script-src 'self'` |
| Brute-force | Gateway katmanlı rate limit (login 5/dk, OTP 5/dk, genel 100/dk) + Identity'de 5 hatada 15 dk hesap kilidi (kalan süre bilgisiyle) | 6. ardışık yanlış giriş denemesi → 429 (`RATE_LIMITED`) |

Bu tablodaki refresh-token bulgusu, canlı güvenlik testinin neden salt kod incelemesinden daha
güvenilir olduğunun somut kanıtıdır: kod okunduğunda mantık doğru görünüyordu, yalnızca gerçek
bir rotasyon + yeniden-kullanım zinciri çalıştırıldığında ortaya çıktı.

## Rol Bazlı Görünürlük (case 3.3 yetki matrisi)

| Ekran | Müşteri | Saha Teknisyeni | NOC | Süpervizör | Admin |
|---|---|---|---|---|---|
| Arıza bildir (+ AI ön analiz) | ✓ | — | — | — | — |
| Vakalarım (kendi kayıtları) | ✓ | ✓ (atanan) | ✓ (tümü) | ✓ (tümü) | ✓ (tümü) |
| Operasyon haritası + rota programı | — | ✓ (kendi rotası) | ✓ | ✓ | ✓ |
| Durum geçişi / çözüm notu | — | ✓ | ✓ (kapatma) | ✓ | — |
| Manuel atama | — | — | — | ✓ | — |
| Dashboard (SLA, AI doğruluk, performans) | — | — | — | ✓ | ✓ |
| Liderlik tablosu / profil-rozet | — | ✓ | ✓ | ✓ | — |
| Personel yönetimi + Audit log | — | — | — | — | ✓ |

Yetkiler yalnızca menüde gizlenmez; her endpoint sunucu tarafında rol guard'ı ve sahiplik
kontrolüyle korunur (yetkisiz istek → 403 + audit log).

## Proje Durumu

**Faz 8 — OTP Gizliliği, Gemini Kalitesi ve Bağımsızlık Doğrulaması:**

- 🔒 **OTP kodu artık hiçbir koşulda API yanıtında/arayüzde dönmüyor** — yalnızca sunucu
  logunda görünür (bkz. "Müşteri OTP Doğrulaması"). Gerçek bir Telegram Bot API entegrasyonu
  uçtan uca denenip çalıştırıldı, ancak Telegram'ın kaçınılmaz "önce kullanıcı botu başlatmalı"
  kısıtlaması demoya gereksiz bir adım eklediği için bilinçli olarak sadeleştirildi.
- 🎯 **Gemini prompt kalitesi iyileştirildi:** Model artık jenerik kurumsal cümleler yerine
  somut teknik hipotezler üretiyor (örn. "elektrik kesintisi", "soğutma sistemi arızası") ve
  uygulanabilir öneriler veriyor; canlı test edildi.
- ✅ **Liderlik tablosu zenginleştirildi:** Demo senaryosu artık 3 farklı teknisyeni tam yaşam
  döngüsünden geçiriyor (farklı puan/rozet/değerlendirme kombinasyonlarıyla) — tek kişilik değil,
  gerçekçi bir liderlik tablosu.
- ✅ **Bağımsızlık ilkesi 4 servisin her biri için ayrı ayrı canlı doğrulandı:** AI, Gamification,
  Identity, Incident — her biri tek tek durduruldu; her durumda geri kalan sistem çalışmaya devam
  etti (Identity kapalıyken bile mevcut JWT'ler RS256 public key ile yerel doğrulandığı için
  incident/dashboard işlemleri kesintisiz sürdü). Gamification kapalıyken çözülen bir vaka
  kuyrukta bekleyip servis geri gelince otomatik işlendi (durability testi).
- ✅ Gerçek Turkcell marka logosu kullanılıyor (yer tutucu değil).

**Faz 7 — Uçtan Uca Denetim ve Kritik Güvenlik Düzeltmesi:**

Case dokümanının Bölüm 4 (Incident), 6 (Gamification), 7 (Dashboard), 10 (Güvenlik) ve 11 (Demo
akışları) satır satır kod karşısında denetlendi; bulunan gerçek eksiklikler giderildi:

- 🔒 **Kritik güvenlik düzeltmesi:** Refresh token reuse-detection'da rotasyondaki kardeş token
  iptal edilmiyordu (TypeORM `update()` kriterinde düz `null` → `IsNull()` operatörüne çevrildi).
  Canlı saldırı simülasyonuyla bulundu, düzeltildi, regresyon testiyle kilitlendi. Detay: yukarıdaki
  "Güvenlik" bölümü.
- ✅ **Case 4.2 state machine düzeltmesi:** `PARCA_BEKLENIYOR → MUDAHALE_EDILIYOR` geçişinin
  "Kim Yapabilir" hanesi case'de "Sistem"dir; kod saha teknisyenine izin veriyordu. Artık NOC/
  Süpervizör (parça tedarikini doğrulayan taraf) yapıyor, `incident.parts.supplied` event'i
  gerçekten yayınlanıyor (önceden "bonus/gelecek" olarak işaretliydi).
- ✅ **Case 4.3 öncelik matrisi gerçek kapsama verisiyle çalışıyor** (yukarıda detaylı).
- ✅ **Case 3.4/10 audit log genişletildi:** IDOR denemeleri (`IDOR_DENEMESI`) ve KRITIK öncelik
  değişiklikleri (`ONCELIK_KRITIK_DEGISIGI`, `VAKA_KRITIK_DURUM_DEGISIKLIGI`) artık merkezi audit
  log'a düşüyor — önceden yalnızca rol-bazlı 403'ler loglanıyordu.
- ✅ **Case 7 dashboard eksikleri giderildi:** "Öncelik dağılımı VE TREND" — son 14 günün günlük
  öncelik kırılımı artık yığılmış alan grafiğiyle gösteriliyor (önceden yalnızca anlık dağılım
  vardı). "AI doğruluk metriği (false alarm oranı dahil)" — yanlış alarm oranı artık hesaplanıp
  gösteriliyor. "KRITIK vaka süpervizör panelinde en üstte görünür" — SLA aşmış aktif vakalar artık
  panelin en tepesinde öncelik sıralı bir liste olarak render ediliyor (önceden yalnızca bir sayıydı).
- ✅ **Manuel atama UI'ı eklendi:** Backend'de tam çalışan `PATCH /incidents/:id/assign` endpoint'i
  arayüzde hiçbir yerden tetiklenemiyordu. Vaka detayında (Süpervizör) ekip seçimli bir "Manuel
  Atama" kartı eklendi; dashboard'daki bekleyen kuyruktan da tek tıkla vaka detayına gidilebiliyor.
- ✅ **Case 6.4 profil ekranı tamamlandı:** "Günlük/haftalık sıralama" isteniyordu, yalnızca günlük
  gösteriliyordu — artık ikisi de (toggle ile) görünüyor.
- ✅ **Gemini analizi artık mesaj thread'inde otomatik görünüyor:** Önceden yalnızca manuel
  tıklamayla görülebilen bir panel iken, şimdi vaka oluşur oluşmaz müşterinin şikayeti + AI'ın
  "büyük ihtimalle X alanında sorun olabilir" analizi WhatsApp tarzı sohbette bir mesaj gibi
  otomatik beliriyor (NOC/teknisyen ekstra tıklama yapmadan görür).
- ✅ **Turkcell resmi logosu** kullanılıyor (sidebar, giriş ekranı, favicon) — yer tutucu amblem yerine.
- ✅ Bağımsızlık testi bu turda da yeniden doğrulandı: `docker stop ai-service` sırasında telemetri
  yine BELIRSIZ/ORTA vaka açıyor, UI'da amber uyarı bandı çıkıyor, sistemin geri kalanı çalışmaya
  devam ediyor.

**Faz 6 — AI Derinleştirme + Turkcell Kurumsal Kimlik:**

- ✅ **Üçüncü ML modeli:** Eskalasyon riski — **gerçek Kaggle verisiyle** (Telstra) eğitildi;
  tahmin yanıtında ve müşteri sonuç panelinde DUSUK/ORTA/YUKSEK göstergesi
- ✅ **Gemini LLM şikayet ön analizi:** yapılandırılmış JSON çıktı, Docker secret ile anahtar
  yönetimi, zarif kapanma
- ✅ **Gerçek veri kalibrasyonu:** İTÜ 5G sürüş testi ölçümleriyle sentetik üretici kalibre edildi
- ✅ **Çoklu-durak rota planlama:** Bir ekipte birden fazla vaka varsa en-yakın-komşu turu +
  durak sırası rozetleri + her istasyona planlanan varış/kalış/ayrılış saatleri (haritada ve
  "Rota Programı" panelinde); canlı araç animasyonu artık ekip başına
- ✅ **Turkcell kurumsal kimlik:** resmi sarı (#FFC900) + lacivert palet, amblem, favicon,
  giriş/kenar çubuğu markalama
- ✅ **Admin görünürlüğü genişletildi:** dashboard + tüm vakalar (salt-okur), case matrisiyle uyumlu

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

> **Gemini (opsiyonel):** Müşteri şikayeti AI ön analizi için kendi Gemini anahtarınızı
> `secrets/gemini_api_key.txt` dosyasına yazın (bkz. yukarıda "Gemini API Anahtarı Kurulumu").
> Boş bırakılırsa sistem tam çalışır, yalnızca bu özellik kapalı kalır.

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
| Müşteri | 05551234567 | OTP: e-posta girilmezse/SMTP yoksa kod ekranda gösterilir (varsayılan `1234`); e-posta + SMTP varsa gerçekten gönderilir — bkz. "Müşteri OTP Doğrulaması" |

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
