import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { aiSuggestions } from "./schema";
import { createId } from "../lib/ids";
import { nowIso } from "../lib/time";

export function supersedePendingSuggestionsForTransaction(
  userId: string,
  transactionId: string,
) {
  db.update(aiSuggestions)
    .set({ status: "superseded" })
    .where(
      and(
        eq(aiSuggestions.userId, userId),
        eq(aiSuggestions.transactionId, transactionId),
        eq(aiSuggestions.status, "pending"),
      ),
    )
    .run();
}

export function insertAiSuggestion(input: {
  userId: string;
  transactionId: string;
  provider: string;
  model: string;
  suggestedCategoryId: string | null;
  suggestedDescription: string | null;
  suggestedTagsJson: string | null;
  confidence: number;
  reasonCode: string | null;
  needsManualReview: boolean;
}) {
  const now = nowIso();
  const id = createId("ais");

  db.insert(aiSuggestions)
    .values({
      id,
      userId: input.userId,
      transactionId: input.transactionId,
      provider: input.provider,
      model: input.model,
      suggestedCategoryId: input.suggestedCategoryId,
      suggestedDescription: input.suggestedDescription,
      suggestedTagsJson: input.suggestedTagsJson,
      confidence: input.confidence,
      reasonCode: input.reasonCode,
      needsManualReview: input.needsManualReview,
      status: "pending",
      createdAt: now,
    })
    .run();

  return id;
}

export function getLatestAiSuggestionsForTransactions(
  userId: string,
  transactionIds: string[],
) {
  if (transactionIds.length === 0) {
    return new Map<string, (typeof aiSuggestions.$inferSelect)>();
  }

  const rows = db
    .select()
    .from(aiSuggestions)
    .where(and(eq(aiSuggestions.userId, userId), inArray(aiSuggestions.transactionId, transactionIds)))
    .orderBy(desc(aiSuggestions.createdAt))
    .all();

  const map = new Map<string, (typeof aiSuggestions.$inferSelect)>();

  for (const row of rows) {
    if (!map.has(row.transactionId)) {
      map.set(row.transactionId, row);
    }
  }

  return map;
}
