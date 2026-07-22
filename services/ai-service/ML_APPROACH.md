# AI Service — Yaklaşım ve Metodoloji Dokümanı

Bu doküman, NetOpsCell'in AI Service bileşeninin veri, model seçimi, eğitim/doğrulama süreci ve
inference mimarisini; kullanılan gerçek sayılarla birlikte anlatır. Servisin genel sorumluluğu ve
endpoint listesi için bkz. [`README.md`](./README.md).

## 1. Problem Tanımı

AI Service üç görevi yerine getirir:

1. **Arıza olasılığı tahmini** — telemetri verisinden `P(arıza)` (0.0-1.0)
2. **Arıza türü sınıflandırma** — 6 sınıf: `NORMAL, DONANIM, GUC_KESINTISI, BAGLANTI, YAZILIM, ISINMA`
3. **Akıllı saha ekibi ataması** — ML değil, deterministik ağırlıklı skorlama formülü

## 2. Veri Seti

Case, gerçek şebeke arıza verisi sağlamadığı için sentetik bir veri seti üretilmiştir
(`scripts/generate_dataset.py` → `data/synthetic_telemetry.csv`). Bu bilinçli bir tercihtir:
gerçek dünyada bu tür veri hassas/gizli olur ve hackathon kapsamında erişilebilir değildir; bu
yüzden **her sınıf için ayrı, parametrik bir üretici fonksiyon** yazılarak gerçekçi bir dağılım
taklit edilmiştir, tesadüfi gürültü değil.

**Ham özellikler:** `signal_strength` (dBm), `packet_loss` (%), `temperature` (°C), `power_status`
(NORMAL/UNSTABLE/OUTAGE), `historical_fault_count` (son 30 gün, aynı istasyon).

**Türetilmiş özellikler (feature engineering):** `temperature_trend`, `signal_delta`,
`packet_loss_ma` (hareketli ortalama), `is_power_unstable`, `fault_recency_score`. Bunlar ham
metriklerin tek başına ayırt edemediği durumları (örn. kademeli ısınma ile ani güç kesintisini)
birbirinden ayırmak için eklenmiştir.

**Sınıf başına üretim mantığı özeti:**

| Sınıf | Karakteristik patern |
|---|---|
| `NORMAL` | Tüm metrikler stabil aralıkta |
| `ISINMA` | Sıcaklık kademeli/hızlı yükseliyor, pozitif trend |
| `GUC_KESINTISI` | `power_status ∈ {UNSTABLE, OUTAGE}`, sinyal ani düşer |
| `BAGLANTI` | Zayıf sinyal + yüksek paket kaybı |
| `YAZILIM` | Düzensiz, fiziksel metrik bozulması olmayan osilasyon; `historical_fault_count` yüksek |
| `DONANIM` | Birden fazla metrik aynı anda kalıcı biçimde bozuk |

**Gerçek üretilen veri seti (v2):** 1.500 örnek, 6 sınıfa dengeli dağılım (250/sınıf). Her
sınıfın örneklerinin **%12'si "zor örnek"tir**: gerçek sahada birbirine karışan sınıf çiftlerinin
(ISINMA↔DONANIM, BAGLANTI↔GUC_KESINTISI, YAZILIM↔NORMAL) sayısal özellikleri %65–85 oranında
harmanlanarak sınır bölgesinde üretilir — etiket ana sınıfta kalır. Bu, modelin ezber yerine
karar sınırlarını öğrenmesini zorlar ve test metriklerinin yapay biçimde şişmesini önler.
Üretim deterministik bir `random_seed` ile yapılır — aynı komut her zaman aynı veri setini
üretir (tekrarlanabilirlik ve savunulabilirlik için).

**Gerçek veriyle kalibrasyon (v2.1):** NORMAL sınıfın sinyal dağılımı, repodaki **gerçek İTÜ
kampüsü 5G sürüş testi ölçümlerinden** kalibre edilmiştir (`docs/Raw/5G Saha Ölçüm Verileri/
5G_DL.xlsx`, n=1.943): RSRP ortalama −92.6 dBm, medyan −87, σ 20.8, aralık [−150.6, −50.8].
Önceki N(−70,5) varsayımı gerçek sahaya göre fazla iyimserdi; v2.1'de sağlıklı istasyon medyan
çevresinde N(−85,10) olarak güncellendi (uç zayıf ölçümler kapsama kenarından gelir, istasyon
sağlığını temsil etmez — bu yüzden std daraltıldı).

