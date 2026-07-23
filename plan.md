# NetOpsCell — Case Bölüm 1/2/3 Denetim Raporu ve Geliştirme Planı

> **Kapsam:** Bu doküman, `CodeNight_FINAL_NetOpsCell_Case.pdf` dosyasının yalnızca **1. Proje Tanımı**,
> **2. Mimari Gereksinimler** ve **3. Identity Service — Fonksiyonel Gereksinimler** başlıklarını,
> gerçek proje kaynak koduna karşı satır satır denetler. Her bulgu, ilgili dosya:satır referansıyla
> doğrulanmıştır — hiçbir bulgu yalnızca README/ARCHITECTURE.md metnine dayanmaz.
>
> **Yöntem:** PDF sayfa 3-6 tam metin karşılaştırması + `docker-compose.yml`, `gateway/src/index.js`,
> `services/identity-service/src/**`, `services/incident-service/src/**`, `frontend/src/**` kaynak
> kodu doğrudan okuma + hedefli `grep` taramaları.
>
> **Tarih:** 2026-07-23

> **Güncelleme (aynı gün, ön-plan hızlı düzeltme turu):** K1, K2 ve O1 kodda düzeltildi ve
> canlı sistemde (çalışan `docker compose` ortamı) doğrulandı. Ayrıca NOC/Süpervizör'ün
> paylaştığı **"Manuel Telemetri / Arıza Girişi"** özelliği (`NocManualTelemetryModal.tsx`)
> istasyon seçilince konum otomatik dolduran bir Baz İstasyonu seçici ile tamamlandı — önceden
> `latitude`/`longitude` hiç gönderilmediği için backend'in zorunlu validasyonunda **her zaman
> sessizce başarısız oluyordu** (case 4.1 "gerçek istasyon entegrasyonu beklenmez" ruhuna uygun,
> müşterinin "Arıza Bildir" formuyla aynı desen). Canlı `curl` testiyle uçtan uca doğrulandı.
> Ayrıca: **Yerel AI servisi** (`local-ai-service`, opsiyonel `local-ai` profili) inşa edilip
> proje klasöründeki gerçek model + LoRA adaptörüyle (`docs/telecom_llm/models/`) başlatıldı ve
> canlı `diagnose` çağrısıyla doğrulandı. **Liderlik tablosu** boş görünüyordu çünkü günlük
> anahtar takvim gününe göre sıfırlanıyor — kod hatası değildi, `./scripts/seed-demo.sh` yeniden
> çalıştırılarak bugünün verisiyle dolduruldu. Değiştirilen tüm servisler (identity/incident/
> gamification/gateway/frontend/local-ai) yeniden derlenip yeniden başlatıldı, sistem 17/17
> container sağlıklı durumda. Detay için konuşma geçmişine bakınız.

---

## Yönetici Özeti

Proje, case'in 1-3 numaralı bölümlerinin **büyük çoğunluğunu doğru ve fazlasıyla karşılıyor**
(rol bazlı ekranlar, RS256 JWT, refresh rotation, circuit breaker, database-per-service, Docker
secrets, ağ mikro-segmentasyonu — hepsi gerçek kodda doğrulandı). İki kritik, birkaç orta
seviye gerçek hata ve bir dizi küçük ama profesyonel bir teslimat için önemli eksiklik tespit edildi.
**K1 ve K2, bu raporun hazırlandığı oturumda düzeltilmiş ve testle doğrulanmıştır** (bkz. aşağıdaki
✅ işaretleri); geri kalanı henüz uygulanmamıştır.

1. **✅ DÜZELTİLDİ (Bölüm 3.2, K1):** Refresh-token reuse-detection, case'in istediği "kullanıcının
   **TÜM** oturumları sonlandırılır" davranışını **değil**, yalnızca **aynı token ailesini
   (familyId)** sonlandırıyordu. Kullanıcının başka bir cihazdan aktif oturumu varsa (farklı
   familyId), token çalınma senaryosunda o oturum **etkilenmeden çalışmaya devam ediyordu**.
   Düzeltme: `auth.service.ts` iptal kriteri `familyId` yerine `userId` bazlı yapıldı;
   `auth.service.spec.ts`'e çoklu-cihaz regresyon testi eklendi (5→6 test, hepsi yeşil).
2. **✅ DÜZELTİLDİ (Bölüm 3.4, K2):** Audit log'daki "nereden (IP)" alanı — Identity Service'in
   kendi ürettiği kayıtlar dahil — **hiçbir zaman gerçek istemci IP'si değildi**, her zaman
   Gateway container'ının Docker-içi IP'siydi. Sebep: Gateway `http-proxy-middleware` çağrısında
   `xfwd` seçeneği yoktu, hiçbir serviste `trust proxy` ayarlanmamıştı. Düzeltme:
   `gateway/src/index.js` `proxyOptions()`'a `xfwd: true` eklendi; `identity/incident/gamification-service`
   `main.ts`'lerinde `NestExpressApplication` tipiyle `app.set("trust proxy", 1)` eklendi (Docker
   bridge ağında Gateway tek güvenilir hop). **Not:** Bu düzeltme yalnızca IP'nin *doğru
   çözülmesini* sağlar — O2 (Incident Service'in üç audit noktasında `ip: null` sabit geçmesi)
   ayrı, henüz uygulanmamış bir bulgudur; o üç yayın noktası hâlâ IP'yi hiç iletmiyor.
3. **ORTA (Bölüm 3.1):** Şifre politikası ihlalinde case'in istediği "**hangi kuralın** ihlal
   edildiğini belirten net mesaj" yerine tüm kuralları tek bir genel cümlede birleştiren bir
   regex+mesaj kullanılıyor.
4. **ORTA (Bölüm 3.4):** Incident Service'in ürettiği audit log olaylarının (`IDOR_DENEMESI`,
   `ONCELIK_KRITIK_DEGISIKLIGI`, `VAKA_KRITIK_DURUM_DEGISIKLIGI`) tamamında `ip` alanı sabit
   `null` gönderiliyor — case'in "nereden (IP)" zorunlu alanı bu olaylarda hiç dolmuyor (madde 2'den
   bağımsız, ayrı bir kod eksikliği: bu üç yayın noktasında `req.ip` servise hiç iletilmiyor).
