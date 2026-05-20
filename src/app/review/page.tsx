import Link from "next/link";
import { requireUser } from "@/lib/session";
import { formatCurrencyMinor, formatDate } from "@/lib/format";
import { getAiRuntimeConfig } from "@/lib/ai-config";
import { toTransactionTypeLabel, type TransactionType } from "@/domain/transactions";
import { updateTransactionCategoryAction } from "@/app/transactions/actions";
import { runAiBatchAction, runAiForTransactionAction } from "./actions";

export const dynamic = "force-dynamic";

type ReviewPageProps = {
  searchParams?: Promise<{
    error?: string;
    ai?: string;
    batch?: string;
    processed?: string;
    memory?: string;
    ai_auto?: string;
    ai_review?: string;
    disabled?: string;
    errors?: string;
  }>;
};

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

function toFilterType(type: string): TransactionType | undefined {
  if (type === "income" || type === "expense") {
    return type;
  }

  return undefined;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};
  const [{ listCategoriesForUser }, { listTransactionsForUser, countTransactionsNeedingReviewForUser }, { getLatestAiSuggestionsForTransactions }] =
    await Promise.all([
      import("@/db/categories"),
      import("@/db/transactions"),
      import("@/db/ai-suggestions"),
    ]);

  const categories = listCategoriesForUser(user.id);
  const aiConfig = getAiRuntimeConfig();
  const reviewCount = countTransactionsNeedingReviewForUser(user.id);
  const queue = listTransactionsForUser(user.id, {
    verificationStatus: "needs_review",
    sort: "oldest",
  });
  const suggestionMap = getLatestAiSuggestionsForTransactions(
    user.id,
    queue.map((row) => row.id),
  );

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="muted">Weryfikacja kategorii</p>
          <h1 style={{ margin: 0 }}>Kolejka do recznej weryfikacji</h1>
        </div>
        <div className="inline-form">
          <Link className="button button-secondary" href="/settings/ai-memory">
            Pamiec korekt
          </Link>
          <Link className="button button-secondary" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </header>

      {aiConfig.mode === "external" ? (
        <p className="card error">
          Tryb AI: zewnetrzny endpoint. Dane transakcji moga opuszczac ten serwer. Konfiguracja:{" "}
          <code>AI_MODE</code>, <code>AI_BASE_URL</code>.
        </p>
      ) : null}

      {params.error ? <p className="card error">{params.error}</p> : null}

      {params.ai ? (
        <p className="card" style={{ borderColor: "#93c5fd" }}>
          Wynik AI: <strong>{params.ai}</strong>
        </p>
      ) : null}

      {params.batch === "1" ? (
        <p className="card" style={{ borderColor: "#86efac" }}>
          Przetworzono {params.processed ?? "0"} transakcji (pamiec: {params.memory ?? "0"}, auto:{" "}
          {params.ai_auto ?? "0"}, do weryfikacji: {params.ai_review ?? "0"}, AI wylaczone:{" "}
          {params.disabled ?? "0"}, bledy: {params.errors ?? "0"}).
        </p>
      ) : null}

      {params.batch === "empty" ? (
        <p className="card">Brak transakcji oczekujacych w kolejce.</p>
      ) : null}

      <section className="card" style={{ marginBottom: 24 }}>
        <p className="muted">
          W kolejce: <strong>{reviewCount}</strong>. Pamiec korekt jest stosowana przed wywolaniem
          modelu. Progi domyslne: auto &gt;= {aiConfig.autoThreshold}, reczna weryfikacja ponizej{" "}
          {aiConfig.reviewThreshold}.
        </p>
        {aiConfig.mode === "disabled" ? (
          <p className="muted">
            AI jest wylaczone (ustaw <code>AI_MODE=local</code> lub <code>external</code> oraz{" "}
            <code>AI_BASE_URL</code>, <code>AI_MODEL</code>).
          </p>
        ) : null}
        <form action={runAiBatchAction}>
          <button className="button" type="submit">
            Uruchom AI dla 25 najstarszych w kolejce
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Transakcje</h2>
        {queue.length === 0 ? (
          <p className="muted">Brak pozycji do weryfikacji.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Typ</th>
                  <th>Tresc</th>
                  <th>AI / kategoria</th>
                  <th>Kwota</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((transaction) => {
                  const suggestion = suggestionMap.get(transaction.id);

                  return (
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
                        {suggestion ? (
                          <p className="muted table-note">
                            Model: {suggestion.model}, pewnosc: {suggestion.confidence.toFixed(2)},{" "}
                            {suggestion.needsManualReview ? "wymaga weryfikacji" : "gotowe"} (
                            {suggestion.reasonCode ?? "brak kodu"})
                          </p>
                        ) : (
                          <p className="muted table-note">Brak ostatniej sugestii AI.</p>
                        )}
                        <form action={updateTransactionCategoryAction} className="inline-form">
                          <input name="transactionId" type="hidden" value={transaction.id} />
                          <select
                            className="input"
                            name="categoryId"
                            defaultValue={transaction.categoryId ?? ""}
                          >
                            {categoryOptionsForType(categories, toFilterType(transaction.type)).map(
                              (category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ),
                            )}
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
                            <input defaultChecked name="remember" type="checkbox" value="1" />
                            Zapamietaj
                          </label>
                          <button className="button button-secondary" type="submit">
                            Zapisz
                          </button>
                        </form>
                        <form action={runAiForTransactionAction} style={{ marginTop: 8 }}>
                          <input name="transactionId" type="hidden" value={transaction.id} />
                          <button className="button button-secondary" type="submit">
                            Uruchom AI dla tej pozycji
                          </button>
                        </form>
                      </td>
                      <td>{formatCurrencyMinor(transaction.amountPlnMinor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
