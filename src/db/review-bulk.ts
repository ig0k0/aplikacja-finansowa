import { getLatestAiSuggestionsForTransactions } from "./ai-suggestions";
import { listTransactionsForUser, updateTransactionCategoryForUser } from "./transactions";
import { getAiRuntimeConfig } from "../lib/ai-config";

const DEFAULT_LIMIT = 25;

export function countBulkAcceptEligibleForUser(userId: string, limit = DEFAULT_LIMIT) {
  const config = getAiRuntimeConfig();
  const pending = listTransactionsForUser(userId, {
    verificationStatus: "needs_review",
    sort: "oldest",
  });

  const slice = pending.slice(0, limit);
  const suggestionMap = getLatestAiSuggestionsForTransactions(
    userId,
    slice.map((row) => row.id),
  );

  let eligible = 0;

  for (const row of slice) {
    const suggestion = suggestionMap.get(row.id);

    if (
      suggestion?.suggestedCategoryId &&
      suggestion.confidence >= config.reviewThreshold
    ) {
      eligible += 1;
    }
  }

  return { eligible, inQueue: pending.length };
}

export function bulkAcceptAiSuggestionsForUser(
  userId: string,
  input: { rememberPattern: boolean; limit?: number },
) {
  const config = getAiRuntimeConfig();
  const limit = input.limit ?? DEFAULT_LIMIT;
  const pending = listTransactionsForUser(userId, {
    verificationStatus: "needs_review",
    sort: "oldest",
  });
  const slice = pending.slice(0, limit);
  const suggestionMap = getLatestAiSuggestionsForTransactions(
    userId,
    slice.map((row) => row.id),
  );

  let accepted = 0;
  let skipped = 0;

  for (const row of slice) {
    const suggestion = suggestionMap.get(row.id);
    const categoryId = suggestion?.suggestedCategoryId;

    if (!categoryId || suggestion.confidence < config.reviewThreshold) {
      skipped += 1;
      continue;
    }

    updateTransactionCategoryForUser(userId, row.id, categoryId, {
      rememberPattern: input.rememberPattern,
    });
    accepted += 1;
  }

  return { accepted, skipped, scanned: slice.length };
}
