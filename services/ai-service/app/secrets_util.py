"""Faz 3 - Secret yonetimi (Node servislerindeki secrets.ts'in Python karsiligi).

Docker Compose native `secrets:` mekanizmasi ile mount edilen dosyalari
(`${ENV_VAR}_FILE` -> /run/secrets/<isim>) okur; bulunamazsa secrets/ dizinine
veya duz ortam degiskenine bakar.
"""

import os
from urllib.parse import quote


def read_secret(env_var_base: str, fallback: str = None) -> str:
    file_path = os.environ.get(f"{env_var_base}_FILE")
    if file_path and os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read().strip()

    direct = os.environ.get(env_var_base)
    if direct:
        return direct

    # Yerel gelistirme icin secrets/<isim>.txt kontrolu
    candidate_paths = [
        os.path.join(os.getcwd(), "secrets", f"{env_var_base.lower()}.txt"),
        os.path.join(os.getcwd(), "..", "..", "secrets", f"{env_var_base.lower()}.txt"),
        os.path.join(os.getcwd(), "..", "secrets", f"{env_var_base.lower()}.txt"),
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                val = f.read().strip()
                if val:
                    return val

    if fallback is not None:
        return fallback
    raise RuntimeError(f"Secret bulunamadi: {env_var_base}_FILE veya {env_var_base} ortam degiskeni tanimlanmali.")


def build_rabbitmq_url() -> str:
    host = os.environ.get("RABBITMQ_HOST", "rabbitmq")
    port = os.environ.get("RABBITMQ_PORT", "5672")
    user = os.environ.get("RABBITMQ_USER", "guest")
    password = read_secret("RABBITMQ_PASSWORD", "guest")
    return f"amqp://{quote(user)}:{quote(password)}@{host}:{port}"
