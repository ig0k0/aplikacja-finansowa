import { eq, lt } from "drizzle-orm";
import { db } from "./client";
import { loginTotpPending } from "./schema";
import { createId } from "../lib/ids";
import { nowIso } from "../lib/time";

const pendingTtlMs = 10 * 60 * 1000;

export function cleanupExpiredTotpLoginPending(): void {
  const now = nowIso();

  db.delete(loginTotpPending).where(lt(loginTotpPending.expiresAt, now)).run();
}

export function createLoginTotpPending(userId: string): string {
  cleanupExpiredTotpLoginPending();

  const id = createId("totp");
  const expiresAt = new Date(Date.now() + pendingTtlMs).toISOString();

  db.insert(loginTotpPending)
    .values({
      id,
      userId,
      expiresAt,
      createdAt: nowIso(),
    })
    .run();

  return id;
}

export function findValidTotpLoginPending(pendingId: string): string | null {
  cleanupExpiredTotpLoginPending();

  const row = db.select().from(loginTotpPending).where(eq(loginTotpPending.id, pendingId)).get();

  if (!row) {
    return null;
  }

  if (row.expiresAt <= nowIso()) {
    db.delete(loginTotpPending).where(eq(loginTotpPending.id, pendingId)).run();

    return null;
  }

  return row.userId;
}

export function deleteTotpLoginPending(pendingId: string): void {
  db.delete(loginTotpPending).where(eq(loginTotpPending.id, pendingId)).run();
}