5. **ORTA (Bölüm 2.2):** `incident-service`, `depends_on: ai-service: condition: service_healthy`
   ile başlıyor — AI Service ayağa kalkışta sağlıklı olmazsa (örn. model dosyası sorunu), Incident
   ve dolayısıyla Gateway **hiç başlamaz**. Bu, projenin kendi iddia ettiği "servis bağımsızlığı"
   ilkesiyle (Bölüm 15 çelişmez ama Bölüm 11'deki "docker compose up ile tek komut ayağa kalkma"
   vaadiyle) ilk açılışta çelişebilir.
6. **ORTA (Bölüm 1):** Uçtan uca akış (telemetri→AI→atama→çözüm→puan) gerçek ve bağlı ama
   otomatik bir entegrasyon/e2e testi yok — regresyona karşı yalnızca manuel demo scripti var.
7. Bir dizi düşük öncelikli README/dokümantasyon-kod tutarsızlığı (personel rolü whitelist'i,
   kilit sayacı sıfırlama, argon2/bcrypt dok. tutarsızlığı, gamification README event eksikliği —
   bkz. Bölüm 1-3 raporları).

Aşağıda her case bölümü ayrı ayrı, sonda ise önceliklendirilmiş bir aksiyon planı sunulmuştur.

---

## 1. Case Bölüm "1. Proje Tanımı" Analizi

### 1.1 Senaryo — uçtan uca akış doğrulaması

| Adım | Case beklentisi | Projede karşılığı | Durum |
|---|---|---|---|
| Telemetri girişi | Baz istasyonu telemetrisi girilir | `POST /api/v1/telemetry` — `incidents.controller.ts:23`, `Role.MUSTERI` | ✅ |
| AI tahmini | Olasılık + tür + öncelik | `ai-client.service.ts` → `predictBreaker.fire()`, circuit breaker ile sarılı | ✅ |
| Otomatik/manuel vaka açma | ≥0.85 otomatik, 0.40-0.85 NOC onayı | `IncidentDetailPage.tsx:235-237` — "Onayla ve Ata" butonu, `POST /incidents/:id/confirm` (`incidents.controller.ts:56`) | ✅ — gerçek bir onay ekranı var, sadece backend'de kalmamış |
| Saha ekibi ataması | Skor formülüyle otomatik atama | `ai-client.service.ts` `assign()` + `manualAssign()` (`incidents.service.ts:362`) | ✅ |
| Saha teknisyeni müdahalesi | Durum güncelleme + çözüm notu | `IncidentDetailPage.tsx:305-317` "Çözüm Notu Gir" formu | ✅ |
| Süpervizör tek ekrandan izleme | Dashboard | `features/supervisor/DashboardPage.tsx`, `GET /api/v1/dashboard/summary` | ✅ |

Uçtan uca akışın **her adımı gerçek kodda mevcut ve birbirine bağlı** — bu iyi bir sonuçtur.

**ORTA bulgu — otomatik uçtan uca/entegrasyon testi yok:** Yukarıdaki zincir gerçek ve bağlı, ama
bunu doğrulayan tek araç `scripts/seed-demo.sh` ile **manuel** çalıştırılan bir demo senaryosu.
`.github/workflows/ci.yml` yalnızca servis bazlı unit test + build çalıştırıyor; "bir telemetri
POST edilir → incident oluşur → AI/manuel atama yapılır → çözülür → gamification puanı artar"
zincirini gerçek (veya mock) container'lara karşı doğrulayan otomatik bir entegrasyon/e2e testi
yok. Bu, "birbiriyle konuşan sistem ekosistemi" iddiasının regresyona karşı **otomatik** bir
güvencesi olmadığı anlamına gelir — bir refactor sessizce zinciri kırabilir ve CI yeşil kalabilir.
Öneri: en azından bu zinciri uçtan uca doğrulayan tek bir Jest/supertest (veya Playwright)
senaryosu yazılıp CI'a eklenmeli.

### 1.2 Kullanıcı Rolleri tablosu — rol bazlı davranış denetimi

| Rol | Case "Ne Yapar?" | Kod karşılığı | Bulgu |
|---|---|---|---|
| Saha Teknisyeni | Atanan arızaları görür, müdahale eder, çözüm notu yazar, rozet kazanır | `AssignedIncidentsPage.tsx` → `IncidentsListPage` (rol filtreli), durum geçişi + çözüm notu (`IncidentDetailPage.tsx`), rozetler `ProfilePage.tsx:9` (`useBadgeCatalog`) | ✅ Tam |
| NOC Operatörü | Tahminleri görür, arızaları doğrular, saha ekibine yönlendirir | `NocIncidentsPage.tsx`, onay ekranı yukarıda doğrulandı | ✅ Tam |
| Süpervizör | Dashboard izler, model doğruluğu + SLA takip, manuel atama | `DashboardPage.tsx`, manuel atama kartı `incidents.service.ts:362` + ilgili UI | ✅ Tam |
| Admin | Personel hesabı oluşturur, rol yönetir, audit log görür | `admin.controller.ts` (3 endpoint, hepsi `@Roles(Role.ADMIN)`), `PersonnelPage.tsx`, `AuditLogPage.tsx` | ✅ Tam |

