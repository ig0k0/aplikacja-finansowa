import { generateSecret, generateURI, verifySync } from "otplib";

export const TOTP_ISSUER = "CFO";

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildTotpKeyUri(login: string, secret: string): string {
  return generateURI({
    issuer: TOTP_ISSUER,
    label: login,
    secret,
  });
}

export function verifyTotpToken(secret: string, token: string): boolean {
  const normalized = token.trim().replace(/\s+/g, "");

  if (!/^\d{6,8}$/.test(normalized)) {
    return false;
  }

  const result = verifySync({
    secret,
    token: normalized,
  });

  return result.valid;
}
