import { z } from "zod";

export const financialAccountTypes = ["bank", "cash", "investment", "crypto", "savings"] as const;

export const financialAccountSchema = z.object({
  name: z.string().trim().min(1, "Nazwa konta jest wymagana.").max(80),
  institution: z.string().trim().min(1, "Zrodlo lub instytucja jest wymagana.").max(80),
  type: z.enum(financialAccountTypes),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Waluta musi miec kod ISO, np. PLN."),
  externalAccountHint: z.string().trim().max(40).optional(),
});

export function toFinancialAccountTypeLabel(type: string) {
  const labels: Record<string, string> = {
    bank: "Konto bankowe",
    cash: "Gotowka",
    investment: "Konto inwestycyjne",
    crypto: "Konto krypto",
    savings: "Konto oszczednosciowe",
  };

  return labels[type] ?? type;
}
