import Link from "next/link";
import { requireUser } from "@/lib/session";
import { formatCurrencyMinor, formatDate, todayInputValue } from "@/lib/format";
import { toTransactionTypeLabel, type TransactionType } from "@/domain/transactions";
import {
  createTransactionAction,
  updateTransactionCategoryAction,
} from "./actions";

export const dynamic = "force-dynamic";

type TransactionsPageProps = {
  searchParams?: Promise<{
    type?: string;
    categoryId?: string;
    query?: string;
    error?: string;
    created?: string;
  }>;
};

function toFilterType(type?: string): TransactionType | undefined {
  if (type === "income" || type === "expense") {
    return type;
  }

  return undefined;
}

function categoryOptionsForType(
  categories: { id: string; name: string; type: string; parentId: string | null }[],
  type?: TransactionType,
) {
  return categories.filter((category) => {
    if (!type) {
      return category.type === "income" || category.type === "expense";
    }

    return category.type === type;
  });
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};
  const [{ listCategoriesForUser }, { listTransactionsForUser }] = await Promise.all([
    import("@/db/categories"),
    import("@/db/transactions"),
  ]);
  const categories = listCategoriesForUser(user.id);
  const filterType = toFilterType(params.type);
  const filteredCategories = categoryOptionsForType(categories, filterType);
  const transactions = listTransactionsForUser(user.id, {
    type: filterType,
    categoryId: params.categoryId || undefined,
    query: params.query?.trim() || undefined,
  });

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="muted">Transakcje reczne</p>
          <h1 style={{ margin: 0 }}>Przychody i wydatki</h1>
        </div>
        <Link className="button button-secondary" href="/dashboard">
          Dashboard
        </Link>
      </header>

      {params.error ? <p className="card error">{params.error}</p> : null}
      {params.created ? (
        <p className="card" style={{ borderColor: "#86efac" }}>
          Transakcja zostala dodana.
        </p>
      ) : null}

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Dodaj transakcje</h2>
        <form action={createTransactionAction} className="form-grid">
          <label className="field">
            Typ
            <select className="input" name="type" defaultValue="expense">
              <option value="expense">Wydatek</option>
              <option value="income">Przychod</option>
            </select>
          </label>
          <label className="field">
            Data
            <input
              className="input"
              name="transactionDate"
              type="date"
              defaultValue={todayInputValue()}
            />
          </label>
          <label className="field">
            Kwota PLN
            <input className="input" name="amount" inputMode="decimal" placeholder="49,99" />
          </label>
          <label className="field">
            Kategoria
            <select className="input" name="categoryId" defaultValue="">
              <option value="" disabled>
                Wybierz kategorie
              </option>
              {categories
                .filter((category) => category.type === "income" || category.type === "expense")
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Sklep lub kontrahent
            <input className="input" name="merchantName" placeholder="np. Biedronka" />
          </label>
          <label className="field field-wide">
            Opis
            <input className="input" name="description" placeholder="np. zakupy spozywcze" />
          </label>
          <label className="field field-wide field-row">
            <input name="isRecurring" type="checkbox" value="1" />
            <span>Subskrypcja lub stala oplata</span>
          </label>
          <button className="button" type="submit">
            Dodaj transakcje
          </button>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Filtry</h2>
        <form className="form-grid" action="/transactions">
          <label className="field">
            Typ
            <select className="input" name="type" defaultValue={filterType ?? ""}>
              <option value="">Wszystkie</option>
              <option value="expense">Wydatki</option>
              <option value="income">Przychody</option>
            </select>
          </label>
          <label className="field">
            Kategoria
            <select className="input" name="categoryId" defaultValue={params.categoryId ?? ""}>
              <option value="">Wszystkie</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-wide">
            Szukaj
            <input
              className="input"
              name="query"
              defaultValue={params.query ?? ""}
              placeholder="Opis albo sklep"
            />
          </label>
          <button className="button" type="submit">
            Filtruj
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Ostatnie transakcje</h2>
        {transactions.length === 0 ? (
          <p className="muted">Brak transakcji dla wybranych filtrow.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Typ</th>
                  <th>Opis</th>
                  <th>Kategoria</th>
                  <th>Kwota</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{formatDate(transaction.transactionDate)}</td>
                    <td>{toTransactionTypeLabel(transaction.type)}</td>
                    <td>
                      <strong>{transaction.description}</strong>
                      {transaction.merchantName ? (
                        <p className="muted table-note">{transaction.merchantName}</p>
                      ) : null}
                    </td>
                    <td>
                      <form action={updateTransactionCategoryAction} className="inline-form">
                        <input name="transactionId" type="hidden" value={transaction.id} />
                        <select
                          className="input"
                          name="categoryId"
                          defaultValue={transaction.categoryId ?? ""}
                        >
                          {categoryOptionsForType(
                            categories,
                            toFilterType(transaction.type),
                          ).map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                        <label className="muted field-row">
                          <input
                            defaultChecked={transaction.isRecurring}
                            name="isRecurring"
                            type="checkbox"
                            value="1"
                          />
                          Stala oplata
                        </label>
                        <label className="muted field-row">
                          <input name="remember" type="checkbox" value="1" />
                          Zapamietaj
                        </label>
                        <button className="button button-secondary" type="submit">
                          Zapisz
                        </button>
                      </form>
                    </td>
                    <td>{formatCurrencyMinor(transaction.amountPlnMinor)}</td>
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
