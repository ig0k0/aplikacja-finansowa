import Link from "next/link";
import {
  computeAllocationSuggestion,
  investmentAssetTypes,
  investmentOperationTypes,
  toAssetTypeLabel,
  toOperationTypeLabel,
  type StrategyRulesV1,
} from "@/domain/investments";
import { formatCurrencyMinor, formatDate, todayInputValue } from "@/lib/format";
import { requireUser } from "@/lib/session";
import {
  addInvestmentOperationAction,
  createInvestmentAssetAction,
  deleteInvestmentAssetAction,
  saveInvestmentStrategyAction,
} from "./actions";

export const dynamic = "force-dynamic";

type InvestmentsPageProps = {
  searchParams?: Promise<{
    error?: string;
    saved?: string;
    deleted?: string;
  }>;
};

export default async function InvestmentsPage({ searchParams }: InvestmentsPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};
  const [
    { listInvestmentAssetsForUser, summarizeInvestmentsForUser, getActiveStrategyForUser, listRecentOperationsForUser },
    { summarizeCurrentYearForUser },
  ] = await Promise.all([import("@/db/investments"), import("@/db/transactions")]);

  const assets = listInvestmentAssetsForUser(user.id);
  const inv = summarizeInvestmentsForUser(user.id);
  const year = summarizeCurrentYearForUser(user.id);
  const strategy = getActiveStrategyForUser(user.id);
  const recentOps = listRecentOperationsForUser(user.id);
  let rules: StrategyRulesV1 | null = null;

  if (strategy?.rulesJson) {
    try {
      rules = JSON.parse(strategy.rulesJson) as StrategyRulesV1;
    } catch {
      rules = null;
    }
  }

  const suggestion =
    rules && rules.allocations.length > 0
      ? computeAllocationSuggestion(year.balance, rules)
      : null;

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="muted">Etap 6 — MVP</p>
          <h1 style={{ margin: 0 }}>Inwestycje i majatek</h1>
        </div>
        <Link className="button button-secondary" href="/dashboard">
          Dashboard
        </Link>
      </header>

      {params.error ? <p className="card error">{params.error}</p> : null}
      {params.saved ? (
        <p className="card" style={{ borderColor: "#86efac" }}>
          Zapisano.
        </p>
      ) : null}
      {params.deleted ? (
        <p className="card" style={{ borderColor: "#fde047" }}>
          Usunieto aktywo.
        </p>
      ) : null}

      <section className="grid grid-3" style={{ marginBottom: 24 }}>
        <Metric label="Wartosc rynkowa portfela" value={formatCurrencyMinor(inv.totalMarketPlnMinor)} />
        <Metric label="Koszt (baza)" value={formatCurrencyMinor(inv.totalCostPlnMinor)} />
        <Metric
          label="Wynik (wartosc - koszt)"
          value={formatCurrencyMinor(inv.pnlPlnMinor)}
        />
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Strategia alokacji nadwyzki</h2>
        <p className="muted">
          Bilans przeplywow w biezacym roku (przychody minus wydatki):{" "}
          <strong>{formatCurrencyMinor(year.balance)}</strong>. Poduszka i procenty ponizej dziela nadwyzke po
          odjeciu poduszki — propozycja informacyjna, bez automatycznych przelewow.
        </p>
        {suggestion && rules ? (
          <div style={{ marginBottom: 16 }}>
            <h3>Sugestia podzialu (nadwyzka po poduszce)</h3>
            <ul>
              {suggestion.map((row) => (
                <li key={row.label}>
                  {row.label}: <strong>{formatCurrencyMinor(row.amountMinor)}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="muted">Ustal strategie ponizej, aby zobaczyc sugestie.</p>
        )}
        <form action={saveInvestmentStrategyAction} className="form-grid">
          <label className="field field-wide">
            Nazwa strategii
            <input className="input" name="strategyName" defaultValue={strategy?.name ?? "Moja strategia"} />
          </label>
          <label className="field">
            Poduszka finansowa (PLN)
            <input
              className="input"
              name="cushion"
              inputMode="decimal"
              placeholder="5000,00"
              defaultValue=""
              required
            />
          </label>
          <label className="field">
            Cel 1 — etykieta
            <input className="input" name="slot1Label" placeholder="np. ETF swiat" />
          </label>
          <label className="field">
            Cel 1 — %
            <input className="input" name="slot1Percent" inputMode="decimal" placeholder="60" />
          </label>
          <label className="field">
            Cel 2 — etykieta
            <input className="input" name="slot2Label" placeholder="np. Obligacje" />
          </label>
          <label className="field">
            Cel 2 — %
            <input className="input" name="slot2Percent" inputMode="decimal" placeholder="40" />
          </label>
          <label className="field">
            Cel 3 — etykieta
            <input className="input" name="slot3Label" placeholder="opcjonalnie" />
          </label>
          <label className="field">
            Cel 3 — %
            <input className="input" name="slot3Percent" inputMode="decimal" />
          </label>
          <button className="button" type="submit">
            Zapisz strategie
          </button>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Nowe aktywo</h2>
        <form action={createInvestmentAssetAction} className="form-grid">
          <label className="field">
            Nazwa
            <input className="input" name="name" required placeholder="np. VWCE" />
          </label>
          <label className="field">
            Ticker (opcjonalnie)
            <input className="input" name="ticker" placeholder="VWCE" />
          </label>
          <label className="field">
            Typ
            <select className="input" name="type" required defaultValue="etf">
              {investmentAssetTypes.map((t) => (
                <option key={t} value={t}>
                  {toAssetTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Wartosc rynkowa PLN (start)
            <input className="input" name="marketValue" inputMode="decimal" placeholder="0" />
          </label>
          <label className="field">
            Koszt PLN (start)
            <input className="input" name="costBasis" inputMode="decimal" placeholder="0" />
          </label>
          <button className="button" type="submit">
            Dodaj aktywo
          </button>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Nowa operacja</h2>
        <form action={addInvestmentOperationAction} className="form-grid">
          <label className="field field-wide">
            Aktywo
            <select className="input" name="assetId" required defaultValue="">
              <option value="" disabled>
                Wybierz
              </option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({toAssetTypeLabel(a.type)})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Typ operacji
            <select className="input" name="type" required defaultValue="valuation_update">
              {investmentOperationTypes.map((t) => (
                <option key={t} value={t}>
                  {toOperationTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Data
            <input className="input" name="operationDate" type="date" defaultValue={todayInputValue()} />
          </label>
          <label className="field">
            Kwota PLN
            <input className="input" name="amount" inputMode="decimal" required placeholder="np. wycena calkowita" />
          </label>
          <label className="field">
            Oplata PLN (opcjonalnie)
            <input className="input" name="fee" inputMode="decimal" placeholder="0" />
          </label>
          <label className="field">
            Zmiana ilosci (opcjonalnie, np. przy kupnie/sprzedazy)
            <input className="input" name="quantityDelta" placeholder="0" />
          </label>
          <label className="field field-wide">
            Notatka
            <input className="input" name="note" placeholder="Krotki opis" />
          </label>
          <button className="button" type="submit">
            Zapisz operacje
          </button>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Lista aktywow</h2>
        {assets.length === 0 ? (
          <p className="muted">Brak pozycji. Dodaj np. pozycje typu Gotowka oraz ETF.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Typ</th>
                  <th>Wartosc</th>
                  <th>Koszt</th>
                  <th>Wynik</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.name}</strong>
                      {a.ticker ? <p className="muted table-note">{a.ticker}</p> : null}
                    </td>
                    <td>{toAssetTypeLabel(a.type)}</td>
                    <td>{formatCurrencyMinor(a.marketValuePlnMinor)}</td>
                    <td>{formatCurrencyMinor(a.costBasisPlnMinor)}</td>
                    <td>{formatCurrencyMinor(a.marketValuePlnMinor - a.costBasisPlnMinor)}</td>
                    <td>
                      <form action={deleteInvestmentAssetAction}>
                        <input name="assetId" type="hidden" value={a.id} />
                        <button className="button button-secondary" type="submit">
                          Usun
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Ostatnie operacje</h2>
        {recentOps.length === 0 ? (
          <p className="muted">Brak historii.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Aktywo</th>
                  <th>Typ</th>
                  <th>Kwota</th>
                </tr>
              </thead>
              <tbody>
                {recentOps.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.operationDate)}</td>
                    <td>{row.assetName}</td>
                    <td>{toOperationTypeLabel(row.type)}</td>
                    <td>{formatCurrencyMinor(row.amountPlnMinor)}</td>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <section className="card">
      <p className="muted" style={{ marginTop: 0 }}>
        {label}
      </p>
      <strong style={{ fontSize: 22 }}>{value}</strong>
    </section>
  );
}
