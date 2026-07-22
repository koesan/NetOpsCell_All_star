const fs = require("fs");

/**
 * Faz 3 - Secret yonetimi. Docker Compose native `secrets:` mekanizmasi ile mount edilen
 * dosyalari (`${ENV_VAR}_FILE` -> /run/secrets/<isim>) okur; bulunamazsa duz ortam
 * degiskenine (yerel gelistirme kolayligi icin), o da yoksa fallback'e duser.
 * Bkz. docs/ARCHITECTURE.md Bolum 19 (Secret ve Anahtar Yonetimi).
 */
function readSecret(envVarBase, fallback) {
  const filePath = process.env[`${envVarBase}_FILE`];
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8").trim();
  }
  const direct = process.env[envVarBase];
  if (direct) return direct;
  if (fallback !== undefined) return fallback;
  throw new Error(`Secret bulunamadi: ${envVarBase}_FILE veya ${envVarBase} ortam degiskeni tanimlanmali.`);
}

function buildRabbitMqUrl() {
  const host = process.env.RABBITMQ_HOST || "rabbitmq";
  const port = process.env.RABBITMQ_PORT || "5672";
  const user = process.env.RABBITMQ_USER || "guest";
  const password = readSecret("RABBITMQ_PASSWORD", "guest");
  return `amqp://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}`;
}

module.exports = { readSecret, buildRabbitMqUrl };
