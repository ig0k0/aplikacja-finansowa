"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { categorizeTransactionForUser } from "@/ai/categorize-one";
import {
  listTransactionsForUser,
  resetStaleCategorizationClaimsForUser,
} from "@/db/transactions";
import { requireUser } from "@/lib/session";

function redirectWithError(message: string): never {
  redirect(`/review?error=${encodeURIComponent(message)}`);
}

export async function runAiForTransactionAction(formData: FormData) {
  const user = await requireUser();
  const transactionId = String(formData.get("transactionId") ?? "");

  if (!transactionId) {
    redirectWithError("Brak identyfikatora transakcji.");
  }

  const outcome = await categorizeTransactionForUser(user.id, transactionId);

  revalidatePath("/review");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");

  if (outcome.status === "error") {
    redirectWithError(outcome.message);
  }

  const params = new URLSearchParams({ ai: outcome.status });
  redirect(`/review?${params.toString()}`);
}

export async function runAiBatchAction() {
  const user = await requireUser();
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  resetStaleCategorizationClaimsForUser(user.id, staleBefore);
  const pending = listTransactionsForUser(user.id, {
    categorizationStatus: "pending",
    sort: "oldest",
  });
  const slice = pending.slice(0, 25);

  if (slice.length === 0) {
    redirect("/review?batch=empty");
  }

  const stats = {
    processed: 0,
    memory: 0,
    ai_auto: 0,
    ai_review: 0,
    disabled: 0,
    errors: 0,
  };

  for (const tx of slice) {
    const outcome = await categorizeTransactionForUser(user.id, tx.id, { allowRetry: false });
    stats.processed += 1;

    if (outcome.status === "memory") {
      stats.memory += 1;
    } else if (outcome.status === "ai_auto") {
      stats.ai_auto += 1;
    } else if (outcome.status === "ai_review") {
      stats.ai_review += 1;
    } else if (outcome.status === "disabled") {
      stats.disabled += 1;
    } else if (outcome.status === "error") {
      stats.errors += 1;
    }
  }

  revalidatePath("/review");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");

  const params = new URLSearchParams({ batch: "1", ...Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, String(v)])) });
  redirect(`/review?${params.toString()}`);
}

export async function acceptAiSuggestionsBulkAction(formData: FormData) {
  const user = await requireUser();
  const remember = String(formData.get("remember") ?? "") === "1";

  const { bulkAcceptAiSuggestionsForUser } = await import("@/db/review-bulk");
  const result = bulkAcceptAiSuggestionsForUser(user.id, { rememberPattern: remember });

  revalidatePath("/review");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/insights");

  if (result.accepted === 0) {
    redirect(
      `/review?bulk=none&scanned=${result.scanned}&skipped=${result.skipped}`,
    );
  }

  const params = new URLSearchParams({
    bulk: "1",
    accepted: String(result.accepted),
    skipped: String(result.skipped),
    scanned: String(result.scanned),
  });

  redirect(`/review?${params.toString()}`);
}
