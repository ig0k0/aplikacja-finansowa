import { z } from "zod";

const amountSchema = z
  .string()
  .trim()
  .min(1, "Limit jest wymagany.")
  .regex(/^\d+([,.]\d{1,2})?$/, "Limit musi miec format np. 500,00.");

export const budgetLimitSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Miesiac jest wymagany."),
  categoryId: z.string().min(1, "Kategoria jest wymagana."),
  limit: amountSchema,
});

export function currentMonthInputValue() {
  return new Date().toISOString().slice(0, 7);
}

export function monthDateRange(month: string) {
  const [yearValue, monthValue] = month.split("-").map(Number);
  const start = `${month}-01`;
  const endDate = new Date(yearValue, monthValue, 0).getDate();

  return {
    start,
    end: `${month}-${String(endDate).padStart(2, "0")}`,
  };
}
