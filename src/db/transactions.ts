import { and, asc, desc, eq, gte, like, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import { categories, transactions } from "./schema";
import { createId } from "../lib/ids";
import { nowIso } from "../lib/time";
import type { TransactionType } from "../domain/transactions";
import { monthDateRange } from "../domain/budgets";
import { upsertCorrectionMemory } from "./correction-memory";

export type TransactionFilters = {
  type?: TransactionType;
  categoryId?: string;
  query?: string;
  verificationStatus?: string;
  sort?: "newest" | "oldest";
};

export type TransactionListItem = {
  id: string;
  type: string;
  transactionDate: string;
  amountPlnMinor: number;
  description: string | null;
  merchantName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isRecurring: boolean;
};

export type ManualTransactionRecord = {
  userId: string;
  type: TransactionType;
  transactionDate: string;
  amountMinor: number;
  categoryId: string;
  description: string;
  merchantName?: string;
  isRecurring?: boolean;
};

function ensureCategoryForUser(userId: string, categoryId: string) {
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
    throw new Error("Selected category does not belong to the current user.");
  }
}

export function createManualTransaction(input: ManualTransactionRecord) {
  ensureCategoryForUser(input.userId, input.categoryId);

  const now = nowIso();

  db.insert(transactions)
    .values({
      id: createId("txn"),
      userId: input.userId,
      categoryId: input.categoryId,
      type: input.type,
      transactionDate: input.transactionDate,
      amountMinor: input.amountMinor,
      currency: "PLN",
      amountPlnMinor: input.amountMinor,
      merchantName: input.merchantName || null,
      description: input.description,
      verificationStatus: "verified",
      source: "manual",
      isRecurring: input.isRecurring ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

export function updateTransactionCategoryForUser(
  userId: string,
  transactionId: string,
  categoryId: string,
  options?: { rememberPattern?: boolean; isRecurring?: boolean },
) {
  ensureCategoryForUser(userId, categoryId);

  const row = db
    .select({
      merchantName: transactions.merchantName,
      description: transactions.description,
    })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .get();

  if (!row) {
    throw new Error("Transaction was not found for the current user.");
  }

  const result = db
    .update(transactions)
    .set({
      categoryId,
      verificationStatus: "verified",
      updatedAt: nowIso(),
      ...(options?.isRecurring !== undefined ? { isRecurring: options.isRecurring } : {}),
    })
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .run();

  if (result.changes === 0) {
    throw new Error("Transaction was not found for the current user.");
  }

  if (options?.rememberPattern) {
    upsertCorrectionMemory({
      userId,
      categoryId,
      merchantName: row.merchantName,
      description: row.description,
    });
  }
}

export function listTransactionsForUser(
  userId: string,
  filters: TransactionFilters = {},
): TransactionListItem[] {
  const conditions: SQL[] = [eq(transactions.userId, userId)];

  if (filters.type) {
    conditions.push(eq(transactions.type, filters.type));
  }

  if (filters.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }

  if (filters.query) {
    const pattern = `%${filters.query}%`;

    const queryCondition = or(
      like(transactions.description, pattern),
      like(transactions.merchantName, pattern),
    );

    if (queryCondition) {
      conditions.push(queryCondition);
    }
  }

  if (filters.verificationStatus) {
    conditions.push(eq(transactions.verificationStatus, filters.verificationStatus));
  }

  const dateExpr =
    filters.sort === "oldest" ? asc(transactions.transactionDate) : desc(transactions.transactionDate);
  const createdExpr =
    filters.sort === "oldest" ? asc(transactions.createdAt) : desc(transactions.createdAt);

  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      transactionDate: transactions.transactionDate,
      amountPlnMinor: transactions.amountPlnMinor,
      description: transactions.description,
      merchantName: transactions.merchantName,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      isRecurring: transactions.isRecurring,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(dateExpr, createdExpr)
    .limit(100)
    .all();
}

export function summarizeCurrentYearForUser(userId: string) {
  const year = new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const rows = db
    .select({
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amountPlnMinor}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.transactionDate, start),
        lte(transactions.transactionDate, end),
      ),
    )
    .groupBy(transactions.type)
    .all();

  const income = rows.find((row) => row.type === "income")?.total ?? 0;
  const expense = rows.find((row) => row.type === "expense")?.total ?? 0;

  return {
    income,
    expense,
    balance: income - expense,
  };
}

export function summarizeMonthForUser(userId: string, month: string) {
  const { start, end } = monthDateRange(month);
  const rows = db
    .select({
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amountPlnMinor}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.transactionDate, start),
        lte(transactions.transactionDate, end),
      ),
    )
    .groupBy(transactions.type)
    .all();

  const income = rows.find((row) => row.type === "income")?.total ?? 0;
  const expense = rows.find((row) => row.type === "expense")?.total ?? 0;

  return {
    income,
    expense,
    balance: income - expense,
  };
}

