import "../lib/load-env";
import { eq } from "drizzle-orm";
import { recordAuditEvent } from "../db/audit";
import { db } from "../db/client";
import { sessions } from "../db/schema";
import { disableUserTotp, findUserByLogin, updateUserPasswordHash } from "../db/users";
import { hashPassword, validateNewPassword } from "../lib/password";

/**
 * Awaryjne ustawienie hasla z konsoli serwera (np. po utracie hasla lub telefonu z TOTP).
 *
 *   NEW_PASSWORD='...' npm run user:set-password -- <login> [--disable-totp]
 *
 * Haslo podajemy przez zmienna srodowiskowa, zeby nie trafilo do listy procesow.
 */
const args = process.argv.slice(2);
const login = args.find((arg) => !arg.startsWith("--"));
const disableTotp = args.includes("--disable-totp");
const newPassword = process.env.NEW_PASSWORD ?? "";

try {
  if (!login) {
    throw new Error("Uzycie: NEW_PASSWORD='...' npm run user:set-password -- <login> [--disable-totp]");
  }

  const passwordError = validateNewPassword(newPassword);

  if (passwordError) {
    throw new Error(`NEW_PASSWORD: ${passwordError}`);
  }

  const user = findUserByLogin(login);

  if (!user) {
    throw new Error(`Nie znaleziono uzytkownika "${login}".`);
  }

  updateUserPasswordHash(user.id, await hashPassword(newPassword));

  if (disableTotp) {
    disableUserTotp(user.id);
  }

  const closedSessions = db.delete(sessions).where(eq(sessions.userId, user.id)).run().changes;

  recordAuditEvent({
    userId: user.id,
    action: "password_reset_cli",
    meta: { closedSessions, totpDisabled: disableTotp },
  });

  console.log(
    `Haslo uzytkownika "${login}" zostalo zmienione. Wylogowane sesje: ${closedSessions}.` +
      (disableTotp ? " 2FA zostalo wylaczone." : ""),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Nieznany blad.");
  process.exitCode = 1;
}
