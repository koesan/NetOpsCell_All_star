# AI Service

## Sorumluluk

Arıza olasılığı tahmini, arıza türü sınıflandırma, akıllı saha ekibi ataması. Case'in kalbi olan
bileşen — hibrit yaklaşım (kural tabanlı + eğitilmiş ML modeli) kullanır.

Detaylı mimari kararlar için bkz. [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) — Bölüm 4.4, 5.3, 9.

## Durum: Faz 3 tamamlandı

Sentetik veri seti üretildi (240 örnek, 6 sınıf), 3 aday model karşılaştırıldı, model eğitildi ve
`models/model_v1.joblib` olarak **repoya gömüldü** — `docker compose up` ek bir eğitim adımı
gerektirmeden çalışır. `/predict`, `/assign`, `/accuracy` endpoint'leri gerçek veriyle test edildi.

**Faz 3:** Eğitim script'i artık veri seti kalite kontrolü (NaN/eksik sınıf, SHA-256 fingerprint)
ve minimum macro-F1 kalite kapısı içerir (regresyon durumunda üretim modelinin üzerine yazmaz);
model registry veritabanına senkronize edilir ve `GET /api/v1/ai/model-info` ile sorgulanabilir.
Identity/Incident'e giden dahili çağrılar exponential backoff+jitter ile retry edilir
(bkz. `docs/ARCHITECTURE.md` Bölüm 9, 21).

## Endpoint'ler

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/health` | Servis sağlık kontrolü |
| POST | `/api/v1/ai/predict` | Olasılık + tür + öncelik önerisi (Incident Service'ten sync çağrılır) |
| POST | `/api/v1/ai/assign` | Akıllı saha ekibi ataması (skorlama) |
| GET | `/api/v1/ai/accuracy` | Genel doğruluk oranı (Süpervizör dashboard) |
| GET | `/api/v1/ai/accuracy/by-category` | Kategori bazlı doğruluk kırılımı (bonus) |
| POST | `/internal/classification-changed` | Incident Service'ten yanlış sınıflandırma bildirimi |
| POST | `/internal/refresh-teams` | Identity Service'ten `team_cache` manuel senkronu |

## Model Sonuçları (v1)

Gerçek eğitim çıktısı — `models/model_v1_metrics.json` içinde tam detay mevcuttur.

| Aday model | 5-fold CV macro-F1 |
|---|---|
| LogisticRegression | 0.918 |
| **RandomForestClassifier (seçildi)** | **0.969** |
| GradientBoostingClassifier | 0.923 |

- **Test seti macro-F1: 0.979** (192 eğitim / 48 test örneği, stratified split)
- Tek hata: 1 YAZILIM örneği NORMAL olarak sınıflandı (diğer tüm sınıflar %100 doğru)
- En belirleyici özellikler: `temperature` (0.192), `packet_loss` (0.154), `packet_loss_ma` (0.147), `signal_delta` (0.113)

## Dinlediği Event'ler (Faz 2'de gerçek RabbitMQ tüketimine geçecek)

`team.profile.updated` (şu an: başlangıçta + `/internal/refresh-teams` ile senkron REST pull),
`incident.status.changed`, `incident.type.changed` (şu an: `/internal/classification-changed` ile senkron REST)

## Yayınladığı Event'ler

`incident.predicted` (Faz 2)

## AI Yaklaşımı

Ayrıntılı model seçimi, sentetik veri üretim mantığı (sınıf bazlı parametrik üreticiler), eğitim/doğrulama
süreci için [`docs/ARCHITECTURE.md` Bölüm 9](../../docs/ARCHITECTURE.md#9-aiml-bileşeni) bakınız.

## Environment Değişkenleri

Bkz. [`.env.example`](./.env.example)

## Çalıştırma

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Veri setini/modeli yeniden uretmek isterseniz (opsiyonel - repoda hazir gelir):
python -m scripts.generate_dataset
python -m scripts.train_model
```

Swagger dokümantasyonu (otomatik): `http://localhost:8000/docs`
