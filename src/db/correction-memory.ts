import { and, desc, eq } from "drizzle-orm";
import type { CorrectionPatternType } from "@/domain/correction-memory";
import { normalizePatternValue } from "@/domain/correction-memory";
import { db } from "./client";
import { categories, userCorrectionMemory } from "./schema";
import { createId } from "../lib/ids";
import { nowIso } from "../lib/time";

export const CORRECTION_PATTERN_MERCHANT = "merchant";
export const CORRECTION_PATTERN_DESCRIPTION = "description_contains";

const MERCHANT = CORRECTION_PATTERN_MERCHANT;
const DESCRIPTION_CONTAINS = CORRECTION_PATTERN_DESCRIPTION;

export type CorrectionMemoryRow = {
  id: string;
  patternType: string;
  patternValue: string;
  categoryId: string;
  categoryName: string;
  confidenceBoost: number;
  lastUsedAt: string | null;
  createdAt: string;
};

function ensureCategoryForUser(userId: string, categoryId: string) {
  const category = db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.userId, userId),
        eq(categories.isArchived, false),
      ),
    )
    .get();

  if (!category) {
    throw new Error("Kategoria nie nalezy do Twojego konta.");
  }
}

export function listCorrectionMemoryForUser(userId: string): CorrectionMemoryRow[] {
  return db
    .select({
      id: userCorrectionMemory.id,
      patternType: userCorrectionMemory.patternType,
      patternValue: userCorrectionMemory.patternValue,
      categoryId: userCorrectionMemory.categoryId,
      categoryName: categories.name,
      confidenceBoost: userCorrectionMemory.confidenceBoost,
      lastUsedAt: userCorrectionMemory.lastUsedAt,
      createdAt: userCorrectionMemory.createdAt,
    })
    .from(userCorrectionMemory)
    .innerJoin(categories, eq(userCorrectionMemory.categoryId, categories.id))
    .where(eq(userCorrectionMemory.userId, userId))
    .orderBy(desc(userCorrectionMemory.lastUsedAt), desc(userCorrectionMemory.createdAt))
    .all();
}

export function findCorrectionMemoryCategoryId(input: {
  userId: string;
  merchantName: string | null;
  description: string | null;
  rawDescription: string | null;
}) {
  const rows = db
    .select()
    .from(userCorrectionMemory)
    .where(eq(userCorrectionMemory.userId, input.userId))
    .orderBy(desc(userCorrectionMemory.lastUsedAt))
    .all();

  const merchantNorm = input.merchantName?.trim().toLowerCase() ?? "";
  const blob = [input.description, input.rawDescription]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const type of [MERCHANT, DESCRIPTION_CONTAINS] as const) {
    for (const row of rows) {
      if (row.patternType !== type) {
        continue;
      }

      if (type === MERCHANT && merchantNorm && row.patternValue === merchantNorm) {
        return row.categoryId;
      }

      if (
        type === DESCRIPTION_CONTAINS &&
        row.patternValue &&
        blob.includes(row.patternValue.toLowerCase())
      ) {
        return row.categoryId;
      }
    }
  }

  return null;
}

export function createCorrectionMemoryRule(input: {
  userId: string;
  patternType: CorrectionPatternType;
  patternValue: string;
  categoryId: string;
}) {
  ensureCategoryForUser(input.userId, input.categoryId);

  const patternValue = normalizePatternValue(input.patternType, input.patternValue);

  if (patternValue.length < 2) {
    throw new Error("Wzorzec jest zbyt krotki.");
  }

  const now = nowIso();
  const confidenceBoost = input.patternType === MERCHANT ? 0.15 : 0.1;

  db.insert(userCorrectionMemory)
    .values({
      id: createId("cor"),
      userId: input.userId,
      patternType: input.patternType,
      patternValue,
      categoryId: input.categoryId,
      confidenceBoost,
      lastUsedAt: now,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [
        userCorrectionMemory.userId,
        userCorrectionMemory.patternType,
        userCorrectionMemory.patternValue,
      ],
      set: {
        categoryId: input.categoryId,
        lastUsedAt: now,
      },
    })
    .run();
}

export function updateCorrectionMemoryCategoryForUser(
  userId: string,
  ruleId: string,
  categoryId: string,
) {
  ensureCategoryForUser(userId, categoryId);

  const result = db
    .update(userCorrectionMemory)
    .set({ categoryId, lastUsedAt: nowIso() })
    .where(and(eq(userCorrectionMemory.id, ruleId), eq(userCorrectionMemory.userId, userId)))
    .run();

  if (result.changes === 0) {
    throw new Error("Regula nie zostala znaleziona.");
  }
}

export function deleteCorrectionMemoryForUser(userId: string, ruleId: string) {
  const result = db
    .delete(userCorrectionMemory)
    .where(and(eq(userCorrectionMemory.id, ruleId), eq(userCorrectionMemory.userId, userId)))
    .run();

  if (result.changes === 0) {
    throw new Error("Regula nie zostala znaleziona.");
  }
}

export function upsertCorrectionMemory(input: {
  userId: string;
  categoryId: string;
  merchantName: string | null;
  description: string | null;
}) {
  const category = db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, input.categoryId),
        eq(categories.userId, input.userId),
        eq(categories.isArchived, false),
      ),
    )
    .get();

  if (!category) {
    return;
  }

  const merchant = input.merchantName?.trim();
  const now = nowIso();

  if (merchant) {
    const patternValue = merchant.toLowerCase();
    const id = createId("cor");

    db.insert(userCorrectionMemory)
      .values({
        id,
        userId: input.userId,
        patternType: MERCHANT,
        patternValue,
        categoryId: input.categoryId,
        confidenceBoost: 0.15,
        lastUsedAt: now,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [
          userCorrectionMemory.userId,
          userCorrectionMemory.patternType,
          userCorrectionMemory.patternValue,
        ],
        set: {
          categoryId: input.categoryId,
          lastUsedAt: now,
        },
      })
      .run();

    return;
  }

  const desc = input.description?.trim().toLowerCase() ?? "";

  if (desc.length < 4) {
    return;
  }

  const patternValue = desc.slice(0, 80);
  const id = createId("cor");

  db.insert(userCorrectionMemory)
    .values({
      id,
      userId: input.userId,
      patternType: DESCRIPTION_CONTAINS,
      patternValue,
      categoryId: input.categoryId,
      confidenceBoost: 0.1,
      lastUsedAt: now,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [
        userCorrectionMemory.userId,
        userCorrectionMemory.patternType,
        userCorrectionMemory.patternValue,
      ],
      set: {
        categoryId: input.categoryId,
        lastUsedAt: now,
      },
    })
    .run();
}
