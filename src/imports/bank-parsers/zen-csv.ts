import { buildParserMatch, findHeader } from "./shared";
import type { BankParserMatch } from "./types";

const DATE_COLUMNS = ["date"] as const;
const AMOUNT_COLUMNS = ["settlement amount"] as const;
const DESCRIPTION_COLUMNS = ["description"] as const;
export function matchZenCsv(headers: string[]): BankParserMatch | null {
  if (headers.length < 4) {
    return null;
  }

  const dateColumn = findHeader(headers, DATE_COLUMNS);
  const amountColumn = findHeader(headers, AMOUNT_COLUMNS);
  const descriptionColumn = findHeader(headers, DESCRIPTION_COLUMNS);

  if (!dateColumn || !amountColumn || !descriptionColumn) {
    return null;
  }

  if (!findHeader(headers, ["settlement currency"]) || !findHeader(headers, ["transaction type"])) {
    return null;
  }

  return buildParserMatch("zen_csv", "ZEN CSV", "ZEN", {
    dateColumn,
    amountColumn,
    descriptionColumn,
    merchantColumn: "",
  });
}