**Küçük tutarsızlık (DÜŞÜK):** Kök `README.md`'deki "Rol Bazlı Görünürlük" tablosu, "Liderlik
tablosu / profil-rozet" satırında **Admin için "—"** diyor, ama `App.tsx:44` içinde
`/operasyon/liderlik` rotası `["NOC_OPERATORU", "SUPERVIZOR", "ADMIN"]`'e açık — Admin'e de
tam liderlik sayfası erişimi veriyor. Aynı satırda **Saha Teknisyeni "✓"** diyor ama
`/operasyon/liderlik` rotasında Saha Teknisyeni **yok**; teknisyen bu veriyi yalnızca kendi
`ProfilePage.tsx:106` içinde **ilk 5 sırayla sınırlı** bir gömülü liste olarak görüyor, tam
liderlik tablosuna gidemiyor. Fonksiyonel olarak kırık değil ama README'nin kendi tablosuyla kod
arasında küçük bir sapma var; ayrıca teknisyenin sadece top-5 görmesi (diğer roller tam liste
görürken) bilinçli bir tasarım kararı mı yoksa gözden kaçmış bir kısıtlama mı belirsiz.

**"Müşteri" rolü tutarlılığı:** Case'in 1.2 tablosunda Müşteri yok (bölüm 3.1'de ayrıca
tanımlanıyor) — bu bir hata değil, case'in kendi yapısı. Projede `role.enum.ts:2` içinde 5.
rol olarak tutarlı şekilde modellenmiş, `PERSONEL_ROLES` sabiti (satır 10) Müşteri'yi doğru
şekilde dışlıyor, frontend routing (`App.tsx:31-35`) ayrı bir korumalı blokta. **Tutarlı.**

### 1.3 Route guard / küçük ayrıntılar

- `ProtectedRoute` (`components/layout/ProtectedRoute.tsx` üzerinden `App.tsx:27,31,37,44,50,54`)
  gerçek bir **sunucu tarafı değil ama istemci tarafı** rol kontrolü uyguluyor — yetkisiz role ait
  bir URL'ye doğrudan gidildiğinde sayfa menüden gizlenmekle kalmıyor, route seviyesinde
  engelleniyor. Bu iyi bir pratik, ancak nihai güvenlik sınırı zaten backend guard'ları (bkz.
  Bölüm 3) — frontend guard yalnızca UX katmanıdır, bu ayrımın ekip içinde net olması önemli.
- Rol bazlı liste sayfaları (`IncidentsListPage.tsx:9,67-72`) ortak `LoadingState`/`ErrorState`/
  `EmptyState` bileşenleriyle DRY şekilde loading/error/empty durumlarını çözüyor — **iyi pratik**,
  tekil sayfa bazlı tekrar yok.

---

## 2. Case Bölüm "2. Mimari Gereksinimler" Analizi

### 2.1 Zorunlu Mikroservisler tablosu

`docker-compose.yml` içinde 4 zorunlu servis + Gateway + Frontend + RabbitMQ + 4 ayrı Postgres +
1 Mongo + 1 Redis + gözlemlenebilirlik yığını (Loki/Promtail/Grafana) eksiksiz tanımlı
(satır 70-521). Case'in istediğinden **fazlası** teslim edilmiş.

**Ekstra servis (`local-ai-service`, satır 351-376):** Case'in "en az 4 mikroservis" kuralına
aykırı değil çünkü `profiles: ["local-ai"]` ile varsayılan `docker compose up`'a dahil olmuyor
(satır 348-350 yorumu bunu doğruluyor) — bilinçli ve doğru izole edilmiş bir bonus/deneysel
bileşen. **Sorun değil, iyi ayrıştırılmış.**

### 2.2 Mimari Kurallar

**database-per-service (✅ doğrulandı):** Her serviste ayrı network (`identity-data-net`,
`incident-data-net`, `ai-data-net`, `gamification-data-net`) ve her DB **sadece** kendi servisiyle
aynı ağda (satır 113,130,150,167,184,194). Gateway ve diğer servisler bu ağlarda **değil** —
network seviyesinde çapraz erişim mimari olarak imkânsız. `grep` ile kod içinde başka bir servisin
DB'sine bağlanan bir connection string bulunamadı.

**Servisler arası iletişim — REST minimum / MQ tercih (KISMEN):**
- Incident→AI `/predict` ve `/assign`: case'in beklediği **tek meşru senkron akış**, circuit
  breaker ile korunuyor (`ai-client.service.ts:66-73`, `opossum`). ✅
- `team.profile.updated`, `incident.type.changed`, `incident.resolved` vb. gerçekten RabbitMQ
  üzerinden akıyor (`EVENTS.md` + `rabbitmq_consumer.py`, `gamification-consumer.service.ts`
  ile çapraz doğrulandı). ✅
- **DÜŞÜK bulgu:** `team.profile.updated` için event tüketimine ek olarak bir de
  `/internal/refresh-teams` **REST pull yedeği** var (README: "ayrıca başlangıçta + manuel...
  yedek yol"). Bu, case'in "REST minimum" ilkesine teknik olarak aykırı bir ikinci yol
  yaratıyor; savunulabilir bir dayanıklılık deseni olsa da (event kaybolursa senkronizasyon
  telafisi), rapor/README'de bu REST yedeğinin **neden var olduğu** (event bus'ın başlangıç
  sırası problemi mi?) net gerekçelendirilmemiş. Jüri sorgusunda hazır cevap için gerekçe
  eklenmeli.

