import Link from "next/link";
import { MonthlyTrendChart } from "@/app/insights/monthly-trend-chart";
import { currentMonthInputValue } from "@/domain/budgets";
import { formatCurrencyMinor, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { logoutAction } from "./actions";
import { ExpenseBarChart } from "./expense-bar-chart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const month = currentMonthInputValue();
  const [
    { listCategoriesForUser },
    {
      listTransactionsForUser,
      summarizeCurrentYearForUser,
      summarizeMonthForUser,
      summarizeExpensesByCategoryForMonth,
      countTransactionsNeedingReviewForUser,
    },
    { summarizeInvestmentsForUser },
    { summarizeRollingMonthsForUser },
    { listFinancialAccountsForUser },
  ] = await Promise.all([
    import("@/db/categories"),
    import("@/db/transactions"),
    import("@/db/investments"),
    import("@/db/analytics"),
    import("@/db/financial-accounts"),
  ]);
  const categories = listCategoriesForUser(user.id);
  const summary = summarizeCurrentYearForUser(user.id);
  const monthSummary = summarizeMonthForUser(user.id, month);
  const reviewCount = countTransactionsNeedingReviewForUser(user.id);
  const investments = summarizeInvestmentsForUser(user.id);
  const accountCount = listFinancialAccountsForUser(user.id).length;
  const recentTransactions = listTransactionsForUser(user.id).slice(0, 5);
  const expenseCategories = summarizeExpensesByCategoryForMonth(user.id, month).sort(
    (left, right) => right.spentPlnMinor - left.spentPlnMinor,
  );
  const trendPoints = summarizeRollingMonthsForUser(user.id, month, 6);
  const hasTrendData = trendPoints.some(
    (point) => point.incomePlnMinor > 0 || point.expensePlnMinor > 0,
  );
  const parentCategoryCount = categories.filter((category) => !category.parentId).length;

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar" aria-label="Główna nawigacja">
        <Link className="dashboard-brand" href="/dashboard">
          <span aria-hidden="true">●</span>
          Moje finanse
        </Link>
        <nav className="dashboard-nav">
          <Link className="dashboard-nav-active" href="/dashboard">Przegląd</Link>
          <Link href="/transactions">Transakcje</Link>
          <Link href="/imports">Import pliku</Link>
          <Link href="/review">Weryfikacja{reviewCount > 0 ? ` (${reviewCount})` : ""}</Link>
          <Link href="/insights">Analityka</Link>
          <Link href="/investments">Inwestycje</Link>
          <Link href="/settings/accounts">Konta</Link>
          <Link href="/settings/security">Bezpieczeństwo</Link>
        </nav>
        <div className="dashboard-sidebar-footer">
          <span>{user.displayName}</span>
          <form action={logoutAction}>
            <button type="submit">Wyloguj</button>
          </form>
        </div>
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Przegląd finansów</p>
            <h1>Dzień dobry, {user.displayName}</h1>
            <p className="muted">Stan na {month}. Dane pozostają oddzielone dla każdego użytkownika.</p>
          </div>
          <div className="dashboard-header-actions">
            <Link className="button button-secondary" href="/settings/ai-memory">Pamięć korekt</Link>
            <Link className="button" href="/transactions">Dodaj transakcję</Link>
          </div>
        </header>

        <section className="dashboard-metrics" aria-label="Podsumowanie miesiąca">
          <MetricCard label="Przychody w miesiącu" value={formatCurrencyMinor(monthSummary.income)} tone="income" />
          <MetricCard label="Wydatki w miesiącu" value={formatCurrencyMinor(monthSummary.expense)} tone="expense" />
          <MetricCard label="Bilans miesiąca" value={formatCurrencyMinor(monthSummary.balance)} tone="balance" />
          <MetricCard label="Do weryfikacji" value={String(reviewCount)} detail="transakcji" tone="review" />
        </section>

        <section className="dashboard-analysis-grid">
          <article className="dashboard-panel dashboard-panel-wide">
            <div className="dashboard-panel-heading">
              <div>
                <p className="eyebrow">Przepływy</p>
                <h2>Przychody i wydatki</h2>
              </div>
              <Link href={`/insights?month=${month}`}>Pełna analityka</Link>
            </div>
            {hasTrendData ? (
              <MonthlyTrendChart points={trendPoints} />
            ) : (
              <p className="muted dashboard-empty">Dodaj pierwszą transakcję, aby zobaczyć trend.</p>
            )}
          </article>

          <article className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div>
                <p className="eyebrow">{month}</p>
                <h2>Największe wydatki</h2>
              </div>
              <Link href={`/reports/monthly?month=${month}`}>Raport</Link>
            </div>
            <ExpenseBarChart rows={expenseCategories} />
          </article>
        </section>

        <section className="dashboard-bottom-grid">
          <article className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div>
                <p className="eyebrow">Ostatnie operacje</p>
                <h2>Transakcje</h2>
              </div>
              <Link href="/transactions">Zobacz wszystkie</Link>
            </div>
            {recentTransactions.length === 0 ? (
              <p className="muted dashboard-empty">Nie ma jeszcze zapisanych transakcji.</p>
            ) : (
              <ul className="recent-transactions">
                {recentTransactions.map((transaction) => (
                  <li key={transaction.id}>
                    <span className={`transaction-kind transaction-kind-${transaction.type}`} aria-hidden="true" />
                    <div>
                      <strong>{transaction.description ?? transaction.merchantName ?? "Transakcja bez opisu"}</strong>
                      <span>{formatDate(transaction.transactionDate)} · {transaction.categoryName ?? "Bez kategorii"}</span>
                    </div>
                    <b className={transaction.type === "income" ? "amount-income" : "amount-expense"}>
                      {transaction.type === "income" ? "+" : "−"}{formatCurrencyMinor(transaction.amountPlnMinor)}
                    </b>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="dashboard-panel dashboard-actions">
            <p className="eyebrow">Skróty</p>
            <h2>Co chcesz zrobić?</h2>
            <Link href="/imports">Zaimportuj wyciąg bankowy <span aria-hidden="true">→</span></Link>
            <Link href="/review">Sprawdź kolejkę weryfikacji <span aria-hidden="true">→</span></Link>
            <Link href="/settings/accounts">Zarządzaj kontami ({accountCount}) <span aria-hidden="true">→</span></Link>
            <Link href="/investments">Zobacz portfel: {formatCurrencyMinor(investments.totalMarketPlnMinor)} <span aria-hidden="true">→</span></Link>
          </article>

          <article className="dashboard-panel dashboard-portfolio">
            <p className="eyebrow">Portfel inwestycyjny</p>
            <h2>{formatCurrencyMinor(investments.totalMarketPlnMinor)}</h2>
            <p className="muted">Koszt bazy: {formatCurrencyMinor(investments.totalCostPlnMinor)}</p>
            <p className={investments.pnlPlnMinor >= 0 ? "amount-income" : "amount-expense"}>
              Wynik: {formatCurrencyMinor(investments.pnlPlnMinor)}
            </p>
            <Link href="/investments">Przejdź do inwestycji</Link>
          </article>
        </section>

        <section className="dashboard-year-note">
          <span>Rok {new Date().getFullYear()}</span>
          <strong>Bilans: {formatCurrencyMinor(summary.balance)}</strong>
          <span>Przychody {formatCurrencyMinor(summary.income)} · wydatki {formatCurrencyMinor(summary.expense)}</span>
          <span>{parentCategoryCount} kategorii głównych</span>
        </section>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone: string;
}) {
  return (
    <section className={`dashboard-metric dashboard-metric-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail ?? "bieżący miesiąc"}</span>
    </section>
  );
}
