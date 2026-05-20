import type { ImportMapping } from "@/domain/imports";

export type BankParserId = "mbank_csv" | "revolut_csv" | "pko_csv" | "zen_csv";

export type BankParserMatch = {
  id: BankParserId;
  label: string;
  sourceInstitution: string;
  mapping: Pick<
    ImportMapping,
    "dateColumn" | "amountColumn" | "descriptionColumn" | "merchantColumn"
  >;
};