Aynı script ikinci bir veri seti daha üretir: `data/synthetic_resolution.csv` (2.400 örnek) —
çözüm süresi regresyon modeli için, bkz. Bölüm 10. Üçüncü model (eskalasyon riski) ise
**gerçek Kaggle verisiyle** eğitilir: bkz. Bölüm 11.

## 3. Model Seçimi

Üç aday algoritma, **5-fold stratified cross-validation** ile karşılaştırılmıştır. Metrik olarak
accuracy değil **macro-F1** esas alınmıştır çünkü sınıflar dengeli olsa da bir arızayı kaçırmanın
(yanlış negatif) maliyeti yanlış alarmdan çok daha yüksektir.

**Gerçek çapraz doğrulama sonuçları (`models/model_v1_metrics.json`):**

| Model | Ortalama macro-F1 | Std. sapma |
|---|---|---|
| LogisticRegression (baseline) | 0.9665 | ±0.007 |
| **RandomForestClassifier (seçilen)** | **0.9733** | ±0.011 |
| GradientBoostingClassifier | 0.9716 | ±0.011 |

RandomForest v2 veri setinde de en yüksek ortalama CV skorunu verdi ve seçildi.

**Nihai test seti performansı** (1.200 eğitim / 300 test örneği, %80/%20 stratified split):

- **Test macro-F1: 0.957** — v1'deki 0.979'dan daha düşük görünür ama bu bilinçlidir: v2 veri
  setindeki %12 sınır-bölgesi örneği problemi zorlaştırır; 0.96'lık skor "kolay veri üzerinde
  şişirilmiş metrik" değil, gerçekçi belirsizlik altında ölçülmüş performanstır.
- Confusion matrix'teki karışıklıklar tamamen beklenen sinir bölgelerindedir: NORMAL↔YAZILIM
  (düşük genlikli aralıklı hata normal gürültüsüne benzer) ve DONANIM↔ISINMA (aşırı ısınan
  donanım). Fiziksel olarak ayrık sınıflarda (GUC_KESINTISI, BAGLANTI) hata yoktur.

**Açıklanabilirlik (feature importance, RandomForest `feature_importances_`):**

| Özellik | Önem |
|---|---|
| `temperature` | 0.220 |
| `packet_loss` | 0.156 |
| `packet_loss_ma` | 0.137 |
| `power_status_NORMAL` | 0.128 |
| `signal_strength` | 0.105 |
| `temperature_trend` | 0.087 |
| `signal_delta` | 0.068 |
| `power_status_OUTAGE` | 0.033 |
| `historical_fault_count` | 0.025 |
| `fault_recency_score` | 0.024 |
| `power_status_UNSTABLE` | 0.017 |

Sıcaklık ve paket kaybı (ham + hareketli ortalama) modelin kararında en belirleyici özellikler —
bu, ISINMA/BAGLANTI ayrımının veri setinde beklendiği gibi güçlü sinyallerle temsil edildiğini
doğrular.

**Ön işleme:** Seçilen model, `StandardScaler` (sürekli değişkenler) + `OneHotEncoder`
(`power_status`) adımlarıyla birlikte tek bir `scikit-learn Pipeline` nesnesi olarak
serileştirilir (`joblib`) — eğitim ve inference arasında özellik dönüşüm tutarsızlığı riski
ortadan kalkar.

## 4. Kural Katmanı (Hibrit Yaklaşım)

Model ham çıktısı üzerine iki kural katmanı uygulanır (`app/ml/rules.py`):

- **Eşik yönlendirme:** `< 0.40` → İZLE, `0.40–0.85` → VAKA_AC (NOC onayına düşer), `≥ 0.85` →
  ACIL (otomatik vaka açılır)
- **Güvenlik ağı:** `power_status = OUTAGE` ise, modelin tahminine bakılmaksızın
  `GUC_KESINTISI` + `probability ≥ 0.9` garanti edilir — canlı demoda modelin beklenmedik bir
  tahmin vermesi riskine karşı bir güvence katmanıdır, aynı zamanda "kural + ML hibrit" yaklaşımı
  bonus koşulunu karşılar