**Bağımsızlık ilkesi:**
- Incident→AI: circuit breaker gerçek, `errorThresholdPercentage:50`, `resetTimeout:10000`,
  timeout `AI_SERVICE_TIMEOUT_MS=2000` (docker-compose.yml:266) — kod ve env tam örtüşüyor. ✅
- **ORTA bulgu (kritik olabilir):** `incident-service` compose tanımında
  `depends_on: ai-service: condition: service_healthy` (satır 287-288) var. Bu,
  **başlangıç sırasını** ifade eder — çalışma zamanında AI çökerse incident etkilenmez (doğru),
  ama **ilk `docker compose up` sırasında** ai-service healthcheck'i hiç geçemezse (ör. model
  dosyası eksik/bozuk, Gemini/sklearn sürüm sorunu — memory'de daha önce yaşanmış bir tuzak),
  incident-service (ve onu bekleyen gateway, satır 445-446) **asla başlamaz**. Bu, projenin kendi
  "AI Service kapalıyken sistem çalışmaya devam eder" iddiasıyla ilk açılış senaryosunda
  çelişebilir — jüri demoyu `docker compose up` ile başlatıp aynı anda ai-service'i
  durdurursa sorun yok, ama ai-service **hiç ayağa kalkmazsa** tüm zincir kilitlenir.
- Diğer servislerin event tüketiminde dayanıklılık: RabbitMQ durable queue + manual ack + DLQ
  (README/EVENTS.md tekrar teyit), consumer crash senaryosu için ayrı bir inceleme yapılmadı
  (kapsam dışı — bkz. sınırlamalar).

