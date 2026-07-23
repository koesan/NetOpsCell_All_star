const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { randomUUID } = require("crypto");
const { jwtAuthMiddleware } = require("./jwt-auth.middleware");
const { attachWebsocket } = require("./websocket");

const PORT = process.env.PORT || 8080;

const IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL || "http://identity-service:3001";
const INCIDENT_SERVICE_URL = process.env.INCIDENT_SERVICE_URL || "http://incident-service:3002";
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://ai-service:8000";
const LOCAL_AI_SERVICE_URL = process.env.LOCAL_AI_SERVICE_URL || "http://local-ai-service:8000";
const GAMIFICATION_SERVICE_URL = process.env.GAMIFICATION_SERVICE_URL || "http://gamification-service:3003";

// Faz 3: CORS artik acik (*) degil - sadece bilinen frontend origin'lerine izin verilir.
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

const app = express();

// Guvenlik header'lari: X-Content-Type-Options, X-Frame-Options, HSTS, CSP vb.
// (bkz. docs/ARCHITECTURE.md Bolum 19 - Guvenlik Sertlestirme)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  })
);
app.disable("x-powered-by");

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("CORS: izin verilmeyen origin"));
    },
    credentials: true,
  })
);
app.use(morgan("combined"));

// Correlation-id: her istegi servisler arasinda izlenebilir kilar
app.use((req, _res, next) => {
  req.correlationId = req.headers["x-correlation-id"] || randomUUID();
  next();
});

// Genel rate limit (brute-force / DoS savunmasinin ilk katmani)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, data: null, error: { code: "RATE_LIMITED", message: "Cok fazla istek, lutfen bekleyin." } },
  })
);

// Kimlik dogrulama akisinin hassas adimlarina (giris, kayit, OTP) daha siki limit -
// brute-force ve OTP/SMS bombalama (anti-spam) saldirilarina karsi.
function strictLimiter(limit) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, data: null, error: { code: "RATE_LIMITED", message: "Cok fazla deneme, lutfen bekleyin." } },
  });
}
app.use("/api/v1/auth/login", strictLimiter(5));
app.use("/api/v1/auth/register", strictLimiter(3));
app.use("/api/v1/auth/otp/verify", strictLimiter(5));
app.use("/api/v1/auth/refresh", strictLimiter(10));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: { service: "api-gateway", status: "ok", timestamp: new Date().toISOString() },
    error: null,
  });
});

// Faz 2: JWT on-dogrulama. Public auth rotalari (register/login/otp/refresh/logout) ve /health
// haric tum istekler burada RS256 ile dogrulanir - basarisizlik durumunda istek downstream
// servise hic ulasmadan 401 doner (savunma derinligi; her servis kendi guard'inda da ayrica
// dogrular, bkz. ARCHITECTURE.md Bolum 8, 10).
app.use(jwtAuthMiddleware);

// Express'in app.use(prefix, ...) davranisi, middleware'e ulasan req.url'den prefix'i siler
// (orn. "/api/v1/auth/register" -> "/register"). http-proxy-middleware bu kisaltilmis path'i
// oldugu gibi hedefe iletir; pathRewrite ile prefix geri eklenerek hedef servisin bekledigi
// tam path (orn. "/api/v1/auth/register") yeniden olusturulur.
// http-proxy-middleware v3, onError/onProxyReq gibi ust-seviye v1/v2 secenklerini kaldirdi;
// bunlar v3'te sessizce yok sayilir ve kutuphanenin kendi varsayilan (JSON olmayan duz metin)
// hata gövdesi donmeye devam eder. Dogru kanca noktasi `on: { error, proxyReq }` nesnesidir.
const proxyOptions = (target, prefix, timeoutMs = 5000) => ({
  target,
  changeOrigin: true,
  proxyTimeout: timeoutMs,
  timeout: timeoutMs,
  // xfwd: gercek istemci IP'sini X-Forwarded-For/-Port/-Proto olarak downstream servise iletir.
  // Bunsuz her servisin gordugu req.ip her zaman Gateway container'inin Docker-ici IP'siydi -
  // audit log'daki "nereden (IP)" alani hicbir zaman gercek saldirgan/istemci IP'si olmuyordu.
  xfwd: true,
  pathRewrite: (path) => (path === "/" ? prefix : `${prefix}${path}`),
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader("x-correlation-id", req.correlationId);
    },
    error: (_err, _req, res) => {
      if (res.headersSent) return;
      res.status(503).json({
        success: false,
        data: null,
        error: { code: "SERVICE_UNAVAILABLE", message: "Hedef servise ulasilamiyor." },
      });
    },
  },
});

app.use("/api/v1/auth", createProxyMiddleware(proxyOptions(IDENTITY_SERVICE_URL, "/api/v1/auth")));
app.use("/api/v1/admin", createProxyMiddleware(proxyOptions(IDENTITY_SERVICE_URL, "/api/v1/admin")));
app.use("/api/v1/telemetry", createProxyMiddleware(proxyOptions(INCIDENT_SERVICE_URL, "/api/v1/telemetry")));
app.use("/api/v1/incidents", createProxyMiddleware(proxyOptions(INCIDENT_SERVICE_URL, "/api/v1/incidents")));
app.use("/api/v1/stations", createProxyMiddleware(proxyOptions(INCIDENT_SERVICE_URL, "/api/v1/stations")));
app.use("/api/v1/dashboard", createProxyMiddleware(proxyOptions(INCIDENT_SERVICE_URL, "/api/v1/dashboard")));
app.use("/api/v1/ai", createProxyMiddleware(proxyOptions(AI_SERVICE_URL, "/api/v1/ai")));
app.use("/api/v1/game", createProxyMiddleware(proxyOptions(GAMIFICATION_SERVICE_URL, "/api/v1/game")));
// Yerel LLM cikarimi CPU'da uzun surebilir (ilk yuklemede birkaç dakika, ureti minde
// onlarca saniye) - varsayilan 5sn proxy zaman asimi burada yetersiz kalir.
// CPU uzerinde calisan 1.5B parametreli model gercek bir istekte ~2-4 dakika surebilir
// (GPU yok); 120sn'lik onceki timeout gercek yanitlar tamamlanmadan "Hedef servise
// ulasilamiyor" hatasi uretiyordu. 300sn'ye cikarildi.
app.use("/api/v1/local-ai", createProxyMiddleware(proxyOptions(LOCAL_AI_SERVICE_URL, "/api/v1/local-ai", 300000)));

app.use((_req, res) => {
  res.status(404).json({ success: false, data: null, error: { code: "NOT_FOUND", message: "Route bulunamadi." } });
});

// Faz 4 (bonus): Socket.IO ayni HTTP server uzerinde calisir, tek port/tek giris noktasi
// ilkesi korunur. Gercek zamanli bildirimler (incident.assigned, badge.earned) icin -
// bkz. src/websocket.js.
const httpServer = http.createServer(app);
attachWebsocket(httpServer, ALLOWED_ORIGINS);

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api-gateway] listening on port ${PORT}`);
});
