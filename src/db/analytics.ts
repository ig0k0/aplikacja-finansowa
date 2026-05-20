import { and, eq, gte, lte, sql } from "drizzle-orm";
import { currentMonthInputValue, monthDateRange } from "@/domain/budgets";
import { summarizeExpensesByCategoryForMonth, summarizeMonthForUser } from "./transactions";
import { db } from "./client";
import { categories, transactions } from "./schema";

export type CategoryMoMRow = {
  categoryId: string | null;
  categoryName: string;
  currentPlnMinor: number;
  previousPlnMinor: number;
  deltaPlnMinor: number;
  deltaPercent: number | null;
};

export type MonthExpenseForecast = {
  applicable: boolean;
  expenseSoFarPlnMinor: number;
  dayOfMonth: number;
  daysInMonth: number;
  projectedExpensePlnMinor: number;
};

export function getPreviousMonthLabel(month: string): string {
  const [yearValue, monthValue] = month.split("-").map(Number);
  const firstOfPrevious = new Date(yearValue, monthValue - 2, 1);

  return `${firstOfPrevious.getFullYear()}-${String(firstOfPrevious.getMonth() + 1).padStart(2, "0")}`;
}

function addCalendarMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type MonthlyTotalsPoint = {
  month: string;
  incomePlnMinor: number;
  expensePlnMinor: number;
  balancePlnMinor: number;
};

/** Ostatnie `monthCount` pelnych miesiecy kalendarzowych, konczace sie na `endMonth` (wlacznie). */
export function summarizeRollingMonthsForUser(
  userId: string,
  endMonth: string,
  monthCount: number,
): MonthlyTotalsPoint[] {
  const startMonth = addCalendarMonths(endMonth, -(monthCount - 1));
  const result: MonthlyTotalsPoint[] = [];
  let cur = startMonth;

  for (let i = 0; i < monthCount; i++) {
    const s = summarizeMonthForUser(userId, cur);
    result.push({
      month: cur,
      incomePlnMinor: s.income,
      expensePlnMinor: s.expense,
      balancePlnMinor: s.balance,
    });
    cur = addCalendarMonths(cur, 1);
  }

  return result;
}

export type CategoryExpenseMonthPoint = {
  month: string;
  spentPlnMinor: number;
};

export type CategoryExpenseTrendSeries = {
  categoryId: string | null;
  categoryName: string;
  points: CategoryExpenseMonthPoint[];
};

