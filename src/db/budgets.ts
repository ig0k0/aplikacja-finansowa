import { and, eq } from "drizzle-orm";
import { budgets, categories } from "./schema";
import { db } from "./client";
import { createId } from "../lib/ids";
import { nowIso } from "../lib/time";

export type BudgetLimitInput = {
  userId: string;
  categoryId: string;
  month: string;
  limitPlnMinor: number;
};

export type MonthlyBudget = {
  categoryId: string;
  categoryName: string;
  limitPlnMinor: number;
};

function ensureExpenseCategoryForUser(userId: string, categoryId: string) {
  const category = db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.userId, userId),
        eq(categories.type, "expense"),
        eq(categories.isArchived, false),
      ),
    )
    .get();

  if (!category) {
    throw new Error("Budget category must be an active expense category.");
  }
}

export function upsertBudgetLimit(input: BudgetLimitInput) {
  ensureExpenseCategoryForUser(input.userId, input.categoryId);

  const existing = db
    .select({ id: budgets.id })
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, input.userId),
        eq(budgets.categoryId, input.categoryId),
        eq(budgets.month, input.month),
      ),
    )
    .get();
  const now = nowIso();

  if (existing) {
    db.update(budgets)
      .set({ limitPlnMinor: input.limitPlnMinor, updatedAt: now })
      .where(and(eq(budgets.id, existing.id), eq(budgets.userId, input.userId)))
      .run();
    return;
  }

  db.insert(budgets)
    .values({
      id: createId("bud"),
      userId: input.userId,
      categoryId: input.categoryId,
      month: input.month,
      limitPlnMinor: input.limitPlnMinor,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

export function listBudgetsForMonth(userId: string, month: string): MonthlyBudget[] {
  return db
    .select({
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      limitPlnMinor: budgets.limitPlnMinor,
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(and(eq(budgets.userId, userId), eq(budgets.month, month)))
    .all();
}
