import { and, eq } from "drizzle-orm";
import type { TransactionType } from "@/domain/transactions";
import { createId } from "@/lib/ids";
import { nowIso } from "@/lib/time";
import { db } from "./client";
import { categories, transactions } from "./schema";
import { ensureFinancialAccountForUser } from "./financial-accounts";

export type ManualTransactionRecord = {
  userId: string;
  type: TransactionType;
  transactionDate: string;
  postedDate?: string | null;
  amountMinor: number;
  amountPlnMinor?: number;
  currency?: string;
  fxRate?: string | null;
  bankReference?: string | null;
  categoryId: string;
  description: string;
  merchantName?: string;
  financialAccountId?: string | null;
  isRecurring?: boolean;
};

type TransactionInsertInput = {
  id?: string;
  userId: string;
  categoryId: string;
  financialAccountId?: string | null;
  type: TransactionType;
  transactionDate: string;
  postedDate?: string | null;
  amountMinor: number;
  amountPlnMinor?: number;
  currency?: string;
  fxRate?: string | null;
  bankReference?: string | null;
  merchantName?: string | null;
  description: string;
  verificationStatus: "verified" | "auto_categorized" | "needs_review";
  categorizationStatus: "pending" | "done" | "review";
  source: "manual" | "import";
  dedupeKey?: string | null;
  isRecurring?: boolean;
};

export function ensureTransactionCategoryForUser(userId: string, categoryId: string) {
  const category = db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.userId, userId),
        eq(categories.isArchived, false),
      ),
    )
    .get();

  if (!category) {
    throw new Error("Wybrana kategoria nie nalezy do aktualnego uzytkownika.");
  }
}

export function createTransactionInsertValues(input: TransactionInsertInput) {
  const now = nowIso();

  return {
    id: input.id ?? createId("txn"),
    userId: input.userId,
    categoryId: input.categoryId,
    financialAccountId: input.financialAccountId ?? null,
    type: input.type,
    transactionDate: input.transactionDate,
    postedDate: input.postedDate ?? null,
    amountMinor: input.amountMinor,
    currency: input.currency ?? "PLN",
    amountPlnMinor: input.amountPlnMinor ?? input.amountMinor,
    fxRate: input.fxRate ?? null,
    bankReference: input.bankReference ?? null,
    merchantName: input.merchantName || null,
    description: input.description,
    verificationStatus: input.verificationStatus,
    categorizationStatus: input.categorizationStatus,
    source: input.source,
    dedupeKey: input.dedupeKey ?? null,
    isRecurring: input.isRecurring ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createManualTransactionThroughService(input: ManualTransactionRecord) {
  ensureTransactionCategoryForUser(input.userId, input.categoryId);
  ensureFinancialAccountForUser(input.userId, input.financialAccountId);

  db.insert(transactions)
    .values(
      createTransactionInsertValues({
        ...input,
        verificationStatus: "verified",
        categorizationStatus: "done",
        source: "manual",
      }),
    )
    .run();
}
