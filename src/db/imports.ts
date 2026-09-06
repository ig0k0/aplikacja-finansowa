import { and, asc, eq, inArray } from "drizzle-orm";
import { recordAuditEvent } from "./audit";
import { db } from "./client";
import { importBatches, importedRows, transactions } from "./schema";
import { createId } from "../lib/ids";
import { nowIso } from "../lib/time";
import type { ImportMapping, NormalizedImportRow } from "../domain/imports";
import {
  createTransactionInsertValues,
  ensureTransactionCategoryForUser,
} from "./transaction-service";
import { ensureFinancialAccountForUser } from "./financial-accounts";

export type ImportPreviewInput = {
  userId: string;
  fileName: string;
  fileType: string;
  fileHash: string;
  sourceInstitution: string;
  financialAccountId?: string | null;
  parseDurationMs?: number;
  normalizeDurationMs?: number;
  mapping: ImportMapping;
  rows: {
    rowNumber: number;
    raw: Record<string, string>;
    normalized?: NormalizedImportRow;
    error?: string;
  }[];
};

const SQLITE_IN_CHUNK_SIZE = 400;
const SQLITE_INSERT_CHUNK_SIZE = 40;
const SQLITE_PREVIEW_INSERT_CHUNK_SIZE = 100;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

export function createImportPreview(input: ImportPreviewInput) {
  ensureTransactionCategoryForUser(input.userId, input.mapping.categoryId);
  ensureFinancialAccountForUser(input.userId, input.financialAccountId);

  const now = nowIso();
  const batchId = createId("imp");
  const failedRows = input.rows.filter((row) => row.error).length;

  db.transaction(() => {
    db.insert(importBatches)
      .values({
        id: batchId,
        userId: input.userId,
        sourceInstitution: input.sourceInstitution,
        financialAccountId: input.financialAccountId ?? null,
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

    const previewRows = input.rows.map((row) => ({
          id: createId("row"),
          importBatchId: batchId,
          rowNumber: row.rowNumber,
          // Po podgladzie surowy wiersz nie jest potrzebny do finalnego zapisu.
          // Trzymamy tylko rekord kanoniczny lub komunikat bledu, aby nie dublowac
          // wrazliwych danych importu w SQLite.
          rawDataJson: "{}",
          normalizedDataJson: row.normalized ? JSON.stringify(row.normalized) : null,
          status: row.error ? "failed" : "preview",
          errorMessage: row.error,
        }));

    for (const group of chunks(previewRows, SQLITE_PREVIEW_INSERT_CHUNK_SIZE)) {
      db.insert(importedRows).values(group).run();
    }
  });

  recordAuditEvent({
    userId: input.userId,
    action: "import_preview_created",
    meta: {
      batchId,
      fileType: input.fileType,
      rowsTotal: input.rows.length,
      rowsFailed: failedRows,
      parseDurationMs: input.parseDurationMs ?? null,
      normalizeDurationMs: input.normalizeDurationMs ?? null,
    },
  });

  return batchId;
}

export function getImportPreviewForUser(
  userId: string,
  batchId: string,
  options: { rowLimit?: number } = {},
) {
  const batch = db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.id, batchId), eq(importBatches.userId, userId)))
    .get();

  if (!batch) {
    return null;
  }

  const rowsQuery = db
    .select()
    .from(importedRows)
    .where(eq(importedRows.importBatchId, batchId))
    .orderBy(asc(importedRows.rowNumber));
  const rows = options.rowLimit ? rowsQuery.limit(options.rowLimit).all() : rowsQuery.all();

  return { batch, rows };
}

function findTransactionsByDedupeKey(userId: string, dedupeKeys: string[]) {
  const result = new Map<string, string>();

  for (const group of chunks(dedupeKeys, SQLITE_IN_CHUNK_SIZE)) {
    if (group.length === 0) {
      continue;
    }

    const rows = db
      .select({ id: transactions.id, dedupeKey: transactions.dedupeKey })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          inArray(transactions.dedupeKey, group),
        ),
      )
      .all();

    for (const row of rows) {
      if (row.dedupeKey) {
        result.set(row.dedupeKey, row.id);
      }
    }
  }

  return result;
}

