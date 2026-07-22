import * as fs from "fs";
import * as path from "path";
import * as jwt from "jsonwebtoken";
import { Role } from "../common/enums/role.enum";

export interface AccessTokenPayload {
  sub: string; // user_id
  role: Role;
  name?: string; // gorunen ad (mesajlasma ve UI icin; PII minimizasyonu geregi sadece ad-soyad)
  expertise?: string[];
  region?: string[];
}

const JWT_ISSUER = "netopscell-identity-service";
const JWT_AUDIENCE = "netopscell";

// Faz 3: varsayilan yol Docker Compose secret mount noktasidir (/run/secrets/...).
// Yerel (non-Docker) gelistirme icin ./keys/*.pem fallback olarak korunur.
const PRIVATE_KEY_PATH =
  process.env.JWT_PRIVATE_KEY_PATH || "/run/secrets/jwt_private_key";
const PUBLIC_KEY_PATH =
  process.env.JWT_PUBLIC_KEY_PATH || "/run/secrets/jwt_public_key";
const LOCAL_FALLBACK_PRIVATE = path.join(__dirname, "..", "..", "keys", "private.pem");
const LOCAL_FALLBACK_PUBLIC = path.join(__dirname, "..", "..", "keys", "public.pem");

function readKey(preferredPath: string, fallbackPath: string): string {
  const target = fs.existsSync(preferredPath) ? preferredPath : fallbackPath;
  return fs.readFileSync(target, "utf8");
}

// Anahtarlar surec basinda bir kez okunur; RS256 sayesinde private key SADECE bu serviste bulunur
// ve artik imaja gomulmez (Docker secret olarak calisma zamaninda mount edilir).
const privateKey = readKey(PRIVATE_KEY_PATH, LOCAL_FALLBACK_PRIVATE);
const publicKey = readKey(PUBLIC_KEY_PATH, LOCAL_FALLBACK_PUBLIC);

export function signAccessToken(payload: AccessTokenPayload, ttl = process.env.JWT_ACCESS_TTL || "15m"): string {
  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: ttl as jwt.SignOptions["expiresIn"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload & jwt.JwtPayload {
  // algorithms whitelist: "alg: none" veya HS256 downgrade saldirilarina karsi savunma
  // issuer/audience kontrolu: baska bir amacla uretilmis bir RS256 token'in burada
  // kabul edilmesini engeller (token confusion / karisikligi savunmasi).
  return jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as AccessTokenPayload & jwt.JwtPayload;
}

export function getPublicKeyPem(): string {
  return publicKey;
}
