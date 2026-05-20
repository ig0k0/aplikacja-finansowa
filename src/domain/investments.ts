import { z } from "zod";
import { quoteCurrencies } from "./pricing";
import { parseAmountToMinor } from "./transactions";

export const investmentAssetTypes = [
  "etf",
  "stock",
  "bond",
  "crypto",
  "ike_ikze",
  "cash",
] as const;
export type InvestmentAssetType = (typeof investmentAssetTypes)[number];

export const investmentOperationTypes = [
  "buy",
  "sell",
  "dividend",
  "deposit",
  "withdrawal",
  "valuation_update",
] as const;
export type InvestmentOperationType = (typeof investmentOperationTypes)[number];

const amountSchema = z
  .string()
  .trim()
  .min(1, "Kwota jest wymagana.")
  .regex(/^\d+([,.]\d{1,2})?$/, "Kwota musi miec format np. 12,34.");

const optionalAmountSchema = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || /^\d+([,.]\d{1,2})?$/.test(v), "Niepoprawny format kwoty.");

export const newInvestmentAssetSchema = z.object({
  name: z.string().trim().min(1, "Nazwa jest wymagana.").max(120),
  ticker: z.string().trim().max(32).optional(),
  type: z.enum(investmentAssetTypes),
  currency: z.enum(quoteCurrencies).default("PLN"),
  quantity: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^-?\d+([,.]\d{1,6})?$/.test(v), "Niepoprawna ilosc."),
  marketValue: optionalAmountSchema,
  costBasis: optionalAmountSchema,
});

export const investmentOperationFormSchema = z.object({
  assetId: z.string().min(1),
  type: z.enum(investmentOperationTypes),
  operationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data jest wymagana."),
  amount: amountSchema,
  fee: optionalAmountSchema,
  quantityDelta: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^-?\d+([,.]\d{1,6})?$/.test(v), "Niepoprawna ilosc."),
  note: z.string().trim().max(240).optional(),
});

export type StrategyRulesV1 = {
  cushionPlnMinor: number;
  allocations: { label: string; percent: number }[];
};

export const strategyFormSchema = z.object({
  name: z.string().trim().min(1).max(80),
  cushion: amountSchema,
  slot1Label: z.string().trim().max(40).optional(),
  slot1Percent: z.string().trim().optional(),
  slot2Label: z.string().trim().max(40).optional(),
  slot2Percent: z.string().trim().optional(),
  slot3Label: z.string().trim().max(40).optional(),
  slot3Percent: z.string().trim().optional(),
});

export function parseOptionalPercent(raw: string | undefined) {
  if (!raw?.trim()) {
    return null;
  }

  const n = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return null;
  }

  return n;
}

export function buildStrategyRulesFromForm(data: z.infer<typeof strategyFormSchema>): StrategyRulesV1 {
  const cushionPlnMinor = parseAmountToMinor(data.cushion);
  const allocations: { label: string; percent: number }[] = [];
  const slots = [
    { label: data.slot1Label, percent: data.slot1Percent },
    { label: data.slot2Label, percent: data.slot2Percent },
    { label: data.slot3Label, percent: data.slot3Percent },
  ] as const;

  for (const slot of slots) {
    if (!slot.label?.trim()) {
      continue;
    }

    const p = parseOptionalPercent(slot.percent ?? undefined);

    if (p === null) {
      continue;
    }

    allocations.push({ label: slot.label.trim(), percent: p });
  }

  return { cushionPlnMinor, allocations };
}

export function computeAllocationSuggestion(surplusMinor: number, rules: StrategyRulesV1) {
  const pool = Math.max(0, surplusMinor - rules.cushionPlnMinor);

  return rules.allocations.map((row) => ({
    label: row.label,
    amountMinor: Math.round((pool * row.percent) / 100),
  }));
}

export function parseQuantityDelta(raw: string | undefined) {
  if (!raw?.trim()) {
    return 0;
  }

  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function toAssetTypeLabel(type: string) {
  const labels: Record<string, string> = {
    etf: "ETF",
    stock: "Akcje",
    bond: "Obligacje",
    crypto: "Krypto",
    ike_ikze: "IKE/IKZE",
    cash: "Gotowka",
  };

  return labels[type] ?? type;
}

export function toOperationTypeLabel(type: string) {
  const labels: Record<string, string> = {
    buy: "Zakup / wplata na pozycje",
    sell: "Sprzedaz / wyplata",
    dividend: "Dywidenda",
    deposit: "Wplata",
    withdrawal: "Wyplata",
    valuation_update: "Aktualizacja wyceny",
  };

  return labels[type] ?? type;
}
