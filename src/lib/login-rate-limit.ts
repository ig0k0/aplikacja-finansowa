import { createHmac } from "node:crypto";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttemptFailures } from "@/db/schema";
import { createId } from "./ids";
import { nowIso } from "./time";

const WINDOW_MS = 15 * 60 * 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000;

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? "");

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/** Limit nieudanych prob dla pary login + adres klienta. */
function maxFailuresPerClient(): number {
  return positiveInt(process.env.LOGIN_RATE_LIMIT_MAX, 8);
}

/**
 * Limit nieudanych prob dla samego loginu, niezaleznie od adresu.
 * Chroni przed zgadywaniem hasla z wielu adresow (botnet, IPv6, podmiana naglowkow).
 */
function maxFailuresPerLogin(): number {
  return positiveInt(process.env.LOGIN_RATE_LIMIT_LOGIN_MAX, 20);
}

function normalizeLogin(login: string): string {
  return login.trim().toLowerCase().slice(0, 120);
}

export function isLoginRateLimitEnabled(): boolean {
  return process.env.LOGIN_RATE_LIMIT_DISABLED !== "1";
}

function countFailures(loginKey: string, since: string, ipHash?: string): number {
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttemptFailures)
    .where(
      and(
        eq(loginAttemptFailures.loginKey, loginKey),
        gte(loginAttemptFailures.failedAt, since),
        ipHash ? eq(loginAttemptFailures.ipHash, ipHash) : undefined,
      ),
    )
    .get();

  return row?.count ?? 0;
}

export function isLoginAllowed(login: string, ipHash: string): boolean {
  if (!isLoginRateLimitEnabled()) {
    return true;
  }

  const loginKey = normalizeLogin(login);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  return (
    countFailures(loginKey, since, ipHash) < maxFailuresPerClient() &&
    countFailures(loginKey, since) < maxFailuresPerLogin()
  );
}

export function assertLoginAllowed(login: string, ipHash: string): void {
  if (!isLoginAllowed(login, ipHash)) {
    throw new Error("LOGIN_RATE_LIMITED");
  }
}

export function recordLoginFailure(login: string, ipHash: string): void {
  if (!isLoginRateLimitEnabled()) {
    return;
  }

  // Tabela rosnie przy kazdej nieudanej probie, wiec stare wpisy usuwamy na biezaco.
  db.delete(loginAttemptFailures)
    .where(lt(loginAttemptFailures.failedAt, new Date(Date.now() - RETENTION_MS).toISOString()))
    .run();

  db.insert(loginAttemptFailures)
    .values({
      id: createId("laf"),
      loginKey: normalizeLogin(login),
      ipHash,
      failedAt: nowIso(),
    })
    .run();
}

/** Po pelnym, poprawnym logowaniu zerujemy licznik dla tego loginu. */
export function clearLoginFailures(login: string): void {
  db.delete(loginAttemptFailures)
    .where(eq(loginAttemptFailures.loginKey, normalizeLogin(login)))
    .run();
}

/** Pomocnicze dla testow: ten sam ksztalt skrotu co w `client-ip.ts`. */
export function hashIpForTests(ip: string, secret = "test-secret"): string {
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}
