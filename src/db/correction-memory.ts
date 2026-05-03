import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import { categories, userCorrectionMemory } from "./schema";
import { createId } from "../lib/ids";
import { nowIso } from "../lib/time";

const MERCHANT = "merchant";
const DESCRIPTION_CONTAINS = "description_contains";

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
