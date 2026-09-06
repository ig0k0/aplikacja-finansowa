import Link from "next/link";
import {
  financialAccountTypes,
  toFinancialAccountTypeLabel,
} from "@/domain/financial-accounts";
import { requireUser } from "@/lib/session";
import { archiveFinancialAccountAction, createFinancialAccountAction } from "./actions";

export const dynamic = "force-dynamic";

type AccountsPageProps = {
  searchParams?: Promise<{ error?: string; saved?: string }>;
};

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};
  const { listFinancialAccountsForUser } = await import("@/db/financial-accounts");
  const accounts = listFinancialAccountsForUser(user.id);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="muted">Ustawienia</p>
          <h1 style={{ margin: 0 }}>Konta finansowe</h1>
        </div>
        <div className="inline-form">
          <Link className="button button-secondary" href="/transactions">
            Transakcje
          </Link>
          <Link className="button button-secondary" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </header>

      {params.error ? <p className="card error">{params.error}</p> : null}
      {params.saved === "created" ? (
        <p className="card" style={{ borderColor: "#86efac" }}>
          Konto zostalo utworzone.
        </p>
      ) : null}
      {params.saved === "archived" ? (
        <p className="card" style={{ borderColor: "#fde047" }}>
          Konto zostalo zarchiwizowane. Historyczne transakcje pozostaja bez zmian.
        </p>
      ) : null}

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Dodaj konto</h2>
        <p className="muted">
          Konto jest opcjonalne dla wpisu ręcznego, ale warto je wybrać przy imporcie — poprawia
          deduplikację i pozwala rozróżnić eksporty z różnych rachunków.
        </p>
        <form action={createFinancialAccountAction} className="form-grid">
          <label className="field">
            Nazwa
            <input className="input" name="name" placeholder="np. Konto osobiste" required />
          </label>
          <label className="field">
            Instytucja / źródło
            <input className="input" name="institution" placeholder="np. mBank" required />
          </label>
          <label className="field">
            Typ
            <select className="input" name="type" defaultValue="bank">
              {financialAccountTypes.map((type) => (
                <option key={type} value={type}>
                  {toFinancialAccountTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Waluta bazowa
            <input className="input" name="currency" defaultValue="PLN" maxLength={3} required />
          </label>
          <label className="field field-wide">
            Wskazówka identyfikująca (opcjonalnie)
            <input className="input" name="externalAccountHint" placeholder="np. ostatnie 4 cyfry" />
          </label>
          <button className="button" type="submit">
            Dodaj konto
          </button>
        </form>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Aktywne konta ({accounts.length})</h2>
        {accounts.length === 0 ? (
          <p className="muted">Dodaj konto, aby przypisywać do niego importy i wpisy ręczne.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Instytucja</th>
                  <th>Typ</th>
                  <th>Waluta</th>
                  <th>Wskazówka</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>{account.institution}</td>
                    <td>{toFinancialAccountTypeLabel(account.type)}</td>
                    <td>{account.currency}</td>
                    <td>{account.externalAccountHint ?? "—"}</td>
                    <td>
                      <form action={archiveFinancialAccountAction}>
                        <input name="accountId" type="hidden" value={account.id} />
                        <button className="button button-secondary" type="submit">
                          Archiwizuj
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
    </main>
  );
}
