"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { manualTransactionSchema, parseAmountToMinor } from "@/domain/transactions";
import { requireUser } from "@/lib/session";

function redirectWithError(message: string): never {
  redirect(`/transactions?error=${encodeURIComponent(message)}`);
}

export async function createTransactionAction(formData: FormData) {
  const user = await requireUser();
  const parsed = manualTransactionSchema.safeParse({
    type: String(formData.get("type") ?? ""),
    transactionDate: String(formData.get("transactionDate") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    description: String(formData.get("description") ?? ""),
    merchantName: String(formData.get("merchantName") ?? ""),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? "Niepoprawne dane transakcji.");
  }

  try {
    const { createManualTransaction } = await import("@/db/transactions");

    createManualTransaction({
      userId: user.id,
      type: parsed.data.type,
      transactionDate: parsed.data.transactionDate,
      amountMinor: parseAmountToMinor(parsed.data.amount),
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      merchantName: parsed.data.merchantName,
      isRecurring: String(formData.get("isRecurring") ?? "") === "1",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udalo sie zapisac transakcji.";

    redirectWithError(message);
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/investments");
  revalidatePath("/insights");
  redirect("/transactions?created=1");
}

export async function updateTransactionCategoryAction(formData: FormData) {
  const user = await requireUser();
  const transactionId = String(formData.get("transactionId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");

  if (!transactionId || !categoryId) {
    redirectWithError("Wybierz transakcje i kategorie.");
  }

  try {
    const { updateTransactionCategoryForUser } = await import("@/db/transactions");
    const remember = String(formData.get("remember") ?? "") === "1";
    const isRecurring = String(formData.get("isRecurring") ?? "") === "1";

    updateTransactionCategoryForUser(user.id, transactionId, categoryId, {
      rememberPattern: remember,
      isRecurring,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udalo sie zmienic kategorii.";

    redirectWithError(message);
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/review");
  revalidatePath("/investments");
  revalidatePath("/insights");
}