export function confirmImportForUser(userId: string, batchId: string) {
  const persistStartedAt = Date.now();
  const preview = getImportPreviewForUser(userId, batchId);

  if (!preview) {
    throw new Error("Import batch was not found for the current user.");
  }

  if (preview.batch.status === "imported") {
    throw new Error("Ten import zostal juz zapisany.");
  }

  const mapping = JSON.parse(preview.batch.mappingJson) as ImportMapping;
  ensureTransactionCategoryForUser(userId, mapping.categoryId);
  ensureFinancialAccountForUser(userId, preview.batch.financialAccountId);

  let imported = 0;
  let skippedDuplicate = 0;
  let failed = 0;

  db.transaction(() => {
    const normalizedRows: Array<{
      rowId: string;
      normalized: NormalizedImportRow;
    }> = [];

    for (const row of preview.rows) {
      if (!row.normalizedDataJson) {
        failed += 1;
        continue;
      }

      normalizedRows.push({
        rowId: row.id,
        normalized: JSON.parse(row.normalizedDataJson) as NormalizedImportRow,
      });
    }

    const existingByDedupeKey = findTransactionsByDedupeKey(
      userId,
      normalizedRows.map((row) => row.normalized.dedupeKey),
    );
    const pendingDedupeKeys = new Set<string>();
    const candidates: Array<{
      transactionId: string;
      normalized: NormalizedImportRow;
    }> = [];

    for (const row of normalizedRows) {
      const { normalized } = row;

      if (
        existingByDedupeKey.has(normalized.dedupeKey) ||
        pendingDedupeKeys.has(normalized.dedupeKey)
      ) {
        skippedDuplicate += 1;
        continue;
      }

      pendingDedupeKeys.add(normalized.dedupeKey);
      candidates.push({
        transactionId: createId("txn"),
        normalized,
      });
    }

    for (const group of chunks(candidates, SQLITE_INSERT_CHUNK_SIZE)) {
      db.insert(transactions)
        .values(
          group.map(({ transactionId, normalized }) => ({
            ...createTransactionInsertValues({
              id: transactionId,
              userId,
              categoryId: normalized.categoryId,
              financialAccountId: preview.batch.financialAccountId,
              type: normalized.type,
              transactionDate: normalized.transactionDate,
              postedDate: normalized.postedDate,
              amountMinor: normalized.amountMinor,
              amountPlnMinor: normalized.amountPlnMinor,
              currency: normalized.currency,
              fxRate: normalized.fxRate,
              bankReference: normalized.bankReference,
              merchantName: normalized.merchantName,
              description: normalized.description,
              verificationStatus: "needs_review",
              categorizationStatus: "pending",
              source: "import",
              dedupeKey: normalized.dedupeKey,
            }),
          })),
        )
        .onConflictDoNothing()
        .run();
    }

    const persistedByDedupeKey = findTransactionsByDedupeKey(
      userId,
      candidates.map((candidate) => candidate.normalized.dedupeKey),
    );

    for (const candidate of candidates) {
      if (persistedByDedupeKey.get(candidate.normalized.dedupeKey) === candidate.transactionId) {
        imported += 1;
      } else {
        skippedDuplicate += 1;
      }
    }

    const finalizedRowIds = normalizedRows.map((row) => row.rowId);

    for (const group of chunks(finalizedRowIds, SQLITE_IN_CHUNK_SIZE)) {
      if (group.length > 0) {
        db.delete(importedRows).where(inArray(importedRows.id, group)).run();
      }
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
      persistDurationMs: Date.now() - persistStartedAt,
    },
  });

  return { imported, skippedDuplicate, failed };
}
