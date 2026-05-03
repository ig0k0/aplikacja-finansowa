import Link from "next/link";
import { formatCurrencyMinor } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type YearlyReportPageProps = {
  searchParams?: Promise<{
    year?: string;
  }>;
};

function normalizeYear(year?: string) {
  const parsedYear = Number(year);

  if (Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100) {
    return parsedYear;
  }

  return new Date().getFullYear();
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T00:00:00`));
}

export default async function YearlyReportPage({ searchParams }: YearlyReportPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};
  const year = normalizeYear(params.year);
  const {
    summarizeYearByMonthForUser,
    summarizeYearForUser,
    summarizeExpensesByCategoryForYear,
  } = await import("@/db/transactions");
  const summary = summarizeYearForUser(user.id, year);
  const months = summarizeYearByMonthForUser(user.id, year);
  const categoryRows = summarizeExpensesByCategoryForYear(user.id, year);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="muted">Raport roczny</p>
          <h1 style={{ margin: 0 }}>{year}</h1>
        </div>
        <div className="inline-form">
          <Link className="button button-secondary" href="/reports/monthly">
            Raport miesieczny
          </Link>
          <Link className="button button-secondary" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 24 }}>
        <form className="form-grid" action="/reports/yearly">
          <label className="field">
            Rok
            <input
              className="input"
              name="year"
              type="number"
              min="2000"
              max="2100"
              defaultValue={year}
            />
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
        <h2>Miesiac po miesiacu</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Miesiac</th>
                <th>Przychody</th>
                <th>Wydatki</th>
                <th>Bilans</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr key={month.month}>
                  <td>{monthLabel(month.month)}</td>
                  <td>{formatCurrencyMinor(month.income)}</td>
                  <td>{formatCurrencyMinor(month.expense)}</td>
                  <td>{formatCurrencyMinor(month.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Najwieksze kategorie wydatkow</h2>
        {categoryRows.length === 0 ? (
          <p className="muted">Brak wydatkow w tym roku.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kategoria</th>
                  <th>Wydano</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((row) => (
                  <tr key={row.categoryId ?? "none"}>
                    <td>{row.categoryName ?? "Bez kategorii"}</td>
                    <td>{formatCurrencyMinor(row.spentPlnMinor)}</td>
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
