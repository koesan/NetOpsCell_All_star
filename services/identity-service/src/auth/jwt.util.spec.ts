import * as jwt from "jsonwebtoken";
import { Role } from "../common/enums/role.enum";
import { signAccessToken, verifyAccessToken, getPublicKeyPem } from "./jwt.util";

describe("jwt.util (RS256 imzalama/dogrulama)", () => {
  const payload = { sub: "user-123", role: Role.SAHA_TEKNISYENI };

  it("imzalanan token gecerli payload ile dogrulanir", () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.iss).toBe("netopscell-identity-service");
    expect(decoded.aud).toBe("netopscell");
  });

  it("suresi dolmus token reddedilir", () => {
    const token = signAccessToken(payload, "-1s");
    expect(() => verifyAccessToken(token)).toThrow(/expired/i);
  });

  it("farkli issuer ile imzalanmis token reddedilir (token confusion savunmasi)", () => {
    const rogueToken = jwt.sign(payload, getPublicKeyPem(), { algorithm: "HS256" });
    expect(() => verifyAccessToken(rogueToken)).toThrow();
  });

  it("alg:none saldirisi (imzasiz token) reddedilir", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ ...payload, iss: "netopscell-identity-service", aud: "netopscell" })).toString(
      "base64url"
    );
    const noneToken = `${header}.${body}.`;
    expect(() => verifyAccessToken(noneToken)).toThrow();
  });

  it("bozulmus imza reddedilir", () => {
    const token = signAccessToken(payload);
    const tampered = token.slice(0, -4) + "abcd";
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});
