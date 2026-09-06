import { formatCurrencyMinor } from "@/lib/format";

type ExpenseCategory = {
  categoryId: string | null;
  categoryName: string | null;
  spentPlnMinor: number;
};

export function ExpenseBarChart({ rows }: { rows: ExpenseCategory[] }) {
  const visibleRows = rows.filter((row) => row.spentPlnMinor > 0).slice(0, 5);
  const maximum = Math.max(...visibleRows.map((row) => row.spentPlnMinor), 1);

  if (visibleRows.length === 0) {
    return <p className="muted dashboard-empty">Brak wydatków w wybranym miesiącu.</p>;
  }

  return (
    <ol className="expense-bars" aria-label="Największe kategorie wydatków">
      {visibleRows.map((row) => {
        const percentage = Math.max(6, Math.round((row.spentPlnMinor / maximum) * 100));
        const label = row.categoryName ?? "Bez kategorii";

        return (
          <li key={row.categoryId ?? "uncategorized"}>
            <div className="expense-bars-label">
              <span>{label}</span>
              <strong>{formatCurrencyMinor(row.spentPlnMinor)}</strong>
            </div>
            <div className="expense-bars-track" aria-label={`${label}: ${formatCurrencyMinor(row.spentPlnMinor)}`}>
              <span className="expense-bars-fill" style={{ width: `${percentage}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
