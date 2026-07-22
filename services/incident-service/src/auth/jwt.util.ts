import * as fs from "fs";
import * as path from "path";
import * as jwt from "jsonwebtoken";
import { Role } from "../common/enums/enums";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  name?: string;
  expertise?: string[];
  region?: string[];
}

const JWT_ISSUER = "netopscell-identity-service";
const JWT_AUDIENCE = "netopscell";

const PUBLIC_KEY_PATH = process.env.JWT_PUBLIC_KEY_PATH || "/run/secrets/jwt_public_key";
const LOCAL_FALLBACK_PUBLIC = path.join(__dirname, "..", "..", "keys", "public.pem");
const publicKey = fs.readFileSync(fs.existsSync(PUBLIC_KEY_PATH) ? PUBLIC_KEY_PATH : LOCAL_FALLBACK_PUBLIC, "utf8");

export function verifyAccessToken(token: string): AccessTokenPayload & jwt.JwtPayload {
  return jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as AccessTokenPayload & jwt.JwtPayload;
}