export function summarizeExpensesByCategoryForMonth(userId: string, month: string) {
  const { start, end } = monthDateRange(month);

  return db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      spentPlnMinor: sql<number>`coalesce(sum(${transactions.amountPlnMinor}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.transactionDate, start),
        lte(transactions.transactionDate, end),
      ),
    )
    .groupBy(transactions.categoryId, categories.name)
    .all();
}

export function summarizeYearByMonthForUser(userId: string, year: number) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const rows = db
    .select({
      month: sql<string>`substr(${transactions.transactionDate}, 1, 7)`,
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amountPlnMinor}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.transactionDate, start),
        lte(transactions.transactionDate, end),
      ),
    )
    .groupBy(sql`substr(${transactions.transactionDate}, 1, 7)`, transactions.type)
    .all();

  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const income = rows.find((row) => row.month === month && row.type === "income")?.total ?? 0;
    const expense =
      rows.find((row) => row.month === month && row.type === "expense")?.total ?? 0;

    return {
      month,
      income,
      expense,
      balance: income - expense,
    };
  });
}

export function summarizeYearForUser(userId: string, year: number) {
  const months = summarizeYearByMonthForUser(userId, year);
  const income = months.reduce((sum, month) => sum + month.income, 0);
  const expense = months.reduce((sum, month) => sum + month.expense, 0);

  return {
    income,
    expense,
    balance: income - expense,
  };
}

export function summarizeExpensesByCategoryForYear(userId: string, year: number) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  return db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      spentPlnMinor: sql<number>`coalesce(sum(${transactions.amountPlnMinor}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.transactionDate, start),
        lte(transactions.transactionDate, end),
      ),
    )
    .groupBy(transactions.categoryId, categories.name)
    .orderBy(sql`sum(${transactions.amountPlnMinor}) desc`)
    .all();
}

export function getTransactionForUser(userId: string, transactionId: string) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .get();
}

export function countTransactionsNeedingReviewForUser(userId: string) {
  const row = db
    .select({ total: sql<number>`count(*)` })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.verificationStatus, "needs_review")))
    .get();

  return row?.total ?? 0;
}

export function applyMemoryHitToTransaction(
  userId: string,
  transactionId: string,
  categoryId: string,
) {
  ensureCategoryForUser(userId, categoryId);

  const result = db
    .update(transactions)
    .set({
      categoryId,
      verificationStatus: "verified",
      updatedAt: nowIso(),
    })
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .run();

  if (result.changes === 0) {
    throw new Error("Transaction was not found for the current user.");
  }
}

export function applyAiCategorizationToTransaction(input: {
  userId: string;
  transactionId: string;
  categoryId: string | null;
  description?: string | null;
  tagListJson?: string | null;
  verificationStatus: "auto_categorized" | "needs_review";
}) {
  const now = nowIso();

  if (input.categoryId) {
    ensureCategoryForUser(input.userId, input.categoryId);
  }

  const nextDescription =
    input.description && input.description.trim() ? input.description.trim() : undefined;

  const base = {
    verificationStatus: input.verificationStatus,
    updatedAt: now,
  };

  if (input.categoryId) {
    db.update(transactions)
      .set({
        categoryId: input.categoryId,
        ...(nextDescription ? { description: nextDescription } : {}),
        ...(input.tagListJson ? { tagList: input.tagListJson } : {}),
        ...base,
      })
      .where(and(eq(transactions.id, input.transactionId), eq(transactions.userId, input.userId)))
      .run();
    return;
  }

  db.update(transactions)
    .set({
      ...(nextDescription ? { description: nextDescription } : {}),
      ...(input.tagListJson ? { tagList: input.tagListJson } : {}),
      ...base,
    })
    .where(and(eq(transactions.id, input.transactionId), eq(transactions.userId, input.userId)))
    .run();
}
