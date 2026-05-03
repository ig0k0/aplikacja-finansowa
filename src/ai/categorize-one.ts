import {
  aiCategorizationResponseSchema,
  extractJsonObjectFromModelText,
} from "@/domain/ai-categorization";
import { insertAiSuggestion, supersedePendingSuggestionsForTransaction } from "@/db/ai-suggestions";
import { listCategoriesForUser } from "@/db/categories";
import { findCorrectionMemoryCategoryId } from "@/db/correction-memory";
import {
  applyAiCategorizationToTransaction,
  applyMemoryHitToTransaction,
  getTransactionForUser,
} from "@/db/transactions";
import { getAiRuntimeConfig, isAiEnabled } from "@/lib/ai-config";
import { categoriesForPromptByType } from "./category-catalog";
import { completeChatText } from "./openai-compatible";

export type CategorizeOutcome =
  | { status: "disabled" }
  | { status: "memory"; categoryId: string }
  | { status: "ai_auto"; categoryId: string }
  | { status: "ai_review"; categoryId: string | null }
  | { status: "error"; message: string };

export async function categorizeTransactionForUser(
  userId: string,
  transactionId: string,
): Promise<CategorizeOutcome> {
  const config = getAiRuntimeConfig();
  const transaction = getTransactionForUser(userId, transactionId);

  if (!transaction) {
    return { status: "error", message: "Nie znaleziono transakcji." };
  }

  const memoryCategoryId = findCorrectionMemoryCategoryId({
    userId,
    merchantName: transaction.merchantName,
    description: transaction.description,
    rawDescription: transaction.rawDescription,
  });

  if (memoryCategoryId) {
    applyMemoryHitToTransaction(userId, transactionId, memoryCategoryId);
    return { status: "memory", categoryId: memoryCategoryId };
  }

  if (!isAiEnabled(config)) {
    return { status: "disabled" };
  }

  const categories = listCategoriesForUser(userId);
  const catalog = categoriesForPromptByType(categories, transaction.type);
  const allowedIds = new Set(catalog.map((entry) => entry.id));

  const systemPrompt = [
    "Jestes klasyfikatorem transakcji finansowych osobistych.",
    "Zwroc WYLACZNIE jeden obiekt JSON bez markdownu ani komentarzy.",
    "Pola: categoryId (string), categoryPath (opcjonalnie, tablica stringow lub pust)",
    "description (opcjonalnie, krotki opis po polsku), tags (opcjonalnie, tablica stringow),",
    "confidence (liczba 0-1), needsManualReview (boolean), reasonCode (opcjonalnie).",
    "categoryId musi dokladnie odpowiadac jednemu z podanych identyfikatorow.",
  ].join(" ");

  const catalogLines = catalog.map((entry) => `- ${entry.id} :: ${entry.path}`);
  const userPrompt = [
    "Lista dozwolonych kategorii (id :: sciezka):",
    ...catalogLines,
    "",
    "Transakcja:",
    `typ: ${transaction.type}`,
    `data: ${transaction.transactionDate}`,
    `kwota_PLN_grosze: ${transaction.amountPlnMinor}`,
    `sklep: ${transaction.merchantName ?? ""}`,
    `opis: ${transaction.description ?? ""}`,
    `surowy_opis: ${transaction.rawDescription ?? ""}`,
  ].join("\n");

  let rawContent: string;

  try {
    rawContent = await completeChatText(config, systemPrompt, userPrompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI niedostepne.";
    return { status: "error", message };
  }

  let parsedJson: unknown;

  try {
    parsedJson = extractJsonObjectFromModelText(rawContent);
  } catch {
    return { status: "error", message: "Model nie zwrocil poprawnego JSON." };
  }

  const validated = aiCategorizationResponseSchema.safeParse(parsedJson);

  if (!validated.success) {
    return { status: "error", message: "Walidacja odpowiedzi modelu nie powiodla sie." };
  }

  const data = validated.data;
  const categoryId = allowedIds.has(data.categoryId) ? data.categoryId : null;
  let reasonCode = data.reasonCode ?? null;

  if (!categoryId) {
    reasonCode = reasonCode ?? "invalid_category";
  }

  const confidence = data.confidence;
  const autoThreshold = config.autoThreshold;
  const reviewThreshold = config.reviewThreshold;

  const needsReviewByModel = data.needsManualReview || confidence < autoThreshold;
  const needsManualReviewFlag =
    confidence < reviewThreshold || needsReviewByModel || categoryId === null;

  supersedePendingSuggestionsForTransaction(userId, transactionId);

  insertAiSuggestion({
    userId,
    transactionId,
    provider: config.mode === "external" ? "openai_compatible" : "ollama_compatible",
    model: config.model,
    suggestedCategoryId: categoryId,
    suggestedDescription: data.description ?? null,
    suggestedTagsJson: data.tags?.length ? JSON.stringify(data.tags) : null,
    confidence,
    reasonCode,
    needsManualReview: needsManualReviewFlag,
  });

  const tagListJson = data.tags?.length ? JSON.stringify(data.tags) : null;

  if (categoryId === null || confidence < reviewThreshold) {
    applyAiCategorizationToTransaction({
      userId,
      transactionId,
      categoryId: null,
      description: data.description,
      tagListJson,
      verificationStatus: "needs_review",
    });

    return { status: "ai_review", categoryId };
  }

  if (confidence >= autoThreshold && !needsReviewByModel && categoryId) {
    applyAiCategorizationToTransaction({
      userId,
      transactionId,
      categoryId,
      description: data.description,
      tagListJson,
      verificationStatus: "auto_categorized",
    });

    return { status: "ai_auto", categoryId };
  }

  applyAiCategorizationToTransaction({
    userId,
    transactionId,
    categoryId,
    description: data.description,
    tagListJson,
    verificationStatus: "needs_review",
  });

  return { status: "ai_review", categoryId };
}
