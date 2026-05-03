import { and, asc, eq } from "drizzle-orm";
import { recordAuditEvent } from "./audit";
import { db } from "./client";
import { categories, importBatches, importedRows, transactions } from "./schema";
import { createId } from "../lib/ids";
import { nowIso } from "../lib/time";
import type { ImportMapping, NormalizedImportRow } from "../domain/imports";

export type ImportPreviewInput = {
  userId: string;
  fileName: string;
  fileType: string;
  fileHash: string;
  sourceInstitution: string;
  mapping: ImportMapping;
  rows: {
    rowNumber: number;
    raw: Record<string, string>;
    normalized?: NormalizedImportRow;
    error?: string;
  }[];
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
    throw new Error("Selected import category does not belong to the current user.");
  }
}

export function createImportPreview(input: ImportPreviewInput) {
  ensureCategoryForUser(input.userId, input.mapping.categoryId);

  const now = nowIso();
  const batchId = createId("imp");
  const failedRows = input.rows.filter((row) => row.error).length;

  db.transaction(() => {
    db.insert(importBatches)
      .values({
        id: batchId,
        userId: input.userId,
        sourceInstitution: input.sourceInstitution,
        fileName: input.fileName,
        fileType: input.fileType,
        fileHash: input.fileHash,
        status: failedRows > 0 ? "needs_review" : "preview",
        mappingJson: JSON.stringify(input.mapping),
        rowsTotal: input.rows.length,
        rowsFailed: failedRows,
        createdAt: now,
      })
      .run();

    for (const row of input.rows) {
      db.insert(importedRows)
        .values({
          id: createId("row"),
          importBatchId: batchId,
          rowNumber: row.rowNumber,
          rawDataJson: JSON.stringify(row.raw),
          normalizedDataJson: row.normalized ? JSON.stringify(row.normalized) : null,
          status: row.error ? "failed" : "preview",
          errorMessage: row.error,
        })
        .run();
    }
  });

  return batchId;
}

export function getImportPreviewForUser(userId: string, batchId: string) {
  const batch = db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.id, batchId), eq(importBatches.userId, userId)))
    .get();

  if (!batch) {
    return null;
  }

  const rows = db
    .select()
    .from(importedRows)
    .where(eq(importedRows.importBatchId, batchId))
    .orderBy(asc(importedRows.rowNumber))
    .all();

  return { batch, rows };
}

function findDuplicate(userId: string, dedupeKey: string) {
  return db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.dedupeKey, dedupeKey)))
    .get();
}

export function confirmImportForUser(userId: string, batchId: string) {
  const preview = getImportPreviewForUser(userId, batchId);

  if (!preview) {
    throw new Error("Import batch was not found for the current user.");
  }

  let imported = 0;
  let skippedDuplicate = 0;
  let failed = 0;
  const now = nowIso();

  db.transaction(() => {
    for (const row of preview.rows) {
      if (!row.normalizedDataJson) {
        failed += 1;
        continue;
      }

      const normalized = JSON.parse(row.normalizedDataJson) as NormalizedImportRow;

      if (findDuplicate(userId, normalized.dedupeKey)) {
        skippedDuplicate += 1;
        db.update(importedRows)
          .set({ status: "duplicate" })
          .where(eq(importedRows.id, row.id))
          .run();
        continue;
      }

      const transactionId = createId("txn");

      db.insert(transactions)
        .values({
          id: transactionId,
          userId,
          categoryId: normalized.categoryId,
          type: normalized.type,
          transactionDate: normalized.transactionDate,
          amountMinor: normalized.amountMinor,
          currency: "PLN",
          amountPlnMinor: normalized.amountMinor,
          merchantName: normalized.merchantName,
          description: normalized.description,
          verificationStatus: "needs_review",
          source: "import",
          dedupeKey: normalized.dedupeKey,
          isRecurring: false,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      imported += 1;
      db.update(importedRows)
        .set({ status: "imported", transactionId })
        .where(eq(importedRows.id, row.id))
        .run();
    }

    db.update(importBatches)
      .set({
        status: "imported",
        rowsImported: imported,
        rowsSkippedDuplicate: skippedDuplicate,
        rowsFailed: failed,
        completedAt: nowIso(),
      })
      .where(and(eq(importBatches.id, batchId), eq(importBatches.userId, userId)))
      .run();
  });

  recordAuditEvent({
    userId,
    action: "import_completed",
    meta: {
      batchId,
      fileName: preview.batch.fileName,
      imported,
      skippedDuplicate,
      failed,
    },
  });

  return { imported, skippedDuplicate, failed };
}
