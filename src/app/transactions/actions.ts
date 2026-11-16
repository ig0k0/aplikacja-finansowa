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
    financialAccountId: String(formData.get("financialAccountId") ?? ""),
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
      financialAccountId: parsed.data.financialAccountId || null,
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

export async function deleteTransactionAction(formData: FormData) {
  const user = await requireUser();
  const transactionId = String(formData.get("transactionId") ?? "");

  if (!transactionId) {
    redirectWithError("Brak identyfikatora transakcji.");
  }

  // Usuwanie jest nieodwracalne, wiec wymagamy jawnego potwierdzenia takze po stronie serwera.
  if (String(formData.get("confirm") ?? "") !== "1") {
    redirectWithError("Zaznacz potwierdzenie, aby usunac transakcje.");
  }

  try {
    const [{ deleteTransactionForUser }, { recordAuditEvent }] = await Promise.all([
      import("@/db/transactions"),
      import("@/db/audit"),
    ]);

    deleteTransactionForUser(user.id, transactionId);
    recordAuditEvent({ userId: user.id, action: "transaction_deleted", meta: { transactionId } });
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Nie udalo sie usunac transakcji.");
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/review");
  revalidatePath("/investments");
  revalidatePath("/insights");
  redirect("/transactions?deleted=1");
}
