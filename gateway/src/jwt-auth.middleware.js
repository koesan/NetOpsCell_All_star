const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const JWT_ISSUER = "netopscell-identity-service";
const JWT_AUDIENCE = "netopscell";

// Identity Service ile ayni public key. Faz 3'te Docker secret mount noktasindan okunur
// (imaja gomulu degil); yerel (non-Docker) gelistirme icin ./keys/public.pem fallback'i korunur.
// Gateway private key'e asla erisemez - sadece dogrulama yapar (bkz. ARCHITECTURE.md Bolum 8, 19).
const PUBLIC_KEY_PATH = process.env.JWT_PUBLIC_KEY_PATH || "/run/secrets/jwt_public_key";
const LOCAL_FALLBACK_PUBLIC = path.join(__dirname, "..", "keys", "public.pem");
const publicKey = fs.readFileSync(fs.existsSync(PUBLIC_KEY_PATH) ? PUBLIC_KEY_PATH : LOCAL_FALLBACK_PUBLIC, "utf8");

// Bearer token gerektirmeyen rotalar (auth akisinin kendisi + health-check)
const PUBLIC_ROUTES = [
  { method: "POST", path: "/api/v1/auth/register" },
  { method: "POST", path: "/api/v1/auth/otp/verify" },
  { method: "POST", path: "/api/v1/auth/login" },
  { method: "POST", path: "/api/v1/auth/refresh" },
  { method: "POST", path: "/api/v1/auth/logout" },
];

function isPublicRoute(req) {
  if (req.path === "/health") return true;
  return PUBLIC_ROUTES.some((r) => r.method === req.method && req.path === r.path);
}

function jwtAuthMiddleware(req, res, next) {
  if (isPublicRoute(req)) return next();

  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      data: null,
      error: { code: "UNAUTHORIZED", message: "Erisim tokeni eksik." },
    });
  }

  const token = authHeader.slice("Bearer ".length);
  try {
    // algorithms whitelist: "alg: none" veya HS256 downgrade saldirilarina karsi savunma.
    // issuer/audience: baska amacli bir RS256 token'in burada kabul edilmesini engeller.
    req.user = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      data: null,
      error: { code: "UNAUTHORIZED", message: "Erisim tokeni gecersiz veya suresi dolmus." },
    });
  }
}

module.exports = { jwtAuthMiddleware, publicKey, JWT_ISSUER, JWT_AUDIENCE };
