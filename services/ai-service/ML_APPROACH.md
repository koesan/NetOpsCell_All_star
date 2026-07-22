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

**Gerçek üretilen veri seti:** 240 örnek, 6 sınıfa dengeli dağılım (~40/sınıf), ±%15 gürültü
enjekte edilmiş (overfitting'i önlemek ve sınır durumları temsil etmek için). Üretim
deterministik bir `random_seed` ile yapılır — aynı komut her zaman aynı veri setini üretir
(tekrarlanabilirlik ve savunulabilirlik için).

## 3. Model Seçimi

Üç aday algoritma, **5-fold stratified cross-validation** ile karşılaştırılmıştır. Metrik olarak
accuracy değil **macro-F1** esas alınmıştır çünkü sınıflar dengeli olsa da bir arızayı kaçırmanın
(yanlış negatif) maliyeti yanlış alarmdan çok daha yüksektir.

**Gerçek çapraz doğrulama sonuçları (`models/model_v1_metrics.json`):**

| Model | Ortalama macro-F1 | Std. sapma |
|---|---|---|
| LogisticRegression (baseline) | 0.9176 | 0.0256 |
| **RandomForestClassifier (seçilen)** | **0.9690** | 0.0193 |
| GradientBoostingClassifier | 0.9226 | 0.0236 |

RandomForest hem en yüksek ortalama skoru verdi hem de en düşük varyansa sahipti (düşük veri
hacminde daha kararlı) — bu yüzden seçildi.

**Nihai test seti performansı** (192 eğitim / 48 test örneği, %80/%20 stratified split):

- **Test macro-F1: 0.9791**
- **Accuracy: %97.9**
- Sınıf başına F1: DONANIM 1.00, GUC_KESINTISI 1.00, BAGLANTI 1.00, ISINMA 1.00, NORMAL 0.94,
  YAZILIM 0.93
- Confusion matrix'teki tek karışıklık: 1 `YAZILIM` örneği `NORMAL` olarak sınıflandırılmış —
  beklenen bir durum çünkü YAZILIM sınıfı tanım gereği "fiziksel metrik bozulması olmayan"
  düşük genlikli bir patern kullanır, bu yüzden NORMAL'e en yakın sınıftır.

**Açıklanabilirlik (feature importance, RandomForest `feature_importances_`):**

| Özellik | Önem |
|---|---|
| `temperature` | 0.192 |
| `packet_loss` | 0.154 |
| `packet_loss_ma` | 0.147 |
| `signal_delta` | 0.113 |
| `power_status_NORMAL` | 0.100 |
| `signal_strength` | 0.087 |
| `temperature_trend` | 0.086 |
| `power_status_OUTAGE` | 0.060 |
| `historical_fault_count` | 0.026 |
| `fault_recency_score` | 0.025 |
| `power_status_UNSTABLE` | 0.011 |

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

## 9. Bilinçli Sınırlamalar

- Veri seti sentetik olduğu için gerçek şebeke verisindeki dağılım kaymalarını (distribution
  shift) yansıtmaz; üretime geçişte gerçek etiketli veriyle yeniden eğitim şarttır.
- 240 örnek, üretim ölçeğinde küçük bir veri setidir — cross-validation std. sapmasının düşük
  olması (RandomForest için 0.019) bu ölçekte umut verici olsa da, gerçek veriyle çok daha büyük
  bir test seti üzerinde yeniden doğrulanmalıdır.
