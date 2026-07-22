import os

from app.secrets_util import build_rabbitmq_url, read_secret


class Settings:
    db_host = os.environ.get("DB_HOST", "localhost")
    db_port = os.environ.get("DB_PORT", "5432")
    db_name = os.environ.get("DB_NAME", "ai")
    db_user = os.environ.get("DB_USER", "ai_user")
    db_password = read_secret("DB_PASSWORD", "changeme")

    model_path = os.environ.get("MODEL_PATH", "./models/model_v1.joblib")
    model_version = os.environ.get("MODEL_VERSION", "v1")
    min_acceptable_macro_f1 = float(os.environ.get("MIN_ACCEPTABLE_MACRO_F1", "0.85"))

    threshold_izle = float(os.environ.get("THRESHOLD_IZLE", "0.40"))
    threshold_acil = float(os.environ.get("THRESHOLD_ACIL", "0.85"))

    score_weight_uzmanlik = float(os.environ.get("SCORE_WEIGHT_UZMANLIK", "0.4"))
    score_weight_mesafe = float(os.environ.get("SCORE_WEIGHT_MESAFE", "0.3"))
    score_weight_bosluk = float(os.environ.get("SCORE_WEIGHT_BOSLUK", "0.3"))
    team_max_capacity = int(os.environ.get("TEAM_MAX_CAPACITY", "5"))

    identity_service_internal_url = os.environ.get("IDENTITY_SERVICE_INTERNAL_URL", "http://identity-service:3001")
    incident_service_internal_url = os.environ.get("INCIDENT_SERVICE_INTERNAL_URL", "http://incident-service:3002")
    internal_api_key = read_secret("INTERNAL_API_KEY", "")
    rabbitmq_url = build_rabbitmq_url()

    @property
    def database_url(self) -> str:
        return f"postgresql+psycopg2://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"


settings = Settings()
