import Link from "next/link";
import { requireUser } from "@/lib/session";
import { formatCurrencyMinor } from "@/lib/format";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [{ listCategoriesForUser }, { summarizeCurrentYearForUser, countTransactionsNeedingReviewForUser }, { summarizeInvestmentsForUser }] =
    await Promise.all([
      import("@/db/categories"),
      import("@/db/transactions"),
      import("@/db/investments"),
    ]);
  const categories = listCategoriesForUser(user.id);
  const parentCategories = categories.filter((category) => !category.parentId);
  const summary = summarizeCurrentYearForUser(user.id);
  const reviewCount = countTransactionsNeedingReviewForUser(user.id);
  const investments = summarizeInvestmentsForUser(user.id);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="muted">Zalogowano jako</p>
          <h1 style={{ margin: 0 }}>{user.displayName}</h1>
        </div>
        <div className="inline-form">
          <Link className="button button-secondary" href="/settings/security">
            Bezpieczenstwo
          </Link>
          <form action={logoutAction}>
            <button className="button button-secondary" type="submit">
              Wyloguj
            </button>
          </form>
        </div>
      </header>

      <section className="grid grid-3" style={{ marginBottom: 24 }}>
        <MetricCard label="Przychody w roku" value={formatCurrencyMinor(summary.income)} />
        <MetricCard label="Wydatki w roku" value={formatCurrencyMinor(summary.expense)} />
        <MetricCard label="Bilans roku" value={formatCurrencyMinor(summary.balance)} />
      </section>

      <section className="grid grid-3" style={{ marginBottom: 24 }}>
        <MetricCard
          label="Wartosc portfela (pozycje)"
          value={formatCurrencyMinor(investments.totalMarketPlnMinor)}
        />
        <MetricCard label="Koszt bazy portfela" value={formatCurrencyMinor(investments.totalCostPlnMinor)} />
        <MetricCard label="Wynik portfela" value={formatCurrencyMinor(investments.pnlPlnMinor)} />
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Najblizszy krok</h2>
        <p className="muted">
          Dodawaj transakcje recznie albo importuj pliki CSV/XLSX. AI moze podpowiadac kategorie. Oczekuje na
          weryfikacje: <strong>{reviewCount}</strong>.
        </p>
        <div className="button-row">
          <Link className="button" href="/transactions">
            Przejdz do transakcji
          </Link>
          <Link className="button button-secondary" href="/review">
            Kolejka weryfikacji
          </Link>
          <Link className="button button-secondary" href="/reports/monthly">
            Raport miesieczny
          </Link>
          <Link className="button button-secondary" href="/insights">
            Analityka
          </Link>
          <Link className="button button-secondary" href="/reports/yearly">
            Raport roczny
          </Link>
          <Link className="button button-secondary" href="/imports">
            Import pliku
          </Link>
          <Link className="button button-secondary" href="/investments">
            Inwestycje
          </Link>
          <Link className="button button-secondary" href="/audit">
            Dziennik audytu
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>Kategorie startowe</h2>
        <p className="muted">
          Kategorie sa przypisane do Twojego uzytkownika. Widok drugiej osoby
          korzysta z osobnego zestawu rekordow.
        </p>
        <div className="grid grid-3" style={{ marginTop: 16 }}>
          {parentCategories.map((category) => (
            <div className="card" key={category.id}>
              <strong>{category.name}</strong>
              <p className="muted" style={{ marginBottom: 0 }}>
                {categories.filter((item) => item.parentId === category.id)
                  .length || "Brak"}{" "}
                podkategorii
              </p>
            </div>
          ))}
        </div>
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
