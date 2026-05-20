import { createHmac } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttemptFailures } from "@/db/schema";
import { createId } from "./ids";
import { nowIso } from "./time";

const WINDOW_MS = 15 * 60 * 1000;

function maxFailures(): number {
  const raw = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? "8");

  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 8;
}

function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

export function isLoginRateLimitEnabled(): boolean {
  return process.env.LOGIN_RATE_LIMIT_DISABLED !== "1";
}

export function assertLoginAllowed(login: string, ipHash: string): void {
  if (!isLoginRateLimitEnabled()) {
    return;
  }

  const loginKey = normalizeLogin(login);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttemptFailures)
    .where(
      and(
        eq(loginAttemptFailures.loginKey, loginKey),
        eq(loginAttemptFailures.ipHash, ipHash),
        gte(loginAttemptFailures.failedAt, since),
      ),
    )
    .get();

  if ((row?.count ?? 0) >= maxFailures()) {
    throw new Error("LOGIN_RATE_LIMITED");
  }
}

export function recordLoginFailure(login: string, ipHash: string): void {
  if (!isLoginRateLimitEnabled()) {
    return;
  }

  db.insert(loginAttemptFailures)
    .values({
      id: createId("laf"),
      loginKey: normalizeLogin(login),
      ipHash,
      failedAt: nowIso(),
    })
    .run();
}

export function clearLoginFailures(login: string, ipHash: string): void {
  db.delete(loginAttemptFailures)
    .where(
      and(
        eq(loginAttemptFailures.loginKey, normalizeLogin(login)),
        eq(loginAttemptFailures.ipHash, ipHash),
      ),
    )
    .run();
}

export function hashIpForTests(ip: string, secret = "test-secret"): string {
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}
