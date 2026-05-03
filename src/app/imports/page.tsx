import Link from "next/link";
import { findImportMappingPreset, importMappingPresets } from "@/domain/import-presets";
import { requireUser } from "@/lib/session";
import { formatCurrencyMinor, formatDate } from "@/lib/format";
import { toTransactionTypeLabel } from "@/domain/transactions";
import { confirmImportAction, createImportPreviewAction } from "./actions";

export const dynamic = "force-dynamic";

type ImportsPageProps = {
  searchParams?: Promise<{
    batchId?: string;
    error?: string;
    imported?: string;
    duplicates?: string;
    failed?: string;
    preset?: string;
  }>;
};

type NormalizedPreview = {
  transactionDate: string;
  amountMinor: number;
  description: string;
  merchantName: string | null;
  type: string;
  categoryId: string;
};

function parseNormalized(value: string | null): NormalizedPreview | null {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as NormalizedPreview;
}

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};
  const mappingPreset = findImportMappingPreset(params.preset?.trim());
  const [{ listCategoriesForUser }, importsModule] = await Promise.all([
    import("@/db/categories"),
    import("@/db/imports"),
  ]);
  const categories = listCategoriesForUser(user.id).filter(
    (category) => category.type === "income" || category.type === "expense",
  );
  const preview = params.batchId
    ? importsModule.getImportPreviewForUser(user.id, params.batchId)
    : null;

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="muted">Import neutralny</p>
          <h1 style={{ margin: 0 }}>CSV / XLSX / PDF / OCR</h1>
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
      {params.imported ? (
        <p className="card" style={{ borderColor: "#86efac" }}>
          Import zapisany. Nowe: {params.imported}, duplikaty: {params.duplicates ?? 0},
          bledy: {params.failed ?? 0}.
        </p>
      ) : null}

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Wgraj plik i podaj mapowanie</h2>
        <p className="muted">
          Szablony ponizej to <strong>tylko przykladowe nazwy kolumn</strong> — nie sa automatycznymi parserami bankow.
          Zawsze sprawdz naglowki w swoim pliku. PDF: wykrywanie tabel / tekst. Zdjecie paragonu (PNG, JPEG, WebP): OCR
          jezyka polskiego (Tesseract), potem ta sama heurystyka kolumn co przy PDF — jakosc zalezy od zdjecia.
          Legacy XLS jest odrzucany.
        </p>
        <p className="muted" style={{ marginBottom: 12 }}>
          Szablony nazw kolumn (klik = wypelnienie pol ponizej):
        </p>
        <div className="button-row" style={{ marginBottom: 16 }}>
          {importMappingPresets.map((template) => (
            <Link
              key={template.id}
              className="button button-secondary"
              href={`/imports?preset=${encodeURIComponent(template.id)}`}
            >
              {template.label}
            </Link>
          ))}
        </div>
        {mappingPreset ? (
          <p className="muted" style={{ marginBottom: 16 }}>
            Aktywny szablon: <strong>{mappingPreset.label}</strong>. {mappingPreset.hint}
          </p>
        ) : null}
        <form action={createImportPreviewAction} className="form-grid">
          <label className="field field-wide">
            Plik
            <input
              className="input"
              name="file"
              type="file"
              accept=".csv,.xlsx,.pdf,.png,.jpg,.jpeg,.webp,.xls"
            />
          </label>
          <label className="field">
            Zrodlo
            <input className="input" name="sourceInstitution" placeholder="np. mBank" />
          </label>
          <label className="field">
            Typ domyslny
            <select className="input" name="defaultType" defaultValue="expense">
              <option value="expense">Wydatek</option>
              <option value="income">Przychod</option>
            </select>
          </label>
          <label className="field">
            Kategoria domyslna
            <select className="input" name="categoryId" defaultValue="">
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
          <label className="field">
            Kolumna daty
            <input
              className="input"
              name="dateColumn"
              placeholder="np. Data"
              defaultValue={mappingPreset?.dateColumn ?? ""}
            />
          </label>
          <label className="field">
            Kolumna kwoty
            <input
              className="input"
              name="amountColumn"
              placeholder="np. Kwota"
              defaultValue={mappingPreset?.amountColumn ?? ""}
            />
          </label>
          <label className="field">
            Kolumna opisu
            <input
              className="input"
              name="descriptionColumn"
              placeholder="np. Opis"
              defaultValue={mappingPreset?.descriptionColumn ?? ""}
            />
          </label>
          <label className="field">
            Kolumna sklepu
            <input
              className="input"
              name="merchantColumn"
              placeholder="opcjonalnie"
              defaultValue={mappingPreset?.merchantColumn ?? ""}
            />
          </label>
          <button className="button" type="submit">
            Pokaz podglad
          </button>
        </form>
      </section>

      {preview ? (
        <section className="card">
          <h2>Podglad importu</h2>
          <p className="muted">
            Plik: {preview.batch.fileName}. Wiersze: {preview.batch.rowsTotal}. Bledy:
            {" "}
            {preview.batch.rowsFailed}.
          </p>
          <form action={confirmImportAction} style={{ marginBottom: 16 }}>
            <input name="batchId" type="hidden" value={preview.batch.id} />
            <button
              className="button"
              type="submit"
              disabled={preview.batch.status === "imported"}
            >
              Zapisz transakcje z podgladu
            </button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Wiersz</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Typ</th>
                  <th>Opis</th>
                  <th>Kwota</th>
                  <th>Blad</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 50).map((row) => {
                  const normalized = parseNormalized(row.normalizedDataJson);

                  return (
                    <tr key={row.id}>
                      <td>{row.rowNumber}</td>
                      <td>{row.status}</td>
                      <td>{normalized ? formatDate(normalized.transactionDate) : "-"}</td>
                      <td>{normalized ? toTransactionTypeLabel(normalized.type) : "-"}</td>
                      <td>
                        {normalized?.description ?? "-"}
                        {normalized?.merchantName ? (
                          <p className="muted table-note">{normalized.merchantName}</p>
                        ) : null}
                      </td>
                      <td>{normalized ? formatCurrencyMinor(normalized.amountMinor) : "-"}</td>
                      <td>{row.errorMessage ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