/** Wydatki w top N kategoriach (wg miesiaca koncowego) w oknie `monthCount` miesiecy. */
export function summarizeTopCategoryExpenseTrends(
  userId: string,
  endMonth: string,
  monthCount = 12,
  topN = 5,
): CategoryExpenseTrendSeries[] {
  const topCategories = summarizeExpensesByCategoryForMonth(userId, endMonth)
    .filter((row) => row.spentPlnMinor > 0)
    .slice(0, topN);

  if (topCategories.length === 0) {
    return [];
  }

  const startMonth = addCalendarMonths(endMonth, -(monthCount - 1));
  const months: string[] = [];
  let cur = startMonth;

  for (let i = 0; i < monthCount; i++) {
    months.push(cur);
    cur = addCalendarMonths(cur, 1);
  }

  const { start, end } = lookbackInclusiveEndMonth(endMonth, monthCount);
  const topKeys = new Set(topCategories.map((row) => row.categoryId ?? "__none__"));

  const aggregated = db
    .select({
      categoryId: transactions.categoryId,
      month: sql<string>`strftime('%Y-%m', ${transactions.transactionDate})`,
      spentPlnMinor: sql<number>`coalesce(sum(${transactions.amountPlnMinor}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.transactionDate, start),
        lte(transactions.transactionDate, end),
      ),
    )
    .groupBy(transactions.categoryId, sql`strftime('%Y-%m', ${transactions.transactionDate})`)
    .all();

  const spentByCategoryMonth = new Map<string, Map<string, number>>();

  for (const row of aggregated) {
    const key = row.categoryId ?? "__none__";

    if (!topKeys.has(key)) {
      continue;
    }

    let monthMap = spentByCategoryMonth.get(key);

    if (!monthMap) {
      monthMap = new Map();
      spentByCategoryMonth.set(key, monthMap);
    }

    monthMap.set(row.month, row.spentPlnMinor);
  }

  return topCategories.map((category) => {
    const key = category.categoryId ?? "__none__";
    const monthMap = spentByCategoryMonth.get(key);

    return {
      categoryId: category.categoryId,
      categoryName: category.categoryName ?? "Bez kategorii",
      points: months.map((month) => ({
        month,
        spentPlnMinor: monthMap?.get(month) ?? 0,
      })),
    };
  });
}

export function compareExpenseCategoriesMonthOverMonth(userId: string, month: string): CategoryMoMRow[] {
  const prevMonth = getPreviousMonthLabel(month);
  const currentRows = summarizeExpensesByCategoryForMonth(userId, month);
  const previousRows = summarizeExpensesByCategoryForMonth(userId, prevMonth);

  const map = new Map<
    string,
    { categoryId: string | null; name: string; currentPlnMinor: number; previousPlnMinor: number }
  >();

  for (const row of currentRows) {
    const key = row.categoryId ?? "__none__";
    map.set(key, {
      categoryId: row.categoryId,
      name: row.categoryName ?? "Bez kategorii",
      currentPlnMinor: row.spentPlnMinor,
      previousPlnMinor: 0,
    });
  }

  for (const row of previousRows) {
    const key = row.categoryId ?? "__none__";
    const existing = map.get(key);
    if (existing) {
      existing.previousPlnMinor = row.spentPlnMinor;
    } else {
      map.set(key, {
        categoryId: row.categoryId,
        name: row.categoryName ?? "Bez kategorii",
        currentPlnMinor: 0,
        previousPlnMinor: row.spentPlnMinor,
      });
    }
  }

  const rows: CategoryMoMRow[] = [];

  for (const item of map.values()) {
    const deltaPlnMinor = item.currentPlnMinor - item.previousPlnMinor;
    let deltaPercent: number | null;
    if (item.previousPlnMinor > 0) {
      deltaPercent = Math.round((deltaPlnMinor / item.previousPlnMinor) * 100);
    } else if (item.currentPlnMinor > 0) {
      deltaPercent = null;
    } else {
      deltaPercent = 0;
    }

    rows.push({
      categoryId: item.categoryId,
      categoryName: item.name,
      currentPlnMinor: item.currentPlnMinor,
      previousPlnMinor: item.previousPlnMinor,
      deltaPlnMinor,
      deltaPercent,
    });
  }

  return rows
    .filter((row) => row.currentPlnMinor > 0 || row.previousPlnMinor > 0)
    .sort((a, b) => b.deltaPlnMinor - a.deltaPlnMinor);
}

export function forecastMonthEndExpenses(userId: string, month: string): MonthExpenseForecast {
  const today = new Date();
  const calendarMonth = currentMonthInputValue();

  if (month !== calendarMonth) {
    return {
      applicable: false,
      expenseSoFarPlnMinor: 0,
      dayOfMonth: 0,
      daysInMonth: 0,
      projectedExpensePlnMinor: 0,
    };
  }

  const [yearValue, monthValue] = month.split("-").map(Number);
  const daysInMonth = new Date(yearValue, monthValue, 0).getDate();
  const dayOfMonth = Math.min(today.getDate(), daysInMonth);
  const summary = summarizeMonthForUser(userId, month);
  const expenseSoFarPlnMinor = summary.expense;

  if (dayOfMonth <= 0) {
    return {
      applicable: true,
      expenseSoFarPlnMinor,
      dayOfMonth: 1,
      daysInMonth,
      projectedExpensePlnMinor: expenseSoFarPlnMinor,
    };
  }

  const projectedExpensePlnMinor = Math.round((expenseSoFarPlnMinor / dayOfMonth) * daysInMonth);

  return {
    applicable: true,
    expenseSoFarPlnMinor,
    dayOfMonth,
    daysInMonth,
    projectedExpensePlnMinor,
  };
}

export type RecurringExpenseRow = {
  categoryId: string | null;
  categoryName: string;
  spentPlnMinor: number;
};

export function summarizeRecurringExpensesByCategoryForMonth(
  userId: string,
  month: string,
): RecurringExpenseRow[] {
  const { start, end } = monthDateRange(month);

  return db
    .select({
      categoryId: transactions.categoryId,
      categoryName: sql<string>`coalesce(${categories.name}, 'Bez kategorii')`,
      spentPlnMinor: sql<number>`coalesce(sum(${transactions.amountPlnMinor}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        eq(transactions.isRecurring, true),
        gte(transactions.transactionDate, start),
        lte(transactions.transactionDate, end),
      ),
    )
    .groupBy(transactions.categoryId, sql`coalesce(${categories.name}, 'Bez kategorii')`)
    .orderBy(sql`sum(${transactions.amountPlnMinor}) desc`)
    .all();
}

export function totalRecurringExpensesForMonth(userId: string, month: string): number {
  const rows = summarizeRecurringExpensesByCategoryForMonth(userId, month);

  return rows.reduce((sum, row) => sum + row.spentPlnMinor, 0);
}

/** Okno [start,end] obejmuje dokladnie `monthCount` pelnych miesiecy kalendarzowych konczacych sie w endMonth. */
function lookbackInclusiveEndMonth(endMonth: string, monthCount: number): { start: string; end: string } {
  const [yearValue, monthValue] = endMonth.split("-").map(Number);
  const lastDay = new Date(yearValue, monthValue, 0).getDate();
  const end = `${endMonth}-${String(lastDay).padStart(2, "0")}`;
  const startDate = new Date(yearValue, monthValue - monthCount, 1);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;

  return { start, end };
}

type GroupKind = "merchant" | "description";

function expenseGroupingKey(
  merchantName: string | null,
  description: string | null,
): { key: string | null; kind: GroupKind } {
  const merchant = merchantName?.trim();
  if (merchant && merchant.length >= 2) {
    return {
      key: `m:${merchant.toLowerCase().replace(/\s+/g, " ").slice(0, 120)}`,
      kind: "merchant",
    };
  }

  const desc = description?.trim();
  if (desc && desc.length >= 8) {
    return {
      key: `d:${desc.toLowerCase().replace(/\s+/g, " ").slice(0, 96)}`,
      kind: "description",
    };
  }

  return { key: null, kind: "merchant" };
}

function passesAmountStability(amounts: number[]): boolean {
  if (amounts.length < 2) {
    return false;
  }

  const sorted = [...amounts].sort((first, second) => first - second);
  const minAmount = sorted[0]!;
  const maxAmount = sorted[sorted.length - 1]!;

  if (minAmount <= 0) {
    return false;
  }

  if (amounts.length === 2) {
    return maxAmount / minAmount <= 2.75;
  }

  const mean = amounts.reduce((sum, value) => sum + value, 0) / amounts.length;
  if (mean <= 0) {
    return false;
  }

  const variance = amounts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / amounts.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;

  return coefficientOfVariation <= 0.85;
}

export type HeuristicRecurringCandidate = {
  label: string;
  distinctMonthCount: number;
  transactionCount: number;
  totalPlnMinor: number;
  avgPlnMinor: number;
};

/**
 * Wykrywa wzorce przypominajace stale oplaty: ten sam sklep (merchant) lub powtarzalny opis,
 * wystapienia w >= 2 roznych miesiacach w oknie, dosc stabilna kwota.
 * To nie zastepuje recznego oznaczenia — sluzy jako podpowiedz.
 */
export function listHeuristicRecurringCandidates(
  userId: string,
  endMonth: string,
  lookbackMonths = 6,
  limit = 20,
): HeuristicRecurringCandidate[] {
  const { start, end } = lookbackInclusiveEndMonth(endMonth, lookbackMonths);

  const rows = db
    .select({
      transactionDate: transactions.transactionDate,
      amountPlnMinor: transactions.amountPlnMinor,
      merchantName: transactions.merchantName,
      description: transactions.description,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.transactionDate, start),
        lte(transactions.transactionDate, end),
      ),
    )
    .all();

  type Agg = {
    amounts: number[];
    displayLabel: string;
    kind: GroupKind;
    months: Set<string>;
  };

  const groups = new Map<string, Agg>();

  for (const row of rows) {
    const { key, kind } = expenseGroupingKey(row.merchantName, row.description);
    if (!key) {
      continue;
    }

    const monthKey = row.transactionDate.slice(0, 7);
    const label =
      kind === "merchant"
        ? (row.merchantName?.trim() ?? key.slice(2))
        : `Opis: ${(row.description ?? "").trim().slice(0, 72)}`;

    const existing = groups.get(key);
    if (existing) {
      existing.months.add(monthKey);
      existing.amounts.push(row.amountPlnMinor);
    } else {
      groups.set(key, {
        amounts: [row.amountPlnMinor],
        displayLabel: label,
        kind,
        months: new Set([monthKey]),
      });
    }
  }

  const candidates: HeuristicRecurringCandidate[] = [];

  for (const group of groups.values()) {
    const distinctMonthCount = group.months.size;
    const transactionCount = group.amounts.length;

    if (distinctMonthCount < 2 || transactionCount < 2) {
      continue;
    }

    if (group.kind === "description" && distinctMonthCount < 3 && transactionCount < 4) {
      continue;
    }

    if (!passesAmountStability(group.amounts)) {
      continue;
    }

    const totalPlnMinor = group.amounts.reduce((sum, value) => sum + value, 0);
    const avgPlnMinor = Math.round(totalPlnMinor / transactionCount);

    candidates.push({
      avgPlnMinor,
      distinctMonthCount,
      label: group.displayLabel,
      totalPlnMinor,
      transactionCount,
    });
  }

  return candidates
    .sort((a, b) => {
      if (b.distinctMonthCount !== a.distinctMonthCount) {
        return b.distinctMonthCount - a.distinctMonthCount;
      }

      return b.totalPlnMinor - a.totalPlnMinor;
    })
    .slice(0, limit);
}
