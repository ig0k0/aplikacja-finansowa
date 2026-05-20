import Link from "next/link";
import { currentMonthInputValue } from "@/domain/budgets";
import {
  compareExpenseCategoriesMonthOverMonth,
  forecastMonthEndExpenses,
  getPreviousMonthLabel,
  listHeuristicRecurringCandidates,
  summarizeRecurringExpensesByCategoryForMonth,
  summarizeRollingMonthsForUser,
  summarizeTopCategoryExpenseTrends,
  totalRecurringExpensesForMonth,
} from "@/db/analytics";
import { formatCurrencyMinor } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { CategoryExpenseTrendChart } from "./category-expense-trend-chart";
import { MonthlyTrendChart } from "./monthly-trend-chart";

export const dynamic = "force-dynamic";

type InsightsPageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

function normalizeMonth(month?: string) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return month;
  }

  return currentMonthInputValue();
}

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};
  const month = normalizeMonth(params.month);
  const previousMonthLabel = getPreviousMonthLabel(month);

  const momRows = compareExpenseCategoriesMonthOverMonth(user.id, month);
  const forecast = forecastMonthEndExpenses(user.id, month);
  const recurringByCategory = summarizeRecurringExpensesByCategoryForMonth(user.id, month);
  const recurringTotalPlnMinor = totalRecurringExpensesForMonth(user.id, month);
  const heuristicCandidates = listHeuristicRecurringCandidates(user.id, month, 6, 20);

  const trendPoints = summarizeRollingMonthsForUser(user.id, month, 12);
  const hasTrendData = trendPoints.some((p) => p.incomePlnMinor > 0 || p.expensePlnMinor > 0);
  const categoryTrendSeries = summarizeTopCategoryExpenseTrends(user.id, month, 12, 5);
  const hasCategoryTrendData = categoryTrendSeries.some((series) =>
    series.points.some((point) => point.spentPlnMinor > 0),
  );

  const recommendations: string[] = [];
  for (const row of momRows.filter((r) => r.deltaPlnMinor > 0).slice(0, 5)) {
    const pct =
      row.deltaPercent === null
        ? "brak porownania z poprzednim miesiacem"
        : `${row.deltaPercent}%`;
    recommendations.push(
      `Wydatki w „${row.categoryName}” wzrosly o ${formatCurrencyMinor(row.deltaPlnMinor)} (${pct}) wzgledem ${previousMonthLabel}.`,
    );
  }

  if (forecast.applicable && forecast.projectedExpensePlnMinor > 0) {
    recommendations.push(
      `Szacowany laczny wydatek na koniec ${month} przy obecnym tempie: ok. ${formatCurrencyMinor(forecast.projectedExpensePlnMinor)} (dzien ${forecast.dayOfMonth}/${forecast.daysInMonth}).`,
    );
  }

  if (recurringTotalPlnMinor > 0) {
    recommendations.push(
      `Oznaczone subskrypcje i stale oplaty (wydatki): ${formatCurrencyMinor(recurringTotalPlnMinor)} w ${month}.`,
    );
  }

  if (heuristicCandidates.length > 0) {
    recommendations.push(
      `Heurystyka wskazuje ${heuristicCandidates.length} potencjalnych wzorcow powtarzalnych oplat w oknie 6 miesiecy (koniec okna: ${month}) — sprawdz tabele ponizej.`,
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="muted">Analityka</p>
          <h1 style={{ margin: 0 }}>Wglady i rekomendacje</h1>
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
        <form className="form-grid" action="/insights">
          <label className="field">
            Miesiac
            <input className="input" name="month" type="month" defaultValue={month} />
          </label>
          <button className="button" type="submit">
            Pokaz
          </button>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Trend 12 miesiecy</h2>
        <p className="muted">
          Ostatnie 12 pelnych miesiecy kalendarzowych konczacych sie na <strong>{month}</strong>. Wykres liniowy:
          przychody i wydatki (sumy w PLN).
        </p>
        {hasTrendData ? (
          <MonthlyTrendChart points={trendPoints} />
        ) : (
          <p className="muted">Brak transakcji w tym oknie — wykres pojawi sie po wiekszej historii.</p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Top kategorie wydatkow (12 miesiecy)</h2>
        <p className="muted">
          Piec kategorii z najwyzszymi wydatkami w <strong>{month}</strong> — trend w ostatnich 12 pelnych
          miesiacach kalendarzowych konczacych sie na tym miesiacu.
        </p>
        {hasCategoryTrendData ? (
          <CategoryExpenseTrendChart series={categoryTrendSeries} />
        ) : (
          <p className="muted">Brak wydatkow w kategoriach w tym oknie.</p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Subskrypcje i stale oplaty</h2>
        <p className="muted">
          Sumuje wydatki z transakcji oznaczonych w formularzu (nowa transakcja, lista transakcji, kolejka weryfikacji) polem
          subskrypcja / stala oplata.
        </p>
        {recurringByCategory.length === 0 ? (
          <p className="muted">Brak oznaczonych wydatkow w tym miesiacu.</p>
        ) : (
          <>
            <p style={{ marginBottom: 16 }}>
              <strong>Razem: {formatCurrencyMinor(recurringTotalPlnMinor)}</strong>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kategoria</th>
                    <th>Suma</th>
                  </tr>
                </thead>
                <tbody>
                  {recurringByCategory.map((row) => (
                    <tr key={row.categoryId ?? "none"}>
                      <td>{row.categoryName}</td>
                      <td>{formatCurrencyMinor(row.spentPlnMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Heurystyka: podejrzane stale oplaty</h2>
        <p className="muted">
          Automatyczna analiza ostatnich <strong>6 miesiecy kalendarzowych</strong> konczacych sie w <strong>{month}</strong>. U grupuje
          po sklepie (pole kontrahent) albo po powtarzalnym opisie. Odrzuca zbyt zroznicowane kwoty. To tylko podpowiedz — zawsze
          zweryfikuj; oznacz transakcje recznie, jesli to faktyczna subskrypcja.
        </p>
        {heuristicCandidates.length === 0 ? (
          <p className="muted">Brak wzorcow spelniajacych progi (wiecej danych w czasie albo wyzsza powtarzalnosc kwot).</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Wzorzec</th>
                  <th>Miesiecy</th>
                  <th>Operacji</th>
                  <th>Lacznie (okno)</th>
                  <th>Srednia</th>
                </tr>
              </thead>
              <tbody>
                {heuristicCandidates.map((row, index) => (
                  <tr key={`${row.label}-${index}`}>
                    <td>{row.label}</td>
                    <td>{row.distinctMonthCount}</td>
                    <td>{row.transactionCount}</td>
                    <td>{formatCurrencyMinor(row.totalPlnMinor)}</td>
                    <td>{formatCurrencyMinor(row.avgPlnMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {forecast.applicable ? (
        <section className="grid grid-3" style={{ marginBottom: 24 }}>
          <MetricCard label="Wydatki narastajaco (do dzisiaj)" value={formatCurrencyMinor(forecast.expenseSoFarPlnMinor)} />
          <MetricCard
            label="Prognoza wydatkow na koniec miesiaca"
            value={formatCurrencyMinor(forecast.projectedExpensePlnMinor)}
          />
          <MetricCard label="Dzien miesiaca (do prognozy)" value={`${forecast.dayOfMonth} / ${forecast.daysInMonth}`} />
        </section>
      ) : (
        <section className="card muted" style={{ marginBottom: 24 }}>
          Prognoza konca miesiaca jest dostepna tylko dla biezacego miesiaca ({currentMonthInputValue()}).
        </section>
      )}

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-heading-row">
          <h2 style={{ margin: 0 }}>Porownanie z poprzednim miesiacem ({previousMonthLabel})</h2>
          <div className="inline-form">
            <a className="button button-secondary" href={`/insights/export?month=${encodeURIComponent(month)}`}>
              Eksport CSV
            </a>
            <a className="button button-secondary" href={`/insights/export/pdf?month=${encodeURIComponent(month)}`}>
              Eksport PDF
            </a>
          </div>
        </div>
        <p className="muted">
          Kategorie z najwiekszym wzrostem wydatkow (sortowanie malejaco wedlug zmiany). Kwoty w zlotowkach.
        </p>
        {momRows.length === 0 ? (
          <p className="muted">Brak danych wydatkowych dla tego okresu.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kategoria</th>
                  <th>{month}</th>
                  <th>{previousMonthLabel}</th>
                  <th>Zmiana</th>
                  <th>Zmiana %</th>
                </tr>
              </thead>
              <tbody>
                {momRows.map((row) => (
                  <tr key={row.categoryId ?? "none"}>
                    <td>{row.categoryName}</td>
                    <td>{formatCurrencyMinor(row.currentPlnMinor)}</td>
                    <td>{formatCurrencyMinor(row.previousPlnMinor)}</td>
                    <td>{formatCurrencyMinor(row.deltaPlnMinor)}</td>
                    <td>
                      {row.deltaPercent === null
                        ? row.previousPlnMinor === 0 && row.currentPlnMinor > 0
                          ? "Nowe"
                          : "—"
                        : `${row.deltaPercent}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Rekomendacje</h2>
        {recommendations.length === 0 ? (
          <p className="muted">
            Brak automatycznych wskazowek — dodaj wiecej roznych wydatkow albo wybierz inny miesiac.
          </p>
        ) : (
          <ul style={{ marginBottom: 0 }}>
            {recommendations.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
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
