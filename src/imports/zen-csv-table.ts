import { normalizeHeader } from "./bank-parsers/shared";

function normalizeCell(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function rowCells(row: unknown[]): string[] {
  return row.map(normalizeCell);
}

function rowHasHeader(cells: string[], candidate: string): boolean {
  const target = normalizeHeader(candidate);

  return cells.some((cell) => normalizeHeader(cell) === target);
}

/** Wiersz transakcji ZEN: data w formacie „1 Apr 2026”. */
export function isZenTransactionDataRow(row: unknown[]): boolean {
  const first = normalizeCell(row[0]);

  return /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(first);
}

/**
 * Wyciagi ZEN (CSV) maja metadane, potem sekcje Transactions z naglowkiem tabeli.
 * Zwraca wiersze [naglowek, ...dane] albo null, gdy to nie format ZEN.
 */
export function extractZenCsvTable(rows: unknown[][]): unknown[][] | null {
  for (let index = 0; index < rows.length; index++) {
    const cells = rowCells(rows[index]!);

    if (cells[0]?.toLowerCase() !== "date") {
      continue;
    }

    if (!rowHasHeader(cells, "Settlement amount") || !rowHasHeader(cells, "Transaction type")) {
      continue;
    }

    const dataRows: unknown[][] = [];

    for (let dataIndex = index + 1; dataIndex < rows.length; dataIndex++) {
      const row = rows[dataIndex];

      if (!row || !isZenTransactionDataRow(row)) {
        break;
      }

      dataRows.push(row);
    }

    if (dataRows.length === 0) {
      return null;
    }

    return [rows[index]!, ...dataRows];
  }

  return null;
}
