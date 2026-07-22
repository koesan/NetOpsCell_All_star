# secrets/

Bu dizin **repoya dahil edilmez** (bkz. `.gitignore`). İlk kurulumda çalıştırın:

```bash
./scripts/generate-secrets.sh
```

Bu script şu dosyaları üretir (her biri `chmod 600`, sadece sahibi okuyabilir):

| Dosya | İçerik |
|---|---|
| `identity_db_password.txt`, `incident_db_password.txt`, `ai_db_password.txt`, `gamification_db_password.txt` | PostgreSQL şifreleri |
| `incident_mongo_password.txt` | MongoDB şifresi (saha mesajlaşma veritabanı) |
| `rabbitmq_password.txt` | RabbitMQ uygulama kullanıcısı şifresi |
| `internal_api_key.txt` | Servisler arası dahili endpoint koruma anahtarı |
| `grafana_admin_password.txt` | Grafana admin şifresi (merkezi loglama arayüzü) |
| `jwt_private_key.pem` / `jwt_public_key.pem` | RS256 anahtar çifti (private key sadece Identity Service'e mount edilir) |

`docker-compose.yml`, Docker Compose'un native `secrets:` mekanizmasıyla bu dosyaları
ilgili container'lara **salt-okunur** olarak `/run/secrets/<isim>` altında mount eder —
hiçbir sır artık imaja gömülmez veya düz metin ortam değişkeni olarak taşınmaz.

> **Üretim notu:** Bu script yalnızca Docker Compose tabanlı yerel/değerlendirme ortamı
> içindir. Gerçek üretimde bu adımın yerini HashiCorp Vault, AWS Secrets Manager/KMS veya
> bulut sağlayıcısının kendi secret servisi alır (bkz. `docs/ARCHITECTURE.md` Bölüm 19).