Bu iki kural da `tests/test_rules.py` içinde birim testlerle doğrulanmıştır.

## 5. Akıllı Saha Ekibi Ataması (ML Değil, Deterministik Skorlama)

```
skor = (uzmanlik_eslesme × 0.4) + (mesafe_yakinlik × 0.3) + (bosluk_orani × 0.3)
```

- `uzmanlik_eslesme`: ekip uzmanlığı arıza türüyle eşleşiyorsa 1, değilse 0
- `mesafe_yakinlik`: Haversine formülü ile ekip–arıza konumu yakınlığı (1'den 0'a lineer azalan)
- `bosluk_orani`: `1 - (aktif_vaka_sayisi / maksimum_kapasite)` (varsayılan kapasite: 5)
- Ağırlıklar `SCORE_WEIGHT_*` ortam değişkenleriyle konfigüre edilebilir

Bu bilinçli olarak ML **değil** deterministik bir formüldür: atama mantığının denetlenebilir,
açıklanabilir ve jüri/operasyon ekibi tarafından anında doğrulanabilir olması gerekir — bir "kara
kutu" modelin hangi ekibi neden seçtiğini tahmin etmek zorunda kalmak operasyonel güveni azaltır.
Tüm formül `tests/test_scoring.py` içinde birim testlerle doğrulanmıştır (Haversine mesafesi,
yakınlık/boşluk oranı sınır davranışları, uçtan uca skor hesaplama).

## 6. Eğitim, Doğrulama ve Model Kalite Kapısı (Faz 3)

`scripts/train_model.py`:

1. Veri setini yükler, kalite kontrolü yapar (NaN kontrolü, sınıf başına minimum örnek sayısı,
   eksik sınıf tespiti) — bozuk/eksik bir veri setiyle sessizce eğitim yapılmasını engeller
2. Veri setinin SHA-256 **fingerprint**'ini hesaplar ve metriklerle birlikte kaydeder — hangi
   modelin hangi tam veri setiyle eğitildiği geriye dönük izlenebilir
3. 5-fold CV ile 3 aday modeli karşılaştırır, en iyi macro-F1'e sahip olanı seçer
4. **Kalite kapısı:** yeni eğitilen modelin test macro-F1'i, ortam değişkeni
   `MIN_ACCEPTABLE_MACRO_F1` (varsayılan 0.85) eşiğinin altındaysa, script mevcut üretim modelinin
   üzerine yazmadan hata koduyla sonlanır — bu, bir regresyonun fark edilmeden üretime çıkmasını
   engeller
5. Model `joblib` ile serileştirilir (`models/model_v{n}.joblib`); versiyon + tüm metrikler
   (macro-F1, confusion matrix, feature importance, fingerprint) `model_registry` tablosuna
   yazılır ve `GET /api/v1/ai/model-info` ile sorgulanabilir

## 7. Inference Mimarisi (`POST /api/v1/ai/predict`)

1. FastAPI başlangıcında (`lifespan`) model ve preprocessing pipeline belleğe yüklenir — her
   istekte diskten okuma yapılmaz (düşük gecikme hedefi: <200ms)
2. Gelen telemetri türetilmiş özelliklere dönüştürülür
3. Model tahmini (`predict_proba`) + kural katmanı son işlemesi uygulanır
4. Sonuç `predictions` tablosuna `model_version` ile loglanır (izlenebilirlik)

## 8. Runtime Doğrulama ve Sürdürülebilirlik

- NOC/Süpervizör'ün yaptığı tür/kategori override'ları `misclassifications` tablosuna düşer
- Genel doğruluk: `GET /api/v1/ai/accuracy` — `(toplam_tahmin - misclassification) / toplam × 100`
- **Kategori bazlı kırılım:** `GET /api/v1/ai/accuracy/by-category` (+ Süpervizör dashboard'da
  görsel panel, Faz 4) — hangi arıza türünde model daha çok yanılıyor, tek tek görünür kılınır
