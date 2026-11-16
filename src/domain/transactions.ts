import { z } from "zod";

export const transactionTypes = ["income", "expense"] as const;
export type TransactionType = (typeof transactionTypes)[number];

/**
 * Najwyzej 10 cyfr przed przecinkiem: kwota w groszach zostaje bezpieczna liczba calkowita.
 * Dluzsze wartosci trafialyby do bazy jako niedokladna liczba zmiennoprzecinkowa.
 */
export const AMOUNT_PATTERN = /^\d{1,10}([,.]\d{1,2})?$/;

/** Data `RRRR-MM-DD`, ktora faktycznie istnieje w kalendarzu (odrzuca np. 2026-13-45). */
export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const amountSchema = z
  .string()
  .trim()
  .min(1, "Kwota jest wymagana.")
  .regex(AMOUNT_PATTERN, "Kwota musi miec format np. 12,34.")
  .refine((value) => parseAmountToMinor(value) > 0, "Kwota musi byc wieksza od zera.");

export const manualTransactionSchema = z.object({
  type: z.enum(transactionTypes),
  transactionDate: z
    .string()
    .min(1, "Data jest wymagana.")
    .refine(isValidIsoDate, "Niepoprawna data."),
  amount: amountSchema,
  categoryId: z.string().min(1, "Kategoria jest wymagana."),
  financialAccountId: z.string().optional(),
  description: z.string().trim().min(1, "Opis jest wymagany.").max(200),
  merchantName: z.string().trim().max(120).optional(),
});

export type ManualTransactionInput = z.infer<typeof manualTransactionSchema>;

export function parseAmountToMinor(amount: string) {
  const normalized = amount.trim().replace(",", ".");
  const [whole, fraction = ""] = normalized.split(".");
  const grosze = fraction.padEnd(2, "0").slice(0, 2);

  return Number(whole) * 100 + Number(grosze);
}

export function toTransactionTypeLabel(type: string) {
  if (type === "income") {
    return "Przychod";
  }

  if (type === "expense") {
    return "Wydatek";
  }

  return type;
}
