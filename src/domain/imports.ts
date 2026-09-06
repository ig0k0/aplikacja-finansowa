import { createHash } from "node:crypto";
import { z } from "zod";
import { parseAmountToMinor, transactionTypes, type TransactionType } from "./transactions";

export const importMappingSchema = z.object({
  dateColumn: z.string().min(1, "Kolumna daty jest wymagana."),
  postedDateColumn: z.string().optional(),
  amountColumn: z.string().min(1, "Kolumna kwoty jest wymagana."),
  currencyColumn: z.string().optional(),
  fxRateColumn: z.string().optional(),
  descriptionColumn: z.string().min(1, "Kolumna opisu jest wymagana."),
  merchantColumn: z.string().optional(),
  bankReferenceColumn: z.string().optional(),
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
  postedDate: string | null;
  amountMinor: number;
  amountPlnMinor: number;
  currency: string;
  fxRate: string | null;
  description: string;
  merchantName: string | null;
  bankReference: string | null;
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
    .replace(/[A-Za-z]{3}/g, "")
    .replace(/[zł$€£]/gi, "")
    .replace(",", ".");
  const withoutSign = normalized.replace(/^-/, "");

  if (!/^\d+(\.\d{1,2})?$/.test(withoutSign)) {
    throw new Error(`Nieprawidlowa kwota: ${value}`);
  }

  return parseAmountToMinor(withoutSign);
}

function normalizeCurrency(value: string | undefined) {
  const currency = (value ?? "PLN").trim().toUpperCase() || "PLN";

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(`Nieprawidlowa waluta: ${value ?? ""}`);
  }

  return currency;
}

function parseFxRate(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");

  if (!/^\d+(\.\d+)?$/.test(normalized) || Number(normalized) <= 0) {
    throw new Error(`Nieprawidlowy kurs waluty: ${value}`);
  }

  return { value: normalized, numeric: Number(normalized) };
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

type DedupeKeyInput = {
  userId: string;
  financialAccountId?: string | null;
  date: string;
  postedDate: string | null;
  amountMinor: number;
  currency: string;
  bankReference: string | null;
  description: string;
};

export function createVersionedImportDedupeKey(input: DedupeKeyInput) {
  const normalizedDescription = input.description.toLowerCase().replace(/\s+/g, " ").trim();
  const canonicalParts = [
    "v2",
    input.userId,
    input.financialAccountId ?? "none",
    input.bankReference?.toLowerCase() ?? "none",
    input.date,
    input.postedDate ?? "none",
    input.amountMinor,
    input.currency,
    normalizedDescription,
  ].join("|");

  return `v2:${createHash("sha256").update(canonicalParts).digest("hex")}`;
}

function createDedupeKey(input: DedupeKeyInput) {
  const normalizedDescription = input.description.toLowerCase().replace(/\s+/g, " ").trim();

  // Zachowujemy dotychczasowy klucz dla eksportow PLN bez dodatkowych danych.
  // Pozwala to wykrywac duplikaty wobec rekordow zapisanych przed rozbudowa importu.
  if (
    !input.financialAccountId &&
    !input.postedDate &&
    input.currency === "PLN" &&
    !input.bankReference
  ) {
    return [input.userId, input.date, input.amountMinor, normalizedDescription].join("|");
  }

  return createVersionedImportDedupeKey(input);
}

export function normalizeImportRow(
  userId: string,
  rawRow: Record<string, string>,
  mapping: ImportMapping,
  options: { financialAccountId?: string | null } = {},
): NormalizedImportRow {
  const amountRaw = rawRow[mapping.amountColumn] ?? "";
  const transactionDate = parseDate(rawRow[mapping.dateColumn] ?? "");
  const postedDate = mapping.postedDateColumn
    ? parseDate(rawRow[mapping.postedDateColumn] ?? "")
    : null;
  const amountMinor = normalizeAmount(amountRaw);
  const currency = normalizeCurrency(
    mapping.currencyColumn ? rawRow[mapping.currencyColumn] : undefined,
  );
  const mappedFxRate = mapping.fxRateColumn
    ? parseFxRate(rawRow[mapping.fxRateColumn] ?? "")
    : null;
  if (currency !== "PLN" && !mappedFxRate) {
    throw new Error("Dla transakcji w walucie innej niz PLN podaj kolumne kursu PLN.");
  }
  const fxRate = currency === "PLN" ? null : mappedFxRate;
  const description = normalizeText(rawRow[mapping.descriptionColumn] ?? "");
  const merchantName = mapping.merchantColumn
    ? normalizeText(rawRow[mapping.merchantColumn] ?? "")
    : "";
  const bankReference = mapping.bankReferenceColumn
    ? normalizeText(rawRow[mapping.bankReferenceColumn] ?? "")
    : "";

  if (!description) {
    throw new Error("Opis jest pusty.");
  }

  return {
    transactionDate,
    postedDate,
    amountMinor,
    amountPlnMinor: fxRate ? Math.round(amountMinor * fxRate.numeric) : amountMinor,
    currency,
    fxRate: fxRate?.value ?? null,
    description,
    merchantName: merchantName || null,
    bankReference: bankReference || null,
    type: inferTransactionType(amountRaw, mapping.defaultType),
    categoryId: mapping.categoryId,
    dedupeKey: createDedupeKey({
      userId,
      financialAccountId: options.financialAccountId,
      date: transactionDate,
      postedDate,
      amountMinor,
      currency,
      bankReference: bankReference || null,
      description,
    }),
  };
}
