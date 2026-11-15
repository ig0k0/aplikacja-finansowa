import { timingSafeEqual, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");

  if (expected.length === 0) {
    return false;
  }

  const actual = (await scrypt(password, salt, expected.length)) as Buffer;

  return timingSafeEqual(actual, expected);
}

/** Wykonuje te sama prace co `verifyPassword`, ale zawsze zwraca `false`. */
export async function verifyPasswordAgainstDummy(password: string) {
  await scrypt(password, "00000000000000000000000000000000", keyLength);

  return false;
}

export function validateNewPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Haslo musi miec co najmniej ${MIN_PASSWORD_LENGTH} znakow.`;
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Haslo moze miec najwyzej ${MAX_PASSWORD_LENGTH} znakow.`;
  }

  return null;
}
