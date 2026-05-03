import { z } from "zod";

export const transactionTypes = ["income", "expense"] as const;
export type TransactionType = (typeof transactionTypes)[number];

const amountSchema = z
  .string()
  .trim()
  .min(1, "Kwota jest wymagana.")
  .regex(/^\d+([,.]\d{1,2})?$/, "Kwota musi miec format np. 12,34.");

export const manualTransactionSchema = z.object({
  type: z.enum(transactionTypes),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data jest wymagana."),
  amount: amountSchema,
  categoryId: z.string().min(1, "Kategoria jest wymagana."),
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
