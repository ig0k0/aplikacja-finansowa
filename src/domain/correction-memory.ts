import { z } from "zod";

export const correctionPatternTypes = ["merchant", "description_contains"] as const;
export type CorrectionPatternType = (typeof correctionPatternTypes)[number];

export const correctionMemoryFormSchema = z.object({
  patternType: z.enum(correctionPatternTypes),
  patternValue: z
    .string()
    .trim()
    .min(2, "Wzorzec musi miec co najmniej 2 znaki.")
    .max(120, "Wzorzec jest zbyt dlugi."),
  categoryId: z.string().min(1, "Wybierz kategorie."),
});

export const correctionMemoryUpdateSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1, "Wybierz kategorie."),
});

export function normalizePatternValue(type: CorrectionPatternType, raw: string): string {
  const trimmed = raw.trim().toLowerCase();

  if (type === "description_contains") {
    return trimmed.slice(0, 80);
  }

  return trimmed;
}

export function toPatternTypeLabel(type: string): string {
  if (type === "merchant") {
    return "Kontrahent (dokladne dopasowanie)";
  }

  if (type === "description_contains") {
    return "Opis zawiera fragment";
  }

  return type;
}
