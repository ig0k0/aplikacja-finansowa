import Link from "next/link";
import { correctionPatternTypes, toPatternTypeLabel } from "@/domain/correction-memory";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import {
  createCorrectionMemoryAction,
  deleteCorrectionMemoryAction,
  updateCorrectionMemoryAction,
} from "./actions";

export const dynamic = "force-dynamic";

type AiMemoryPageProps = {
  searchParams?: Promise<{
    error?: string;
    saved?: string;
  }>;
};

export default async function AiMemoryPage({ searchParams }: AiMemoryPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};
  const [{ listCategoriesForUser }, { listCorrectionMemoryForUser }] = await Promise.all([
    import("@/db/categories"),
    import("@/db/correction-memory"),
  ]);

  const categories = listCategoriesForUser(user.id).filter(
    (category) => category.type === "income" || category.type === "expense",
  );
  const rules = listCorrectionMemoryForUser(user.id);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="muted">Ustawienia / AI</p>
          <h1 style={{ margin: 0 }}>Pamiec korekt kategorii</h1>
        </div>
        <div className="inline-form">
          <Link className="button button-secondary" href="/review">
            Kolejka weryfikacji
          </Link>
          <Link className="button button-secondary" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 24 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          Reguly zapamietane przy opcji „Zapamietaj” w kolejce weryfikacji albo dodane recznie ponizej.
          Dopasowanie ma pierwszenstwo przed sugestia AI — bez wysylania danych do modelu.
        </p>
        <ul className="muted" style={{ marginBottom: 0 }}>
          <li>
            <strong>Kontrahent</strong> — dokladna nazwa sklepu (np. <code>biedronka</code>).
          </li>
          <li>
            <strong>Opis zawiera</strong> — fragment w opisie transakcji (np. <code>netflix</code>).
          </li>
        </ul>
      </section>

      {params.error ? <p className="card error">{params.error}</p> : null}
      {params.saved === "created" ? (
        <p className="card" style={{ borderColor: "#86efac" }}>
          Regula zostala zapisana.
        </p>
      ) : null}
      {params.saved === "updated" ? (
        <p className="card" style={{ borderColor: "#86efac" }}>
          Kategoria reguly zostala zaktualizowana.
        </p>
      ) : null}
      {params.saved === "deleted" ? (
        <p className="card" style={{ borderColor: "#fde047" }}>
          Regula zostala usunieta.
        </p>
      ) : null}

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Nowa regula</h2>
        <form action={createCorrectionMemoryAction} className="form-grid">
          <label className="field">
            Typ wzorca
            <select className="input" name="patternType" defaultValue="merchant" required>
              {correctionPatternTypes.map((type) => (
                <option key={type} value={type}>
                  {toPatternTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Wartosc wzorca
            <input
              className="input"
              name="patternValue"
              placeholder="np. biedronka lub netflix"
              required
            />
          </label>
          <label className="field field-wide">
            Kategoria docelowa
            <select className="input" name="categoryId" required defaultValue="">
              <option value="" disabled>
                Wybierz kategorie
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            Dodaj regule
          </button>
        </form>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Twoje reguly ({rules.length})</h2>
        {rules.length === 0 ? (
          <p className="muted">Brak zapisanych regul. Dodaj pierwsza powyzej albo uzyj „Zapamietaj” przy weryfikacji.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Typ</th>
                  <th>Wzorzec</th>
                  <th>Kategoria</th>
                  <th>Ostatnie uzycie</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{toPatternTypeLabel(rule.patternType)}</td>
                    <td>
                      <code>{rule.patternValue}</code>
                    </td>
                    <td>
                      <form action={updateCorrectionMemoryAction} className="inline-form">
                        <input name="id" type="hidden" value={rule.id} />
                        <select
                          className="input"
                          name="categoryId"
                          defaultValue={rule.categoryId}
                          aria-label={`Kategoria dla ${rule.patternValue}`}
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                        <button className="button button-secondary" type="submit">
                          Zapisz
                        </button>
                      </form>
                    </td>
                    <td>{rule.lastUsedAt ? formatDate(rule.lastUsedAt.slice(0, 10)) : "—"}</td>
                    <td>
                      <form action={deleteCorrectionMemoryAction}>
                        <input name="id" type="hidden" value={rule.id} />
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
    </main>
  );
}
