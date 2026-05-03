"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { budgetLimitSchema } from "@/domain/budgets";
import { parseAmountToMinor } from "@/domain/transactions";
import { requireUser } from "@/lib/session";

function redirectWithError(month: string, message: string): never {
  redirect(`/reports/monthly?month=${month}&error=${encodeURIComponent(message)}`);
}

export async function saveBudgetLimitAction(formData: FormData) {
  const user = await requireUser();
  const parsed = budgetLimitSchema.safeParse({
    month: String(formData.get("month") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    limit: String(formData.get("limit") ?? ""),
  });
  const fallbackMonth = String(formData.get("month") ?? "");

  if (!parsed.success) {
    redirectWithError(
      fallbackMonth,
      parsed.error.issues[0]?.message ?? "Niepoprawne dane budzetu.",
    );
  }

  try {
    const { upsertBudgetLimit } = await import("@/db/budgets");

    upsertBudgetLimit({
      userId: user.id,
      month: parsed.data.month,
      categoryId: parsed.data.categoryId,
      limitPlnMinor: parseAmountToMinor(parsed.data.limit),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udalo sie zapisac budzetu.";

    redirectWithError(parsed.data.month, message);
  }

  revalidatePath("/reports/monthly");
  revalidatePath("/dashboard");
  redirect(`/reports/monthly?month=${parsed.data.month}&saved=1`);
}
