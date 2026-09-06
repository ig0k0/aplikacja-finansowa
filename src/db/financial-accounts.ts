import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";
import type { financialAccountSchema } from "@/domain/financial-accounts";
import { createId } from "@/lib/ids";
import { nowIso } from "@/lib/time";
import { db } from "./client";
import { financialAccounts } from "./schema";

export type FinancialAccountInput = z.infer<typeof financialAccountSchema>;

export function listFinancialAccountsForUser(userId: string) {
  return db
    .select()
    .from(financialAccounts)
    .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.isActive, true)))
    .orderBy(asc(financialAccounts.institution), asc(financialAccounts.name))
    .all();
}

export function ensureFinancialAccountForUser(userId: string, financialAccountId: string | null | undefined) {
  if (!financialAccountId) {
    return;
  }

  const account = db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.id, financialAccountId),
        eq(financialAccounts.userId, userId),
        eq(financialAccounts.isActive, true),
      ),
    )
    .get();

  if (!account) {
    throw new Error("Wybrane konto finansowe nie nalezy do aktualnego uzytkownika.");
  }
}

export function createFinancialAccountForUser(userId: string, input: FinancialAccountInput) {
  const now = nowIso();

  db.insert(financialAccounts)
    .values({
      id: createId("acc"),
      userId,
      name: input.name,
      institution: input.institution,
      type: input.type,
      currency: input.currency,
      externalAccountHint: input.externalAccountHint || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

export function archiveFinancialAccountForUser(userId: string, accountId: string) {
  const result = db
    .update(financialAccounts)
    .set({ isActive: false, updatedAt: nowIso() })
    .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId)))
    .run();

  if (result.changes === 0) {
    throw new Error("Konto finansowe nie zostalo znalezione.");
  }
}