- **Model registry + kalite kapısı** (Bölüm 6), modelin zamanla sessizce kötüleşmesine
  (model drift) karşı ilk savunma hattıdır; üretim ortamında bir sonraki adım, canlı doğruluk
  oranı belli bir eşiğin altına düştüğünde otomatik uyarı (Prometheus/Alertmanager, bkz.
  `docs/ARCHITECTURE.md` Bölüm 22) ve periyodik yeniden eğitim pipeline'ıdır.

## 10. İkinci Model: Çözüm Süresi Tahmini (ETA Regresyonu)

Sınıflandırıcıdan tamamen bağımsız ikinci bir ML modeli, atama anında **sahadaki iş süresini
(dakika)** tahmin eder (`app/ml/eta.py`, eğitim: `scripts/train_eta_model.py`, model dosyası:
`models/eta_model_v1.joblib`).

**Neden ayrı model?** Arıza türü tahmini bir *sınıflandırma*, süre tahmini bir *regresyon*
problemidir; özellik kümeleri de farklıdır (telemetri paterni vs. operasyonel bağlam). Tek
modele iki görev yüklemek yerine her görev için doğru problem formülasyonu seçildi.

**Özellikler (atama anında bilinenler):** `fault_type`, `priority`, `distance_km` (ekip üssü →
vaka, haversine), `hour_of_day`, `is_weekend`, `historical_fault_count`.

**Veri üretim süreci** (`data/synthetic_resolution.csv`, 2.400 örnek): arıza türüne göre taban
iş süresi (ör. DONANIM ~150 dk, YAZILIM ~55 dk), öncelik kaynak çarpanı (KRİTİK vakaya ek kaynak
→ ×0.85), gece vardiyası (×1.15) ve hafta sonu (×1.08) etkisi, kronik istasyonlarda uzayan tanı
süresi. Kritik tasarım kararı: **yedek parça ihtiyacı gizli (latent) değişkendir** — veri
üretiminde süreye eklenir (tür bazlı olasılıkla +N(60,20) dk) ama modele özellik olarak
VERİLMEZ. Bu, gerçek dünyadaki indirgenemez belirsizliği (aleatoric uncertainty) temsil eder ve
metriklerin dürüst kalmasını sağlar.

**Gerçek sonuçlar (`models/eta_model_v1_metrics.json`), 5-fold CV + %20 test:**

| Model | CV MAE (dk) |
|---|---|
| **Ridge (seçilen)** | **34.55** |
| GradientBoostingRegressor | 34.79 |
| RandomForestRegressor | 35.08 |

- **Test MAE: 32.9 dk · RMSE: 42.8 dk · R²: 0.49**
- R²'nin ~0.5 olması modelin zayıflığı değil, problemin doğası gereğidir: varyansın kalan kısmı
  bilinçli olarak modele verilmeyen latent parça değişkeninden gelir. Ağaç tabanlı modellerin
  Ridge'i geçememesi de bunun kanıtıdır — öğrenilebilir yapı büyük ölçüde doğrusaldır (tür +
  öncelik + mesafe ana etkileri), gerisi indirgenemez gürültüdür.
- Kalite kapısı: test MAE > 40 dk ise model kaydedilmez, mevcut model korunur.

**Yol süresi ayrı ve deterministik hesaplanır:** `5 dk hazırlık + (mesafe × 1.35 yol kıvrım
faktörü) / 34 km/s şehir içi ortalama hız`. Frontend'deki canlı araç animasyonu aynı varsayımları
paylaşır — haritadaki ilerleme ile ETA tutarlıdır. `/api/v1/ai/assign` yanıtı `travel_minutes`,
`work_minutes`, `total_eta_minutes` alanlarını döner; manuel atama için bağımsız
`POST /api/v1/ai/estimate` endpoint'i vardır.

## 11. Üçüncü Model: Eskalasyon Riski (GERÇEK Kaggle Verisi — Telstra)

