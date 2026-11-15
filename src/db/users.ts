import { eq } from "drizzle-orm";
import { db } from "./client";
import { users, type User } from "./schema";
import { nowIso } from "../lib/time";

export function findUserByLogin(login: string): User | undefined {
  return db.select().from(users).where(eq(users.login, login)).get();
}

export function findUserById(userId: string): User | undefined {
  return db.select().from(users).where(eq(users.id, userId)).get();
}

export function updateUserTotpPendingSecret(userId: string, secret: string | null): void {
  db.update(users)
    .set({
      totpPendingSecret: secret,
      updatedAt: nowIso(),
    })
    .where(eq(users.id, userId))
    .run();
}

export function finalizeTotpEnrollment(userId: string): void {
  const user = findUserById(userId);

  if (!user?.totpPendingSecret) {
    throw new Error("Brak oczekujacego klucza TOTP.");
  }

  db.update(users)
    .set({
      totpSecret: user.totpPendingSecret,
      totpPendingSecret: null,
      totpEnabled: true,
      totpLastUsedStep: null,
      updatedAt: nowIso(),
    })
    .where(eq(users.id, userId))
    .run();
}

export function clearTotpPendingSecret(userId: string): void {
  db.update(users)
    .set({
      totpPendingSecret: null,
      updatedAt: nowIso(),
    })
    .where(eq(users.id, userId))
    .run();
}

export function disableUserTotp(userId: string): void {
  db.update(users)
    .set({
      totpSecret: null,
      totpPendingSecret: null,
      totpEnabled: false,
      totpLastUsedStep: null,
      updatedAt: nowIso(),
    })
    .where(eq(users.id, userId))
    .run();
}

export function markTotpStepUsed(userId: string, timeStep: number): void {
  db.update(users).set({ totpLastUsedStep: timeStep }).where(eq(users.id, userId)).run();
}

export function updateUserPasswordHash(userId: string, passwordHash: string): void {
  db.update(users)
    .set({ passwordHash, updatedAt: nowIso() })
    .where(eq(users.id, userId))
    .run();
}
