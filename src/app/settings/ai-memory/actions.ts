"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  correctionMemoryFormSchema,
  correctionMemoryUpdateSchema,
} from "@/domain/correction-memory";
import { requireUser } from "@/lib/session";

function redirectWithError(message: string): never {
  redirect(`/settings/ai-memory?error=${encodeURIComponent(message)}`);
}

export async function createCorrectionMemoryAction(formData: FormData) {
  const user = await requireUser();
  const parsed = correctionMemoryFormSchema.safeParse({
    patternType: String(formData.get("patternType") ?? ""),
    patternValue: String(formData.get("patternValue") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? "Niepoprawne dane reguly.");
  }

  try {
    const { createCorrectionMemoryRule } = await import("@/db/correction-memory");
    createCorrectionMemoryRule({
      userId: user.id,
      patternType: parsed.data.patternType,
      patternValue: parsed.data.patternValue,
      categoryId: parsed.data.categoryId,
    });
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Nie udalo sie zapisac reguly.");
  }

  revalidatePath("/settings/ai-memory");
  revalidatePath("/review");
  redirect("/settings/ai-memory?saved=created");
}

export async function updateCorrectionMemoryAction(formData: FormData) {
  const user = await requireUser();
  const parsed = correctionMemoryUpdateSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? "Niepoprawne dane.");
  }

  try {
    const { updateCorrectionMemoryCategoryForUser } = await import("@/db/correction-memory");
    updateCorrectionMemoryCategoryForUser(user.id, parsed.data.id, parsed.data.categoryId);
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Nie udalo sie zaktualizowac.");
  }

  revalidatePath("/settings/ai-memory");
  revalidatePath("/review");
  redirect("/settings/ai-memory?saved=updated");
}

export async function deleteCorrectionMemoryAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  if (!id) {
    redirectWithError("Brak identyfikatora reguly.");
  }

  try {
    const { deleteCorrectionMemoryForUser } = await import("@/db/correction-memory");
    deleteCorrectionMemoryForUser(user.id, id);
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Nie udalo sie usunac.");
  }

  revalidatePath("/settings/ai-memory");
  revalidatePath("/review");
  redirect("/settings/ai-memory?saved=deleted");
}
