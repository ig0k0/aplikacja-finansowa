"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { financialAccountSchema } from "@/domain/financial-accounts";
import { requireUser } from "@/lib/session";

function redirectWithError(message: string): never {
  redirect(`/settings/accounts?error=${encodeURIComponent(message)}`);
}

export async function createFinancialAccountAction(formData: FormData) {
  const user = await requireUser();
  const parsed = financialAccountSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    institution: String(formData.get("institution") ?? ""),
    type: String(formData.get("type") ?? ""),
    currency: String(formData.get("currency") ?? ""),
    externalAccountHint: String(formData.get("externalAccountHint") ?? ""),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? "Niepoprawne dane konta.");
  }

  try {
    const { createFinancialAccountForUser } = await import("@/db/financial-accounts");
    createFinancialAccountForUser(user.id, parsed.data);
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Nie udalo sie utworzyc konta.");
  }

  revalidatePath("/settings/accounts");
  revalidatePath("/transactions");
  revalidatePath("/imports");
  redirect("/settings/accounts?saved=created");
}

export async function archiveFinancialAccountAction(formData: FormData) {
  const user = await requireUser();
  const accountId = String(formData.get("accountId") ?? "");

  if (!accountId) {
    redirectWithError("Brakuje identyfikatora konta.");
  }

  try {
    const { archiveFinancialAccountForUser } = await import("@/db/financial-accounts");
    archiveFinancialAccountForUser(user.id, accountId);
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Nie udalo sie zarchiwizowac konta.");
  }

  revalidatePath("/settings/accounts");
  revalidatePath("/transactions");
  revalidatePath("/imports");
  redirect("/settings/accounts?saved=archived");
}
