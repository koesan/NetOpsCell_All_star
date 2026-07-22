#!/usr/bin/env bash
# Faz 3 - Secret ve anahtar yonetimi.
#
# Tum sirlari (DB sifreleri, RabbitMQ kimlik bilgileri, dahili API anahtari, JWT RS256
# anahtar cifti) yerel `secrets/` dizininde dosya olarak uretir. Bu dizin .gitignore
# ile repoya asla dahil edilmez. docker-compose.yml bu dosyalari Docker Compose'un
# native `secrets:` mekanizmasiyla ilgili container'lara /run/secrets/<isim> olarak
# salt-okunur mount eder (bkz. docs/ARCHITECTURE.md Bolum 19 - Secret Yonetimi).
#
# Gercek uretimde bu adim; HashiCorp Vault, AWS Secrets Manager/KMS veya bulut
# saglayicinin kendi secret servisi tarafindan devralinir - bu script sadece
# Docker Compose tabanli yerel/degerlendirme ortami icin bir kolayliktir.
set -euo pipefail

SECRETS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/secrets"
mkdir -p "$SECRETS_DIR"

random_password() {
  openssl rand -base64 24 | tr -d '\n=+/' | cut -c1-32
}

write_if_missing() {
  local path="$1"
  local content="$2"
  if [ -f "$path" ]; then
    echo "  atlaniyor (zaten var): $(basename "$path")"
  else
    printf '%s' "$content" > "$path"
    chmod 644 "$path"
    echo "  olusturuldu: $(basename "$path")"
  fi
}

echo "Secret'lar uretiliyor -> $SECRETS_DIR"

write_if_missing "$SECRETS_DIR/identity_db_password.txt" "$(random_password)"
write_if_missing "$SECRETS_DIR/incident_db_password.txt" "$(random_password)"
write_if_missing "$SECRETS_DIR/ai_db_password.txt" "$(random_password)"
write_if_missing "$SECRETS_DIR/gamification_db_password.txt" "$(random_password)"
write_if_missing "$SECRETS_DIR/incident_mongo_password.txt" "$(random_password)"
write_if_missing "$SECRETS_DIR/rabbitmq_password.txt" "$(random_password)"
write_if_missing "$SECRETS_DIR/internal_api_key.txt" "$(openssl rand -hex 32)"
write_if_missing "$SECRETS_DIR/grafana_admin_password.txt" "$(random_password)"

if [ ! -f "$SECRETS_DIR/jwt_private_key.pem" ]; then
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$SECRETS_DIR/jwt_private_key.pem" 2>/dev/null
  openssl rsa -pubout -in "$SECRETS_DIR/jwt_private_key.pem" -out "$SECRETS_DIR/jwt_public_key.pem" 2>/dev/null
  # Not: Docker Compose (Swarm disi) secret'lari basit bind-mount olarak uygular ve
  # HOST dosya izinlerini/sahipligini oldugu gibi container'a tasir. Container'in
  # calisma zamani kullanicisi (orn. mongo, grafana, node) host kullanicisiyla ayni
  # UID olmayabilecegi icin 600 (sadece sahibi okur) yerine 644 (herkes okur, sadece
  # sahibi yazar) kullanilir - repoya girmedigi ve sadece bu host'ta erisilebilir
  # oldugu icin kabul edilebilir bir tolerans (bkz. ARCHITECTURE.md Bolum 19).
  chmod 644 "$SECRETS_DIR/jwt_private_key.pem"
  chmod 644 "$SECRETS_DIR/jwt_public_key.pem"
  echo "  olusturuldu: jwt_private_key.pem + jwt_public_key.pem (RS256)"
else
  echo "  atlaniyor (zaten var): jwt_private_key.pem"
fi

# Gemini API anahtari disaridan alinir (Google AI Studio) — burada uretilemez.
# Bos placeholder olusturulur ki compose secret mount'u hata vermesin; anahtar
# eklenmezse LLM sikayet analizi ozelligi zarifce kapali kalir (bkz. README "Gemini API").
if [ ! -f "$SECRETS_DIR/gemini_api_key.txt" ]; then
  : > "$SECRETS_DIR/gemini_api_key.txt"
  echo "  olusturuldu: gemini_api_key.txt (BOS - kendi Gemini anahtarinizi bu dosyaya yazin)"
else
  echo "  atlaniyor (zaten var): gemini_api_key.txt"
fi

# Telegram bot token da disaridan alinir (@BotFather) — burada uretilemez.
# Bos birakilirsa gercek OTP teslimati devre disi kalir, yerel simulasyon fallback'i calisir.
if [ ! -f "$SECRETS_DIR/telegram_bot_token.txt" ]; then
  : > "$SECRETS_DIR/telegram_bot_token.txt"
  echo "  olusturuldu: telegram_bot_token.txt (BOS - kendi Telegram bot token'inizi bu dosyaya yazin)"
else
  echo "  atlaniyor (zaten var): telegram_bot_token.txt"
fi

echo "Tamamlandi. Simdi: docker compose up --build"
