import { buildParserMatch, findHeader, hasHeader } from "./shared";
import type { BankParserMatch } from "./types";

const DATE_COLUMNS = ["data operacji", "data ksiegowania", "data księgowania", "data waluty"] as const;
const AMOUNT_COLUMNS = ["kwota", "obciazenia", "obciążenia", "uznania"] as const;
const DESCRIPTION_COLUMNS = ["opis", "tytul", "tytuł", "nazwa odbiorcy nadawcy"] as const;
const MERCHANT_COLUMNS = [
  "nadawca",
  "odbiorca",
  "nadawca/odbiorca",
  "kontrahent",
  "dane kontrahenta",
] as const;

export function matchPkoCsv(headers: string[]): BankParserMatch | null {
  if (headers.length < 3) {
    return null;
  }

  if (hasHeader(headers, "opis operacji")) {
    return null;
  }

  const dateColumn = findHeader(headers, DATE_COLUMNS);
  const amountColumn = findHeader(headers, AMOUNT_COLUMNS);
  const descriptionColumn = findHeader(headers, DESCRIPTION_COLUMNS);

  if (!dateColumn || !amountColumn || !descriptionColumn) {
    return null;
  }

  const merchantColumn = findHeader(headers, MERCHANT_COLUMNS) ?? "";

  return buildParserMatch("pko_csv", "PKO BP CSV", "PKO BP", {
    dateColumn,
    amountColumn,
    descriptionColumn,
    merchantColumn,
  });
}
