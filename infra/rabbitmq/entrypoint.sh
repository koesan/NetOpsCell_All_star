#!/bin/sh
# Faz 3: RabbitMQ'nun resmi imaji RABBITMQ_DEFAULT_PASS_FILE (Docker secrets icin standart
# _FILE konvansiyonu) desteğini kaldirdi (deprecated + hata verip cikiyor). Bu kucuk
# sarmalayici, secret dosyasini okuyup RABBITMQ_DEFAULT_PASS olarak export eder ve
# _FILE degiskenini KALDIRIR (unset) - boylece asil docker-entrypoint.sh deprecated
# degisken kontrolunu tetiklemez. Sifre yine de duz metin olarak docker-compose.yml
# icinde degil, Docker secret dosyasinda tutulmus olur.
set -e

if [ -n "${RABBITMQ_DEFAULT_PASS_FILE:-}" ] && [ -f "$RABBITMQ_DEFAULT_PASS_FILE" ]; then
  RABBITMQ_DEFAULT_PASS="$(cat "$RABBITMQ_DEFAULT_PASS_FILE")"
  export RABBITMQ_DEFAULT_PASS
  unset RABBITMQ_DEFAULT_PASS_FILE
fi

exec docker-entrypoint.sh "$@"
