import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyMigrations } from "../db/apply-migrations";
import { normalizeImportRow } from "../domain/imports";

const requestedRows = Number(process.argv[2] ?? "50000");

if (!Number.isInteger(requestedRows) || requestedRows < 1 || requestedRows > 50000) {
  throw new Error("Podaj liczbe wierszy od 1 do 50000, np. npm run benchmark:import -- 1000.");
}

const benchmarkDirectory = mkdtempSync(join(tmpdir(), "cfo-import-benchmark-"));
const databasePath = join(benchmarkDirectory, "app.db");
process.env.DATABASE_URL = databasePath;
let rawDb: (typeof import("../db/client"))["rawDb"] | undefined;

try {
  const client = await import("../db/client");
  rawDb = client.rawDb;
  const { createImportPreview, confirmImportForUser } = await import("../db/imports");
  applyMigrations(rawDb);

  const now = "2026-09-05T00:00:00.000Z";
  rawDb
    .prepare(
      "INSERT INTO users (id, login, display_name, password_hash, base_currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run("usr_benchmark", "benchmark", "Benchmark", "hash", "PLN", now, now);
  rawDb
    .prepare(
      "INSERT INTO categories (id, user_id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run("cat_benchmark", "usr_benchmark", "Test", "expense", now, now);
  rawDb
    .prepare(
      "INSERT INTO financial_accounts (id, user_id, name, institution, type, currency, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run("acc_benchmark", "usr_benchmark", "Benchmark", "Test", "bank", "PLN", 1, now, now);

  const mapping = {
    dateColumn: "Data",
    amountColumn: "Kwota",
    descriptionColumn: "Opis",
    categoryId: "cat_benchmark",
    defaultType: "expense" as const,
  };
  const normalizeStartedAt = performance.now();
  const rows = Array.from({ length: requestedRows }, (_, index) => {
    const raw = {
      Data: `2026-09-${String((index % 28) + 1).padStart(2, "0")}`,
      Kwota: `-${((index % 10000) + 1).toFixed(2)}`,
      Opis: `Transakcja benchmark ${index + 1}`,
    };

    return {
      rowNumber: index + 2,
      raw,
      normalized: normalizeImportRow("usr_benchmark", raw, mapping, {
        financialAccountId: "acc_benchmark",
      }),
    };
  });
  const normalizeDurationMs = Math.round(performance.now() - normalizeStartedAt);

  const previewStartedAt = performance.now();
  const batchId = createImportPreview({
    userId: "usr_benchmark",
    fileName: `benchmark-${requestedRows}.csv`,
    fileType: "csv",
    fileHash: `benchmark-${requestedRows}`,
    sourceInstitution: "benchmark",
    financialAccountId: "acc_benchmark",
    normalizeDurationMs,
    mapping,
    rows,
  });
  const previewDurationMs = Math.round(performance.now() - previewStartedAt);

  const persistStartedAt = performance.now();
  const result = confirmImportForUser("usr_benchmark", batchId);
  const persistDurationMs = Math.round(performance.now() - persistStartedAt);
  assert.equal(result.imported, requestedRows);
  assert.equal(result.skippedDuplicate, 0);
  assert.equal(result.failed, 0);

  rawDb.pragma("wal_checkpoint(TRUNCATE)");
  const databaseBytes = statSync(databasePath).size;
  const pageCount = (rawDb.pragma("page_count", { simple: true }) as number) ?? 0;
  const freePageCount = (rawDb.pragma("freelist_count", { simple: true }) as number) ?? 0;
  const pageSize = (rawDb.pragma("page_size", { simple: true }) as number) ?? 0;
  console.log(
    JSON.stringify({
      rows: requestedRows,
      normalizeDurationMs,
      previewDurationMs,
      persistDurationMs,
      totalDurationMs: normalizeDurationMs + previewDurationMs + persistDurationMs,
      databaseBytes,
      usedDatabaseBytes: (pageCount - freePageCount) * pageSize,
      reclaimableDatabaseBytes: freePageCount * pageSize,
    }),
  );
} finally {
  rawDb?.close();
  rmSync(benchmarkDirectory, { recursive: true, force: true });
}
