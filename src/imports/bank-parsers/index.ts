import { matchMbankCsv } from "./mbank-csv";
import { matchPkoCsv } from "./pko-csv";
import { matchRevolutCsv } from "./revolut-csv";
import { matchZenCsv } from "./zen-csv";
import type { BankParserMatch } from "./types";

export type { BankParserId, BankParserMatch } from "./types";

const matchers = [matchZenCsv, matchRevolutCsv, matchMbankCsv, matchPkoCsv] as const;

export function detectBankImportMapping(headers: string[], _fileName: string): BankParserMatch | null {
  for (const match of matchers) {
    const result = match(headers);

    if (result) {
      return result;
    }
  }

  return null;
}
