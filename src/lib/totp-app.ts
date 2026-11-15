import { generateSecret, generateURI, verifySync } from "otplib";

export const TOTP_ISSUER = "CFO";

/** Tolerancja zegara: jeden 30-sekundowy krok w kazda strone. */
const EPOCH_TOLERANCE_SECONDS = 30;

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

export type TotpCheck = { valid: true; timeStep: number } | { valid: false };

/**
 * Weryfikuje kod TOTP. `afterTimeStep` to ostatnio zaakceptowany krok czasowy —
 * kod z tego samego lub wczesniejszego kroku jest odrzucany (ochrona przed powtorzeniem).
 */
export function checkTotpToken(
  secret: string,
  token: string,
  afterTimeStep?: number | null,
): TotpCheck {
  const normalized = token.trim().replace(/\s+/g, "");

  if (!/^\d{6}$/.test(normalized)) {
    return { valid: false };
  }

  const result = verifySync({
    secret,
    token: normalized,
    epochTolerance: EPOCH_TOLERANCE_SECONDS,
    ...(typeof afterTimeStep === "number" ? { afterTimeStep } : {}),
  });

  if (!result.valid) {
    return { valid: false };
  }

  return { valid: true, timeStep: (result as { timeStep: number }).timeStep };
}

export function verifyTotpToken(secret: string, token: string): boolean {
  return checkTotpToken(secret, token).valid;
}