**Veri seti:** [Telstra Network Disruptions](https://www.kaggle.com/c/telstra-recruiting-network)
(Kaggle yarışması) — Avustralya'nın en büyük telekom operatörünün gerçek şebeke log/arıza verisi.
Yerel kopya: `data/telstra/` (train.csv 7.381 örnek + event/log/resource/severity tabloları).
Hedef: `fault_severity` ∈ {0: arıza yok/önemsiz (%64.8), 1: lokal arıza (%25.4), 2: kritik (%9.8)}.

**Özellik mühendisliği:** id başına olay/log/kaynak tablolarından toplam sayı, çeşitlilik ve
hacim özellikleri (`event_count`, `distinct_event_types`, `log_count`, `distinct_log_features`,
`log_volume_sum`, `resource_count`, `severity_type_ord`). Yarışmada skoru şişiren
**konum-encoding gibi sızıntı (leakage) eğilimli özellikler bilinçli olarak dışlandı** — model
üretimde istasyon geçmişinden türetilebilen özelliklerle sınırlı tutuldu.

**Gerçek sonuçlar** (`models/severity_model_v1_metrics.json`, 5-fold CV + %20 stratified test):

| Model | CV macro-F1 |
|---|---|
| **RandomForest (seçilen, class_weight=balanced)** | **0.568** |
| GradientBoosting | 0.508 |
| LogisticRegression | 0.466 |

- **Test macro-F1 0.561 · accuracy 0.594 · logloss 0.781**
- Kritik sınıf (2) **recall 0.82** — `class_weight=balanced` tercihiyle bilinçli olarak "kritik
  arızayı kaçırmamak" optimize edildi (operasyonel maliyet asimetrisi: kaçan kritik arıza,
  yanlış alarmdan çok daha pahalıdır). Bunun bedeli genel accuracy'nin düşmesidir ve bu takas
  bilinçlidir.
- **Alan uyarlaması (domain adaptation) sınırı — dürüst beyan:** model Telstra'nın log-tabanlı
  özellikleriyle eğitilmiştir; NetOpsCell çalışma anında aynı ölçekte benzer anlamlı özellikleri
  istasyonun tahmin geçmişinden türetir (eşleme `app/ml/severity.py` docstring'inde satır satır
  belgelidir). Bu bir "risk göstergesi"dir: SLA önceliğini değiştirmez, NOC'a yardımcı sinyal
  olarak panelde gösterilir.

## 12. LLM Katmanı: Müşteri Şikayeti Ön Analizi (Gemini)

Müşterinin serbest metin şikayeti (`"evde internet sürekli kopuyor..."`), düşük maliyetli
**gemini-2.5-flash-lite** modeline yapılandırılmış çıktı şemasıyla (`responseSchema`) gönderilir;
model muhtemel arıza alanı (6 sınıftan biri), olası neden, öneri ve güven skoru döner
(`app/llm/gemini.py`, `POST /api/v1/ai/analyze-complaint`).

Tasarım kararları:
- **ML'in yerine geçmez:** LLM çıktısı yalnızca müşteri deneyimi + NOC bağlamı içindir;
  sınıflandırma/öncelik/atama kararları telemetri tabanlı modellerden gelir. Bu izolasyon aynı
  zamanda prompt-injection etki alanını daraltır (müşteri metni "güvenilmeyen girdi" bloğunda,
  talimatlar sabit sistem prompt'unda).
- **Zarif kapanma:** API anahtarı Docker secret'tır (`GEMINI_API_KEY_FILE`); tanımsızsa veya
  çağrı 8 sn'de yanıt vermezse özellik sessizce devre dışı kalır, bildirim akışı asla bloke olmaz.
- **Maliyet:** flash-lite + kısa yapılandırılmış çıktı ≈ istek başına ~300-500 token.

## 13. Bilinçli Sınırlamalar

- Sentetik veri setleri gerçek şebeke verisindeki dağılım kaymalarını (distribution
  shift) tam yansıtmaz; sinyal dağılımı gerçek İTÜ 5G sürüş testi ölçümleriyle kalibre
  edilmiştir (Bölüm 2) ancak üretime geçişte gerçek etiketli veriyle yeniden eğitim şarttır.
- ETA modeli gerçekleşen süre geri beslemesi toplamaz (kapanan vakaların gerçek süreleri ile
  periyodik yeniden eğitim, üretim yol haritasındadır); şu an `departedAt/arrivedAt` zaman
  damgaları Incident Service'te bu amaçla kaydedilmektedir.
- Sınıflandırma veri setindeki sınır-bölgesi örnekleri sezgisel karışabilirlik çiftlerine
  dayanır; gerçek veride karışıklık matrisinin yapısı farklılaşabilir.
