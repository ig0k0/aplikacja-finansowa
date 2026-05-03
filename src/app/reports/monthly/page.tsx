import Link from "next/link";
import { currentMonthInputValue } from "@/domain/budgets";
import { formatCurrencyMinor } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { saveBudgetLimitAction } from "./actions";

export const dynamic = "force-dynamic";

type MonthlyReportPageProps = {
  searchParams?: Promise<{
    month?: string;
    error?: string;
    saved?: string;
  }>;
};

function normalizeMonth(month?: string) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return month;
  }

  return currentMonthInputValue();
}

function percent(spent: number, limit: number) {
  if (limit <= 0) {
    return 0;
  }

  return Math.round((spent / limit) * 100);
}

export default async function MonthlyReportPage({ searchParams }: MonthlyReportPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};
  const month = normalizeMonth(params.month);
  const [
    { listCategoriesForUser },
    {
      summarizeMonthForUser,
      summarizeExpensesByCategoryForMonth,
    },
    { listBudgetsForMonth },
  ] = await Promise.all([
    import("@/db/categories"),
    import("@/db/transactions"),
    import("@/db/budgets"),
  ]);
  const categories = listCategoriesForUser(user.id);
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const summary = summarizeMonthForUser(user.id, month);
  const expenses = summarizeExpensesByCategoryForMonth(user.id, month);
  const budgets = listBudgetsForMonth(user.id, month);
  const budgetByCategory = new Map(
    budgets.map((budget) => [budget.categoryId, budget.limitPlnMinor]),
  );
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const categoryIds = new Set([
    ...expenseCategories.map((category) => category.id),
    ...expenses
      .map((expense) => expense.categoryId)
      .filter((categoryId): categoryId is string => Boolean(categoryId)),
  ]);
  const rows = Array.from(categoryIds)
    .map((categoryId) => {
      const spent = expenses.find((expense) => expense.categoryId === categoryId);
      const limit = budgetByCategory.get(categoryId) ?? 0;
      const spentPlnMinor = spent?.spentPlnMinor ?? 0;

      return {
        categoryId,
        categoryName: categoryNames.get(categoryId) ?? spent?.categoryName ?? "Bez kategorii",
        spentPlnMinor,
        limitPlnMinor: limit,
        remainingPlnMinor: limit - spentPlnMinor,
        usagePercent: percent(spentPlnMinor, limit),
      };
    })
    .filter((row) => row.spentPlnMinor > 0 || row.limitPlnMinor > 0)
    .sort((first, second) => second.spentPlnMinor - first.spentPlnMinor);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="muted">Raport miesieczny</p>
          <h1 style={{ margin: 0 }}>{month}</h1>
        </div>
        <div className="inline-form">
          <Link className="button button-secondary" href="/insights">
            Analityka
          </Link>
          <Link className="button button-secondary" href="/reports/yearly">
            Raport roczny
          </Link>
          <Link className="button button-secondary" href="/transactions">
            Transakcje
          </Link>
          <Link className="button button-secondary" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </header>

      {params.error ? <p className="card error">{params.error}</p> : null}
      {params.saved ? (
        <p className="card" style={{ borderColor: "#86efac" }}>
          Limit budzetu zostal zapisany.
        </p>
      ) : null}

      <section className="card" style={{ marginBottom: 24 }}>
        <form className="form-grid" action="/reports/monthly">
          <label className="field">
            Miesiac
            <input className="input" name="month" type="month" defaultValue={month} />
          </label>
          <button className="button" type="submit">
            Pokaz raport
          </button>
        </form>
      </section>

      <section className="grid grid-3" style={{ marginBottom: 24 }}>
        <MetricCard label="Przychody" value={formatCurrencyMinor(summary.income)} />
        <MetricCard label="Wydatki" value={formatCurrencyMinor(summary.expense)} />
        <MetricCard label="Bilans" value={formatCurrencyMinor(summary.balance)} />
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Ustaw limit kategorii</h2>
        <form action={saveBudgetLimitAction} className="form-grid">
          <input name="month" type="hidden" value={month} />
          <label className="field">
            Kategoria
            <select className="input" name="categoryId" defaultValue="">
              <option value="" disabled>
                Wybierz kategorie
              </option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Limit PLN
            <input className="input" name="limit" inputMode="decimal" placeholder="500,00" />
          </label>
          <button className="button" type="submit">
            Zapisz limit
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Wydatki wedlug kategorii</h2>
        {rows.length === 0 ? (
          <p className="muted">Brak wydatkow i limitow dla tego miesiaca.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kategoria</th>
                  <th>Wydano</th>
                  <th>Limit</th>
                  <th>Pozostalo</th>
                  <th>Wykorzystanie</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.categoryId}>
                    <td>{row.categoryName}</td>
                    <td>{formatCurrencyMinor(row.spentPlnMinor)}</td>
                    <td>{formatCurrencyMinor(row.limitPlnMinor)}</td>
                    <td>{formatCurrencyMinor(row.remainingPlnMinor)}</td>
                    <td>{row.limitPlnMinor > 0 ? `${row.usagePercent}%` : "Brak limitu"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="card">
      <p className="muted" style={{ marginTop: 0 }}>
        {label}
      </p>
      <strong style={{ fontSize: 28 }}>{value}</strong>
    </section>
  );
}
