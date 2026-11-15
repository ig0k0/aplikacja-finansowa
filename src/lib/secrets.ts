const PLACEHOLDER_SECRETS = new Set([
  "change-me-before-use",
  "change-me-backup-key",
  "change-me",
  "changeme",
  "secret",
]);

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/**
 * Sekret sesji. Na produkcji odrzucamy wartosci przykladowe i zbyt krotkie,
 * zeby instalacja z nieuzupelnionym `.env` nie wystartowala "po cichu".
 */
export function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is required for local sessions.");
  }

  if (isProduction() && (secret.length < 32 || PLACEHOLDER_SECRETS.has(secret))) {
    throw new Error(
      "SESSION_SECRET jest zbyt slaby: ustaw losowy ciag min. 32 znakow (np. `openssl rand -hex 32`).",
    );
  }

  return secret;
}

/** Klucz backupu chroni cala baze poza serwerem, wiec walidujemy go zawsze. */
export function requireBackupEncryptionKey(): string {
  const key = process.env.BACKUP_ENCRYPTION_KEY;

  if (!key) {
    throw new Error("BACKUP_ENCRYPTION_KEY is required.");
  }

  if (key.length < 16 || PLACEHOLDER_SECRETS.has(key)) {
    throw new Error(
      "BACKUP_ENCRYPTION_KEY jest zbyt slaby: ustaw losowy ciag min. 16 znakow (np. `openssl rand -base64 32`).",
    );
  }

  return key;
}
