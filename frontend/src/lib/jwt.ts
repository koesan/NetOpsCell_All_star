import type { AccessTokenPayload } from "../types";

export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payloadBase64 = token.split(".")[1];
    const json = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as AccessTokenPayload;
  } catch {
    return null;
  }
}
