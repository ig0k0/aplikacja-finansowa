import { buildParserMatch, findHeader, hasHeader } from "./shared";
import type { BankParserMatch } from "./types";

const DATE_COLUMNS = [
  "completed date",
  "date completed",
  "date completed (utc)",
  "completed date (utc)",
] as const;
const AMOUNT_COLUMNS = ["amount", "payment amount"] as const;
const DESCRIPTION_COLUMNS = ["description"] as const;
const MERCHANT_COLUMNS = ["merchant", "payer", "beneficiary"] as const;

export function matchRevolutCsv(headers: string[]): BankParserMatch | null {
  if (headers.length < 3) {
    return null;
  }

  const dateColumn = findHeader(headers, DATE_COLUMNS);
  const amountColumn = findHeader(headers, AMOUNT_COLUMNS);
  const descriptionColumn = findHeader(headers, DESCRIPTION_COLUMNS);

  if (!dateColumn || !amountColumn || !descriptionColumn) {
    return null;
  }

  const revolutMarker =
    hasHeader(headers, "type") ||
    hasHeader(headers, "currency") ||
    hasHeader(headers, "fee") ||
    hasHeader(headers, "started date");

  if (!revolutMarker) {
    return null;
  }

  const merchantColumn = findHeader(headers, MERCHANT_COLUMNS) ?? "";

  return buildParserMatch("revolut_csv", "Revolut CSV", "Revolut", {
    dateColumn,
    amountColumn,
    descriptionColumn,
    merchantColumn,
  });
}