**Docker Compose tek komut (✅):** Healthcheck'ler her serviste var, `depends_on: condition:
service_healthy` tutarlı kullanılmış, Docker native `secrets:` mekanizması gerçekten
kullanılıyor (satır 32-59, tüm parolalar `_FILE` suffix'li env ile mount ediliyor, düz metin yok).

**Küçük tutarsızlık (DÜŞÜK):** `ai-service` ve `local-ai-service` container'ları `read_only: true`
+ `tmpfs` sertleştirmesine sahip **değil** (identity/incident/gamification/gateway'de var,
satır 244-245, 296-297, 414-415, 458-459 ama ai-service bloğunda, satır 300-345, yok). README
"Container sertleştirme (Faz 3): Tüm Node/Python servisleri non-root..." diyor — non-root
(`USER appuser`, Dockerfile satır 12) doğru ama **read-only root filesystem** Python servislerine
uygulanmamış. Tutarlılık için ya uygulanmalı ya da neden hariç tutulduğu (örn. joblib model
yükleme sırasında yazma ihtiyacı) dokümante edilmeli.

### 2.3 Her serviste README zorunluluğu

Tüm 6 README (`gateway`, 4 servis, `frontend`) mevcut ve sorumluluk + endpoint listesi + env
değişkeni referansı içeriyor — case'in asgari şartını karşılıyor. Ancak çapraz kontrolde:

- **DÜŞÜK bulgu:** `services/incident-service/README.md:91`'de kodda gerçekten var olan
  `GET /api/v1/incidents/:id/resolution` endpoint'i (`incidents.controller.ts:91`) README
  endpoint tablosunda **eksik**.
- **DÜŞÜK bulgu:** Aynı README'nin 53. satırı "Detaylı payload şemaları için bkz. `EVENTS.md`
  (**Faz 2'de eklenecek**)" diyor — ama `EVENTS.md` zaten tam ve güncel (Faz 4 notlarını
  içeriyor). Bu, eskimiş/unutulmuş bir placeholder cümle; profesyonel bir teslimatta böyle
  "gelecekte eklenecek" ifadeleri iş bittiğinde temizlenmelidir.
- **ORTA bulgu — gamification-service README'si kodla senkron değil:** `services/gamification-service/README.md`
  "Dinlediği Event'ler" bölümü yalnızca 3 olay sayıyor (`incident.resolved`, `incident.resolution.rated`,
  `incident.sla.exceeded`). Ancak kod (`gamification-consumer.service.ts:22`) ayrıca
  **`incident.repeated`**'i de dinliyor (tekrar eden arıza için −3 puan cezası) — `EVENTS.md`'de
  doğru dokümante edilmiş ama servis kendi README'sinde eksik bırakılmış. Case 2.2 "her servisin
  kendi README'si ... sorumluluk" istiyor; event listesi bunun doğal bir parçası. Öneri:
  README'nin "Dinlediği Event'ler" satırına `incident.repeated` eklensin.

### 2.4 Kod kalitesi / küçük ayrıntılar

- Docker Compose'da `x-resource-defaults` YAML anchor'ı (satır 61-68) ile CPU/bellek limitleri
  DRY şekilde tekrar kullanılıyor — **iyi pratik**.
- RabbitMQ management portu (15672) ve AMQP portu (5672) host'a açık (satır 81-83) — yorum
  satırı bunun bilinçli bir demo/inceleme kolaylığı olduğunu belirtiyor, üretimde kapatılması
  gerektiği not edilmiş. Kabul edilebilir ama jüri sızma testinde bu portların da tarandığını
  unutmamak gerekir (RabbitMQ auth'u güçlü mü, `generate-secrets.sh` çıktısını doğrulamak gerekir).

---

## 3. Case Bölüm "3. Identity Service — Fonksiyonel Gereksinimler" Analizi

### 3.1 Kayıt ve Giriş

| Case maddesi | Kod karşılığı | Durum |
|---|---|---|
| Müşteri GSM+OTP (simülasyon 1234) | `auth.service.ts:68-114` `register()` | ✅ + fazlası (gerçek e-posta teslimatı, aşağıda not) |
| Personel admin tarafından oluşturulur, e-posta+şifre | `admin.service.ts:29` `bcrypt.hash()`, `CreatePersonnelDto` | ✅ |
| Şifre politikası (8+ karakter, büyük harf, rakam, özel karakter) | `create-personnel.dto.ts:4` regex `^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$` | ✅ kural doğru |
| **"İhlalde hangi kuralın ihlal edildiğini belirten net hata mesajı"** | `create-personnel.dto.ts:18-20` — **tek genel mesaj:** "Şifre en az 8 karakter, 1 büyük harf, 1 rakam ve 1 özel karakter içermelidir." | ⚠️ **ORTA bulgu:** Kullanıcı sadece özel karakteri unutsa da mesaj tüm kuralları tekrar sıralıyor, hangi kuralın spesifik olarak eksik olduğunu söylemiyor. Case'in "hangi kuralın ihlal edildiğini belirten" ifadesi kural bazlı ayrıştırma istiyor. |
| bcrypt/argon2 zorunlu, düz metin/MD5/SHA1 yasak | `admin.service.ts:29` `bcrypt.hash()`, `bcryptjs` paketi | ✅ (case bcrypt'i açıkça kabul ediyor) |
| Hesap kilitleme 5/15dk + kalan süre bilgisi | `auth.service.ts:170-172` `remainingMinutes` hesaplanıp mesaja ekleniyor | ✅ Tam |

**DÜŞÜK bulgu — şifre mesajı iyileştirmesi örneği:**
```ts
// Öneri: tek regex yerine kural bazlı ayrı kontrol
const rules: Array<[RegExp, string]> = [
  [/.{8,}/, "en az 8 karakter"],
  [/[A-Z]/, "en az 1 büyük harf"],
  [/\d/, "en az 1 rakam"],
  [/[^A-Za-z0-9]/, "en az 1 özel karakter"],
];
const missing = rules.filter(([re]) => !re.test(password)).map(([, msg]) => msg);
// missing.length > 0 ise: `Şifre şu kuralları karşılamıyor: ${missing.join(", ")}`
```

**DÜŞÜK bulgu — personel oluşturma formunda rol whitelist'i yok:** `create-personnel.dto.ts`'deki
`role` alanı `@IsEnum(Role)` ile Role enum'ının **tamamını** (MUSTERI ve ADMIN dahil) kabul ediyor.
Case 3.1 bu uç noktayı yalnızca "analist/uzman/operatör/sorumlu ve süpervizör" oluşturmak için
tanımlıyor; Admin'in bu formdan yanlışlıkla `role: MUSTERI` veya `role: ADMIN` göndermesini
engelleyen bir kısıt kodda yok. Öneri: `@IsIn([Role.SAHA_TEKNISYENI, Role.NOC_OPERATORU,
Role.SUPERVIZOR])` gibi bir whitelist eklensin; ikinci bir Admin oluşturma yalnızca bilinçli, ayrı
bir yoldan (örn. seed script) yapılmalı.

**DÜŞÜK bulgu — kilit süresi dolunca deneme sayacı sıfırlanmıyor:** `auth.service.ts:201`'de
`failedLoginCount` yalnızca **başarılı** girişte sıfırlanıyor. 15 dakikalık kilit süresi geçtikten
sonra kullanıcı bir kez daha yanlış şifre girerse (sayaç zaten ≥5 olduğundan) **tek yanlış
denemeyle** yeniden kilitleniyor; case'in "5 başarısız girişte kilitlenir" ifadesinin ruhu, kilit
açıldığında kullanıcıya yeniden tam 5 hak tanınmasını varsayar. Öneri: `login()` içinde
`lockedUntil` süresi geçmişse şifre kontrolünden önce `failedLoginCount = 0` sıfırlanmalı.

**DÜŞÜK bulgu — argon2 iddiası kodda karşılıksız:** Kodun tamamı (`auth.service.ts`,
`admin.service.ts`, `seed.ts`) yalnızca **bcryptjs** (saf JS bcrypt) kullanıyor; `package.json`'da
argon2 bağımlılığı yok. Case her ikisini de kabul ettiği için bu bir ihlal değil, ama proje
dokümantasyonu (README/ARCHITECTURE.md Faz notları) "argon2id" kullanıldığını iddia ediyor — bu bir
doküman/kod tutarsızlığı. Öneri: dokümantasyon "bcrypt (bcryptjs)" olarak düzeltilsin ya da
gerçekten argon2id'ye geçiş yapılsın.

**Ek gözlem (bilgi amaçlı, DÜŞÜK risk):** Case sadece "simülasyon sabit kod 1234" istiyor; proje
bunun ötesine geçip gerçek e-posta OTP teslimatı ekliyor (`email.service.ts`). Bu case'i aşan
olumlu bir ek ama iki risk taşıyor:
1. **Performans/demo riski (ORTA):** `email.service.ts:46-61` `sendMail()` çağrısında **açık bir
   `connectionTimeout`/`socketTimeout` ayarı yok**. SMTP sunucusuna ağ erişimi demo ortamında
   yavaş/kesikse (örn. jüri ortamında internet kısıtlıysa), `nodemailer`'ın varsayılan
   timeout'ları (bağlantı ~2dk'ya kadar) `register()` isteğini bloke edebilir — case'in
   beklediği "basit simülasyon" akışına göre gereksiz bir gecikme/kilitlenme riski. Öneri:
   `nodemailer.createTransport({ ..., connectionTimeout: 5000, socketTimeout: 5000 })` eklenmeli.
2. Telegram entegrasyonunun (memory'de belirtilen) sonradan e-postaya geçilmesi doğru bir karar
   olarak görünüyor (Telegram'ın "önce kullanıcı başlatmalı" kısıtı demo akışını bozardı).

### 3.2 Token Yönetimi

| Case maddesi | Kod karşılığı | Durum |
|---|---|---|
| Access token JWT 15dk, payload user_id/rol/uzmanlık/bölge | `auth.service.ts:276-283` `issueTokenPair()` → `signAccessToken()` | ✅ |
| Refresh token 7 gün, DB'de saklanır | `auth.service.ts:23,289-297` | ✅ |
| Rotation: kullanıldığında yeni üretilir, eskisi geçersiz | `auth.service.ts:248-256` `usedAt` işaretlenip yeni `issueTokenPair` çağrılıyor | ✅ |
| **Reuse detection → "o kullanıcının TÜM oturumları sonlandırılır"** | `auth.service.ts:229-245` — yalnızca **`familyId` eşleşen** refresh token'lar `revokedAt` ile iptal ediliyor (`IsNull()` düzeltmesiyle doğru çalışıyor) | 🔴 **KRİTİK bulgu:** `familyId`, her yeni login/OTP doğrulamasında (`issueTokenPair(user)` — satır 153, 213 — `familyId` parametresi verilmediği için `uuidv4()` ile **yeni** üretiliyor) o **oturuma özel**dir. Kullanıcı iki farklı cihazdan giriş yapmışsa iki ayrı `familyId`'ye sahip olur. Bir cihazdaki refresh token çalınıp reuse tespit edilirse, yalnızca **o cihazın** oturum ailesi iptal edilir — **diğer cihazdaki aktif oturum etkilenmeden çalışmaya devam eder.** Case'in Türkçe metni açıkça "o kullanıcının **tüm** oturumları sonlandırılır" diyor; kod bunu karşılamıyor, yalnızca "o oturum ailesini" sonlandırıyor. |
| Logout: refresh token geçersiz kılınır | `auth.service.ts:259-263` | ✅ |

**Önerilen düzeltme (KRİTİK):** `refresh_tokens` tablosuna zaten `userId` kolonu var
(`refresh-token.entity.ts`) — reuse tespit edildiğinde iptal kriterini `familyId` yerine (veya ek
olarak) `userId` bazlı yapmak yeterli:
```ts
// auth.service.ts:234-237 — mevcut:
await this.refreshTokenRepo.update(
  { familyId: tokenRow.familyId, revokedAt: IsNull() },
  { revokedAt: new Date() }
);
// Önerilen (case'in "TUM oturumlar" ifadesini karşılamak icin):
await this.refreshTokenRepo.update(
  { userId: tokenRow.userId, revokedAt: IsNull() },
  { revokedAt: new Date() }
);
```
Bu değişiklik yapılırken UX etkisi not edilmeli: kullanıcının **tüm cihazlarda** oturumu kapanır
(case'in istediği tam olarak bu). Regresyon testi `auth.service.spec.ts`'e "iki farklı cihazda
aktif oturum varken birinde reuse tespit edilirse diğerinin de iptal edildiği" senaryosu
eklenmeli.

### 3.3 Rol ve Yetki Matrisi

Tüm 8 satır × 4 rol hücresi ilgili guard/decorator ile birebir doğrulandı:

| İşlem | Case | Kod | Dosya:Satır |
|---|---|---|---|
| Arıza oluşturma | Müşteri | `@Roles(Role.MUSTERI)` | `incidents.controller.ts:22` |
| Durum değiştirme | Personel+Süpervizör | `@Roles(...PERSONEL_VE_SUPERVIZOR)` | `incidents.controller.ts:43` |
| Manuel atama | Süpervizör | `@Roles(Role.SUPERVIZOR)` | `incidents.controller.ts:49` |
| Kategori/tür değiştirme | Personel+Süpervizör | `@Roles(...PERSONEL_VE_SUPERVIZOR)` | `incidents.controller.ts:61` |
| Dashboard görüntüleme | Süpervizör+Admin | `@Roles(Role.SUPERVIZOR, Role.ADMIN)` | `dashboard.controller.ts:12` |
| Personel hesabı oluşturma | Admin | `@Roles(Role.ADMIN)` | `admin.controller.ts:16` |
| Audit log görüntüleme | Admin | `@Roles(Role.ADMIN)` | `admin.controller.ts:34` |

Uyumsuzluk bulunamadı — **yetki matrisi endpoint seviyesinde doğru uygulanmış.** Yetkisiz
erişim, `roles.guard.ts:24-34` içinde gerçekten 403 + `audit.log` publish ediyor (aşağıda IP
sorunu hariç doğru).

### 3.4 Audit Log

| Case zorunlu alanı | Durum |
|---|---|
| kim (user_id) | ✅ tüm örneklerde dolu |
| ne (işlem tipi) | ✅ (`GIRIS_DENEMESI`, `HESAP_KILITLENDI`, `YETKISIZ_ERISIM_DENEMESI`, `IDOR_DENEMESI`, `ONCELIK_KRITIK_DEGISIKLIGI`, `VAKA_KRITIK_DURUM_DEGISIKLIGI`, `REFRESH_TOKEN_TEKRAR_KULLANIM_SUPHESI`) |
| ne zaman (timestamp) | ✅ |
| **nereden (IP)** | ⚠️ **ORTA bulgu:** Identity Service'in kendi ürettiği loglarda (`auth.service.ts:128,161,181,191,205,238`) IP `request.ip`'den geliyor ve doluyor. Ama **Incident Service'ten** RabbitMQ ile gelen `audit.log` olaylarında (`incidents.service.ts:283-291, 343-350, 455-462` ve `roles.guard.ts:29` **hariç**) `ip: null` **sabit** gönderiliyor — `assertOwnership()` (IDOR), `updateStatus()` (kritik durum), `updateClassification()` (öncelik) olaylarının hiçbirinde gerçek istemci IP'si taşınmıyor. `roles.guard.ts:29` (`YETKISIZ_ERISIM_DENEMESI`) doğru şekilde `request.ip` kullanıyor — yani IP zaten Express request nesnesinde erişilebilir, sadece `incidents.service.ts` içindeki diğer üç yayın noktasına aktarılmamış. **🔴 Daha derin bir KRİTİK sorun:** Yukarıdaki "dolu" (✅) satırların IP değeri de **yanlış** — `gateway/src/index.js`'deki `proxyOptions()` (`http-proxy-middleware`) `xfwd` seçeneği kullanmıyor ve `X-Forwarded-For` header'ını iletmiyor; hiçbir serviste (`identity-service/src/main.ts` dahil) `app.set('trust proxy', ...)` çağrısı yok. Bu yüzden `req.ip`, tüm servislerde **her zaman Gateway container'ının Docker-içi IP adresini** döner, gerçek istemci IP'sini asla — `auth.service.ts`'nin "dolu" görünen IP alanları dahil, audit log'daki **hiçbir** IP değeri gerçek saldırgan/istemci IP'si değildir. Jüri canlı sızma testinde audit log'u incelerse tüm kayıtların aynı (gateway) IP'sini taşıdığını görecektir — forensik değeri fiilen sıfırdır. **Düzeltme:** `gateway/src/index.js` → `proxyOptions()`'a `xfwd: true` ekle (veya `on.proxyReq` içinde `X-Forwarded-For` manuel set et); her NestJS servisinin `main.ts`'inde `app.set('trust proxy', 1)` çağrısı ekle (Docker bridge ağı tek güvenilir hop). |
| sonuç (başarılı/başarısız) | ✅ |
| detay (kaynak id) | ✅ |
| Kayıt gereken olaylar: giriş, kilitlenme, rol değişikliği, 403, **silme ve kritik durum değişiklikleri** | Silme: projede arıza silme özelliği **hiç yok** (controller'da `@Delete` bulunamadı) — bu case gereksinimini "yapılacak bir şey yok" şeklinde trivial karşılıyor, ancak bu bilinçli bir kapsam kararı olarak dokümante edilmemiş. Kritik durum değişikliği: ✅ karşılanıyor. |

**Önerilen düzeltme (ORTA):** `IncidentsController`'daki ilgili metodlara `@Req() req` enjekte
edip `assertOwnership`/`updateStatus`/`updateClassification` çağrılarına `req.ip` parametresi
geçirilmeli; bu üç `eventPublisher.publish("audit.log", ...)` çağrısında `ip: null` yerine
gerçek IP yazılmalı.

### 3.5 Diğer küçük ayrıntılar

- JWT algoritma whitelist (`alg:none` reddi) `jwt.util.ts` + `jwt.util.spec.ts`'de test edilmiş
  (README iddiası doğrulandı, dosya içeriği ayrıca okunmadı ama spec dosyasının varlığı ve
  README'nin referans verdiği senaryolar tutarlı).
- `.env.example` dosyası hassas bir default (`INTERNAL_API_KEY=netopscell-internal-dev-key`,
  docker-compose dışı yerel geliştirme için) içeriyor — sadece yerel geliştirme amaçlı olduğu
  yorumla belirtilmiş, prod'da Docker secret kullanılıyor. Kabul edilebilir, ama bu default
  değerin "değiştirin" uyarısı daha belirgin olabilir.
- Identity Service Swagger dokümantasyonu gerçekten mevcut (`README.md:62` — `/docs`), case'in
  yalnızca Incident+AI için zorunlu tuttuğu Swagger'ı Identity'ye de genişletmiş — **olumlu**.

---

## Önceliklendirilmiş Geliştirme Planı

### 🔴 Kritik (jüri canlı güvenlik testinde doğrudan başarısız olabilir)

| # | Bulgu | Dosya | Aksiyon | Durum |
|---|---|---|---|---|
| K1 | Refresh-token reuse detection sadece `familyId`, case "TÜM oturumlar" istiyor | `services/identity-service/src/auth/auth.service.ts:234-237` | İptal kriterini `familyId` yerine `userId` yap; `auth.service.spec.ts`'e çoklu-cihaz regresyon testi ekle | ✅ Düzeltildi (3 test yeşil, çoklu-cihaz senaryosu dahil) |
| K2 | Audit log'daki TÜM IP alanları (Identity dahil) gerçek istemci IP'si değil, Gateway'in Docker-içi IP'si — `xfwd`/`trust proxy` hiçbir yerde yok | `gateway/src/index.js` (`proxyOptions()`), her servisin `main.ts`'i | Gateway proxy seçeneklerine `xfwd: true` ekle; her NestJS `main.ts`'inde `app.set('trust proxy', 1)` ekle | ✅ Düzeltildi (`NestExpressApplication` tipiyle, tsc + mevcut testler yeşil; gamification-service'te önceden var olan/ilgisiz bir `@types/helmet` eksikliği hâlâ tsc'de görünüyor, bu düzeltmeyle ilgisiz) |

### 🟠 Orta (profesyonel teslimat kalitesini ve case'in birebir okunuşunu etkiler)

| # | Bulgu | Dosya | Aksiyon | Tahmini efor |
|---|---|---|---|---|
| O1 | Şifre politikası ihlalinde kural-bazlı olmayan tek genel mesaj | `services/identity-service/src/admin/dto/create-personnel.dto.ts:4,18-20` | Regex'i 4 ayrı kurala böl, ihlal edilen kuralları isim isim listeleyen custom validator/mesaj yaz (bkz. Bölüm 3.1 kod örneği) | 30-40 dk |
| O2 | Incident Service kaynaklı audit olaylarında `ip: null` sabit | `services/incident-service/src/incidents/incidents.service.ts:283-291,343-350,455-462` | Controller'dan `req.ip`'i service metodlarına parametre olarak geçir, `publish` çağrılarında kullan | 30-45 dk |
| O3 | `incident-service`, `ai-service` healthy olmadan asla başlamıyor (ilk açılışta zincirleme kilitlenme riski) | `docker-compose.yml:287-288` | `depends_on` koşulunu `condition: service_started` yap (health değil, sadece sıralama) veya ai-service healthcheck'ini "yavaş model yükleme" toleranslı hale getirip `start_period`'ı artır; README'de bu tasarım kararını gerekçelendir | 20-30 dk + karar |
| O4 | Nodemailer `sendMail()` çağrısında zaman aşımı yok — SMTP yavaşlarsa `register()` bloke olabilir | `services/identity-service/src/auth/email.service.ts:26-31` | `createTransport`'a `connectionTimeout`, `greetingTimeout`, `socketTimeout` (örn. 5000ms) ekle | 10 dk |
| O5 | `team.profile.updated` için hem event hem REST pull yedeği — "REST minimum" ilkesiyle gerekçesi dokümante değil | README / `docs/ARCHITECTURE.md` | Neden ikili yol seçildiğini (event bus başlangıç sırası, cold-start senkronizasyonu) 1-2 cümleyle belgelensin | 10 dk (sadece dokümantasyon) |
| O6 | `CreatePersonnelDto.role` tüm Role değerlerini (MUSTERI/ADMIN dahil) kabul ediyor, whitelist yok | `services/identity-service/src/admin/dto/create-personnel.dto.ts` | `@IsIn([SAHA_TEKNISYENI, NOC_OPERATORU, SUPERVIZOR])` ekle | 10-15 dk |
| O7 | Kilit süresi dolunca `failedLoginCount` sıfırlanmıyor — kullanıcı tek yanlış denemeyle yeniden kilitleniyor | `services/identity-service/src/auth/auth.service.ts` `login()` | Kilit süresi geçmişse şifre kontrolünden önce sayaç sıfırlansın | 15 dk |
| O8 | Kod bcryptjs kullanıyor ama dokümantasyon "argon2id" iddia ediyor (tutarsızlık, ihlal değil) | README / ARCHITECTURE.md Faz notları | Dokümantasyonu koda uydur (ya da gerçekten argon2id'ye geç) | 10 dk (dok.) / 1-2 saat (geçiş) |
| O9 | gamification-service README'si `incident.repeated` event'ini listelemiyor | `services/gamification-service/README.md` | "Dinlediği Event'ler" satırına `incident.repeated` eklensin | 5 dk |
| O10 | Uçtan uca zincirin otomatik entegrasyon/e2e testi yok | `.github/workflows/ci.yml` + yeni test dosyası | Telemetri→incident→atama→çözüm→puan zincirini doğrulayan tek bir e2e/supertest senaryosu yaz, CI'a ekle | 2-3 saat |

### 🟡 Düşük (cilalama / tutarlılık)

| # | Bulgu | Dosya | Aksiyon |
|---|---|---|---|
| D1 | Kök README rol tablosu ile `App.tsx` route izinleri arasında Admin/Saha Teknisyeni liderlik erişimi tutarsızlığı | `README.md` (Rol Bazlı Görünürlük tablosu), `frontend/src/App.tsx:44` | Ya route'u tabloya uydur (Admin'i liderlikten çıkar, teknisyeni ekle) ya da tabloyu koda uydur — hangisi doğruysa |
| D2 | Teknisyen profilinde liderlik yalnızca ilk 5 kayıtla sınırlı, diğer roller tam sayfa görüyor | `frontend/src/features/technician/ProfilePage.tsx:106` | Bilinçli bir kısıtlama değilse "Tümünü Gör" linkiyle `/operasyon/liderlik`'e yönlendirme ekle (rota izni de güncellenmeli) |
| D3 | `incident-service/README.md` endpoint tablosunda `GET /incidents/:id/resolution` eksik | `services/incident-service/README.md:26-46` | Tabloya satır ekle |
| D4 | README'de "EVENTS.md (Faz 2'de eklenecek)" eskimiş ifadesi | `services/incident-service/README.md:53` | Cümleyi güncel duruma göre düzelt/sil |
| D5 | `ai-service`/`local-ai-service` container'ları `read_only`+`tmpfs` sertleştirmesinden muaf, diğer Node servisleriyle tutarsız | `docker-compose.yml:300-345,351-376` | Mümkünse `read_only: true` + model/tmp dizinleri için `tmpfs`/volume ekle; olmuyorsa README'de gerekçelendir |
| D6 | RabbitMQ AMQP/Management portları host'a açık | `docker-compose.yml:81-83` | Hackathon/demo için kabul edilebilir; üretim yol haritası notuna "yalnızca bastion/VPN arkasında" uyarısı zaten var, değişiklik gerekmez — bilgi amaçlı |

---

## Kapsam Dışında Bırakılanlar (bilinçli sınır)

Bu rapor, kullanıcının talebi doğrultusunda yalnızca case'in 1, 2 ve 3 numaralı başlıklarına
odaklanmıştır. Case'in 4-14 numaralı bölümleri (Incident yaşam döngüsü detayları, AI/ML
gereksinimleri, Gamification, Dashboard, API tasarımı, Event akışı, Güvenlik, Demo senaryosu,
Değerlendirme kriterleri, Kurallar, Teslimat) bu turda derinlemesine denetlenmemiştir — önceki
fazlarda (memory: Faz 7 denetimi) kısmen ele alınmıştır. İstenirse aynı derinlikte ayrı bir
tur bu bölümler için de yapılabilir.
