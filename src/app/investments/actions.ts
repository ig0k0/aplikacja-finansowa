"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildStrategyRulesFromForm,
  investmentOperationFormSchema,
  newInvestmentAssetSchema,
  parseQuantityDelta,
  strategyFormSchema,
} from "@/domain/investments";
import { parseAmountToMinor } from "@/domain/transactions";
import { requireUser } from "@/lib/session";

function redirectWithError(message: string): never {
  redirect(`/investments?error=${encodeURIComponent(message)}`);
}

export async function createInvestmentAssetAction(formData: FormData) {
  const user = await requireUser();
  const parsed = newInvestmentAssetSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    ticker: String(formData.get("ticker") ?? ""),
    type: String(formData.get("type") ?? ""),
    marketValue: String(formData.get("marketValue") ?? "").trim() || undefined,
    costBasis: String(formData.get("costBasis") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? "Niepoprawne dane aktywa.");
  }

  const marketMinor = parsed.data.marketValue ? parseAmountToMinor(parsed.data.marketValue) : 0;
  const costMinor = parsed.data.costBasis ? parseAmountToMinor(parsed.data.costBasis) : 0;

  try {
    const { createInvestmentAsset } = await import("@/db/investments");
    createInvestmentAsset({
      userId: user.id,
      name: parsed.data.name,
      ticker: parsed.data.ticker,
      type: parsed.data.type,
      marketValuePlnMinor: marketMinor,
      costBasisPlnMinor: costMinor,
    });
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Nie udalo sie zapisac aktywa.");
  }

  revalidatePath("/investments");
  revalidatePath("/dashboard");
  redirect("/investments?saved=asset");
}

export async function addInvestmentOperationAction(formData: FormData) {
  const user = await requireUser();
  const parsed = investmentOperationFormSchema.safeParse({
    assetId: String(formData.get("assetId") ?? ""),
    type: String(formData.get("type") ?? ""),
    operationDate: String(formData.get("operationDate") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    fee: String(formData.get("fee") ?? ""),
    quantityDelta: String(formData.get("quantityDelta") ?? ""),
    note: String(formData.get("note") ?? ""),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? "Niepoprawne dane operacji.");
  }

  const feeMinor = parsed.data.fee?.trim() ? parseAmountToMinor(parsed.data.fee) : 0;
  const qty = parseQuantityDelta(parsed.data.quantityDelta);

  try {
    const { insertInvestmentOperation } = await import("@/db/investments");
    insertInvestmentOperation({
      userId: user.id,
      assetId: parsed.data.assetId,
      type: parsed.data.type,
      operationDate: parsed.data.operationDate,
      amountPlnMinor: parseAmountToMinor(parsed.data.amount),
      feePlnMinor: feeMinor,
      quantityDelta: qty,
      note: parsed.data.note,
    });
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Nie udalo sie zapisac operacji.");
  }

  revalidatePath("/investments");
  revalidatePath("/dashboard");
  redirect("/investments?saved=op");
}

export async function saveInvestmentStrategyAction(formData: FormData) {
  const user = await requireUser();
  const parsed = strategyFormSchema.safeParse({
    name: String(formData.get("strategyName") ?? "").trim() || "Moja strategia",
    cushion: String(formData.get("cushion") ?? ""),
    slot1Label: String(formData.get("slot1Label") ?? ""),
    slot1Percent: String(formData.get("slot1Percent") ?? ""),
    slot2Label: String(formData.get("slot2Label") ?? ""),
    slot2Percent: String(formData.get("slot2Percent") ?? ""),
    slot3Label: String(formData.get("slot3Label") ?? ""),
    slot3Percent: String(formData.get("slot3Percent") ?? ""),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? "Niepoprawna strategia.");
  }

  const rules = buildStrategyRulesFromForm(parsed.data);

  if (rules.allocations.length === 0) {
    redirectWithError("Dodaj co najmniej jeden cel z procentem alokacji.");
  }

  try {
    const { saveActiveStrategyForUser } = await import("@/db/investments");
    saveActiveStrategyForUser({
      userId: user.id,
      name: parsed.data.name.trim() || "Strategia",
      rules,
    });
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Nie udalo sie zapisac strategii.");
  }

  revalidatePath("/investments");
  revalidatePath("/dashboard");
  redirect("/investments?saved=strategy");
}

export async function deleteInvestmentAssetAction(formData: FormData) {
  const user = await requireUser();
  const assetId = String(formData.get("assetId") ?? "");

  if (!assetId) {
    redirectWithError("Brak identyfikatora aktywa.");
  }

  try {
    const { deleteInvestmentAssetForUser } = await import("@/db/investments");
    deleteInvestmentAssetForUser(user.id, assetId);
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Nie udalo sie usunac.");
  }

  revalidatePath("/investments");
  revalidatePath("/dashboard");
  redirect("/investments?deleted=1");
}
