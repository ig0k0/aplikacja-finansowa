import { buildParserMatch, findHeader } from "./shared";
import type { BankParserMatch } from "./types";

const DATE_COLUMNS = ["data operacji", "data ksiegowania", "data księgowania"] as const;
const AMOUNT_COLUMNS = ["kwota", "obciazenia", "obciążenia", "uznania"] as const;
const DESCRIPTION_COLUMNS = [
  "opis operacji",
  "tytul",
  "tytuł",
  "opis",
  "nazwa odbiorcy nadawcy",
] as const;
const MERCHANT_COLUMNS = ["lokalizacja", "kontrahent", "odbiorca nadawca"] as const;

export function matchMbankCsv(headers: string[]): BankParserMatch | null {
  if (headers.length < 3) {
    return null;
  }

  const dateColumn = findHeader(headers, DATE_COLUMNS);
  const amountColumn = findHeader(headers, AMOUNT_COLUMNS);
  const descriptionColumn = findHeader(headers, DESCRIPTION_COLUMNS);

  if (!dateColumn || !amountColumn || !descriptionColumn) {
    return null;
  }

  if (!findHeader(headers, ["opis operacji"])) {
    return null;
  }

  const merchantColumn = findHeader(headers, MERCHANT_COLUMNS) ?? "";

  return buildParserMatch("mbank_csv", "mBank CSV", "mBank", {
    dateColumn,
    amountColumn,
    descriptionColumn,
    merchantColumn,
  });
}
