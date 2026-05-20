import { z } from "zod";
import { parseAmountToMinor, transactionTypes, type TransactionType } from "./transactions";

export const importMappingSchema = z.object({
  dateColumn: z.string().min(1, "Kolumna daty jest wymagana."),
  amountColumn: z.string().min(1, "Kolumna kwoty jest wymagana."),
  descriptionColumn: z.string().min(1, "Kolumna opisu jest wymagana."),
  merchantColumn: z.string().optional(),
  categoryId: z.string().min(1, "Kategoria domyslna jest wymagana."),
  defaultType: z.enum(transactionTypes),
});

export type ImportMapping = z.infer<typeof importMappingSchema>;

export type ParsedImportFile = {
  headers: string[];
  rows: Record<string, string>[];
};

export type NormalizedImportRow = {
  transactionDate: string;
  amountMinor: number;
  description: string;
  merchantName: string | null;
  type: TransactionType;
  categoryId: string;
  dedupeKey: string;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const ENGLISH_MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function parseDate(value: string) {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const englishMatch = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(trimmed);

  if (englishMatch) {
    const [, day, monthLabel, year] = englishMatch;
    const month = ENGLISH_MONTHS[monthLabel.toLowerCase()];

    if (!month) {
      throw new Error(`Nieprawidlowa data: ${value}`);
    }

    return `${year}-${month}-${day.padStart(2, "0")}`;
  }

  const dotMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);

  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);

  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  throw new Error(`Nieprawidlowa data: ${value}`);
}

function normalizeAmount(value: string) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace("PLN", "")
    .replace("zł", "")
    .replace(",", ".");
  const withoutSign = normalized.replace(/^-/, "");

  if (!/^\d+(\.\d{1,2})?$/.test(withoutSign)) {
    throw new Error(`Nieprawidlowa kwota: ${value}`);
  }

  return parseAmountToMinor(withoutSign);
}

function inferTransactionType(amountRaw: string, defaultType: TransactionType): TransactionType {
  const trimmed = amountRaw.trim();

  if (trimmed.startsWith("-") || trimmed.startsWith("(")) {
    return "expense";
  }

  if (trimmed.startsWith("+")) {
    return "income";
  }

  const numeric = Number(
    trimmed.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""),
  );

  if (!Number.isNaN(numeric) && numeric !== 0) {
    return numeric < 0 ? "expense" : "income";
  }

  return defaultType;
}

function createDedupeKey(input: {
  userId: string;
  date: string;
  amountMinor: number;
  description: string;
}) {
  const normalizedDescription = input.description.toLowerCase().replace(/\s+/g, " ").trim();

  return [input.userId, input.date, input.amountMinor, normalizedDescription].join("|");
}

export function normalizeImportRow(
  userId: string,
  rawRow: Record<string, string>,
  mapping: ImportMapping,
): NormalizedImportRow {
  const amountRaw = rawRow[mapping.amountColumn] ?? "";
  const transactionDate = parseDate(rawRow[mapping.dateColumn] ?? "");
  const amountMinor = normalizeAmount(amountRaw);
  const description = normalizeText(rawRow[mapping.descriptionColumn] ?? "");
  const merchantName = mapping.merchantColumn
    ? normalizeText(rawRow[mapping.merchantColumn] ?? "")
    : "";

  if (!description) {
    throw new Error("Opis jest pusty.");
  }

  return {
    transactionDate,
    amountMinor,
    description,
    merchantName: merchantName || null,
    type: inferTransactionType(amountRaw, mapping.defaultType),
    categoryId: mapping.categoryId,
    dedupeKey: createDedupeKey({ userId, date: transactionDate, amountMinor, description }),
  };
}
