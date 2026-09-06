import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { applyMigrations } from "../db/apply-migrations";
import { aiCategorizationResponseSchema, extractJsonObjectFromModelText } from "../domain/ai-categorization";
import { countCategoryTemplateItems } from "../domain/category-template";
import {
  assertImportRowLimit,
  isOcrImageFile,
  MAX_IMPORT_ROWS,
  validateImportFileSize,
} from "../domain/import-limits";
import { computeAllocationSuggestion } from "../domain/investments";
import { normalizeImportRow } from "../domain/imports";
import { parseAmountToMinor } from "../domain/transactions";
import {
  convertQuoteMinorToPlnMinor,
  positionMarketValuePlnMinor,
  toStooqSymbol,
} from "../domain/pricing";
import { detectBankImportMapping } from "../imports/bank-parsers";
import { parseImportFile } from "../imports/parse-file";
import { hashPassword, verifyPassword } from "../lib/password";

const password = "test-password";
const hash = await hashPassword(password);

assert.equal(await verifyPassword(password, hash), true);
assert.equal(await verifyPassword("wrong-password", hash), false);
assert.equal(countCategoryTemplateItems() > 0, true);
assert.equal(parseAmountToMinor("12,34"), 1234);
assert.equal(parseAmountToMinor("12.3"), 1230);
assert.equal(validateImportFileSize("historia.csv", 15 * 1024 * 1024), null);
assert.match(validateImportFileSize("historia.csv", 15 * 1024 * 1024 + 1) ?? "", /zbyt duzy/);
assert.throws(() => assertImportRowLimit(MAX_IMPORT_ROWS + 1), /wiecej niz/);
assert.equal(isOcrImageFile("paragon.webp"), true);
assert.equal(isOcrImageFile("wyciag.pdf"), false);

const parsedCsv = await parseImportFile(
  new File(["Data,Kwota,Opis\n2026-05-01,12.34,Test"], "test.csv", {
    type: "text/csv",
  }),
);
assert.deepEqual(parsedCsv.headers, ["Data", "Kwota", "Opis"]);
assert.equal(parsedCsv.rows.length, 1);
assert.equal(
  normalizeImportRow("usr_test", parsedCsv.rows[0]!, {
    dateColumn: "Data",
    amountColumn: "Kwota",
    descriptionColumn: "Opis",
    categoryId: "cat_test",
    defaultType: "expense",
  }).amountMinor,
  1234,
);

const mbankCsv = await parseImportFile(
  new File(
    ["Data operacji,Kwota,Opis operacji,Lokalizacja\n2026-05-01,-12.34,Zakupy,Biedronka"],
    "historia.csv",
    { type: "text/csv" },
  ),
);
const mbankDetected = detectBankImportMapping(mbankCsv.headers);
assert.equal(mbankDetected?.id, "mbank_csv");
assert.equal(mbankDetected?.mapping.dateColumn, "Data operacji");
assert.equal(mbankDetected?.mapping.amountColumn, "Kwota");
assert.equal(mbankDetected?.mapping.descriptionColumn, "Opis operacji");
assert.equal(mbankDetected?.mapping.merchantColumn, "Lokalizacja");

const revolutCsv = await parseImportFile(
  new File(
    [
      "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\n" +
        "Card Payment,Current,2026-04-30,2026-05-01,Coffee,-5.00,0.00,PLN,COMPLETED,100.00",
    ],
    "account-statement.csv",
    { type: "text/csv" },
  ),
);
const revolutDetected = detectBankImportMapping(revolutCsv.headers);
assert.equal(revolutDetected?.id, "revolut_csv");
assert.equal(revolutDetected?.mapping.dateColumn, "Completed Date");
assert.equal(revolutDetected?.mapping.amountColumn, "Amount");

const pkoCsv = await parseImportFile(
  new File(
    ["Data operacji,Kwota,Opis,Nadawca\n2026-05-01,-50.00,Zakupy,Sklep"],
    "historia_pko.csv",
    { type: "text/csv" },
  ),
);
const pkoDetected = detectBankImportMapping(pkoCsv.headers);
assert.equal(pkoDetected?.id, "pko_csv");
assert.equal(pkoDetected?.mapping.descriptionColumn, "Opis");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const zenSamplePath = join(scriptDir, "../../file_sample/Wyciąg z konta PLN.csv");
const zenBuffer = readFileSync(zenSamplePath);
const zenFile = new File([zenBuffer], "Wyciąg z konta PLN.csv", { type: "text/csv" });
const zenParsed = await parseImportFile(zenFile);
const zenDetected = detectBankImportMapping(zenParsed.headers);

assert.equal(zenDetected?.id, "zen_csv");
assert.equal(zenDetected?.mapping.dateColumn, "Date");
assert.equal(zenDetected?.mapping.amountColumn, "Settlement amount");
assert.equal(zenParsed.rows.length, 66);

const zenExpense = normalizeImportRow("usr_test", zenParsed.rows[0]!, {
  dateColumn: "Date",
  amountColumn: "Settlement amount",
  descriptionColumn: "Description",
  categoryId: "cat_test",
  defaultType: "expense",
});
assert.equal(zenExpense.transactionDate, "2026-04-01");
assert.equal(zenExpense.type, "expense");
assert.equal(zenExpense.amountMinor, 1890);

const zenIncomeRow = zenParsed.rows.find((row) => row.Description?.includes("top-up"));
assert.ok(zenIncomeRow);
const zenIncome = normalizeImportRow("usr_test", zenIncomeRow!, {
  dateColumn: "Date",
  amountColumn: "Settlement amount",
  descriptionColumn: "Description",
  categoryId: "cat_test",
  defaultType: "expense",
});
assert.equal(zenIncome.type, "income");

const aiJson = extractJsonObjectFromModelText(
  "```json\n{\"categoryId\":\"cat_1\",\"confidence\":0.9,\"needsManualReview\":false}\n```",
);
const aiParsed = aiCategorizationResponseSchema.parse(aiJson);
assert.equal(aiParsed.categoryId, "cat_1");
assert.equal(aiParsed.confidence, 0.9);

assert.equal(toStooqSymbol("AAPL", "USD"), "aapl.us");
assert.equal(toStooqSymbol("PKO", "PLN"), "pko.pl");
assert.equal(convertQuoteMinorToPlnMinor(10_000, "USD", 4), 40_000);
assert.equal(positionMarketValuePlnMinor(5, 40_000), 200_000);

const alloc = computeAllocationSuggestion(100000, {
  cushionPlnMinor: 40000,
  allocations: [
    { label: "A", percent: 60 },
    { label: "B", percent: 40 },
  ],
});
assert.equal(alloc.length, 2);
assert.equal(alloc[0]!.amountMinor, 36000);
assert.equal(alloc[1]!.amountMinor, 24000);

const importTestDirectory = mkdtempSync(join(tmpdir(), "cfo-import-test-"));
process.env.DATABASE_URL = join(importTestDirectory, "app.db");
let importTestRawDb: (typeof import("../db/client"))["rawDb"] | undefined;

try {
  const { rawDb } = await import("../db/client");
  importTestRawDb = rawDb;
  const { createImportPreview, confirmImportForUser, getImportPreviewForUser } =
    await import("../db/imports");
  const { createCorrectionMemoryRule, findCorrectionMemoryCategoryId } =
    await import("../db/correction-memory");
  const {
    claimTransactionForCategorization,
    createManualTransaction,
    resetStaleCategorizationClaimsForUser,
  } = await import("../db/transactions");
  const { insertAiSuggestion } = await import("../db/ai-suggestions");
  const { migrateLegacyDedupeKeys } = await import("../db/dedupe-migration");
  const { hashIpForTests, isLoginRateLimitEnabled } = await import("../lib/login-rate-limit");

  applyMigrations(rawDb);

  assert.equal(isLoginRateLimitEnabled(), process.env.LOGIN_RATE_LIMIT_DISABLED !== "1");
  assert.equal(hashIpForTests("203.0.113.1").length, 32);

  const now = "2026-09-05T00:00:00.000Z";
  rawDb
    .prepare(
      "INSERT INTO users (id, login, display_name, password_hash, base_currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run("usr_import_test", "import-test", "Import Test", "hash", "PLN", now, now);
  rawDb
    .prepare(
      "INSERT INTO categories (id, user_id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run("cat_import_test", "usr_import_test", "Jedzenie", "expense", now, now);
  rawDb
    .prepare(
      "INSERT INTO financial_accounts (id, user_id, name, institution, type, currency, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      "acc_import_test",
      "usr_import_test",
      "Konto testowe",
      "Test Bank",
      "bank",
      "PLN",
      1,
      now,
      now,
    );
  rawDb
    .prepare(
      "INSERT INTO financial_accounts (id, user_id, name, institution, type, currency, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      "acc_other_test",
      "usr_import_test",
      "Drugie konto",
      "Test Bank",
      "bank",
      "PLN",
      1,
      now,
      now,
    );

  createCorrectionMemoryRule({
    userId: "usr_import_test",
    patternType: "merchant",
    patternValue: "Sklep testowy",
    categoryId: "cat_import_test",
  });
  assert.equal(
    findCorrectionMemoryCategoryId({
      userId: "usr_import_test",
      merchantName: "Sklep testowy",
      description: "Nieistotny opis",
      rawDescription: null,
    }),
    "cat_import_test",
  );

  const normalized = normalizeImportRow(
    "usr_import_test",
    { Data: "2026-09-01", Kwota: "-12.34", Opis: "Sklep testowy" },
    {
      dateColumn: "Data",
      amountColumn: "Kwota",
      descriptionColumn: "Opis",
      categoryId: "cat_import_test",
      defaultType: "expense",
    },
    { financialAccountId: "acc_import_test" },
  );
const normalizedForOtherAccount = normalizeImportRow(
    "usr_import_test",
    { Data: "2026-09-01", Kwota: "-12.34", Opis: "Sklep testowy" },
    {
      dateColumn: "Data",
      amountColumn: "Kwota",
      descriptionColumn: "Opis",
      categoryId: "cat_import_test",
      defaultType: "expense",
    },
    { financialAccountId: "acc_other_test" },
);
assert.notEqual(normalized.dedupeKey, normalizedForOtherAccount.dedupeKey);
const normalizedForeignCurrency = normalizeImportRow(
  "usr_import_test",
  {
    Data: "2026-09-01",
    Ksiegowanie: "2026-09-02",
    Kwota: "10.00 USD",
    Waluta: "USD",
    Kurs: "4,00",
    Referencja: "bank-ref-1",
    Opis: "Platnosc walutowa",
  },
  {
    dateColumn: "Data",
    postedDateColumn: "Ksiegowanie",
    amountColumn: "Kwota",
    currencyColumn: "Waluta",
    fxRateColumn: "Kurs",
    bankReferenceColumn: "Referencja",
    descriptionColumn: "Opis",
    categoryId: "cat_import_test",
    defaultType: "expense",
  },
  { financialAccountId: "acc_import_test" },
);
assert.equal(normalizedForeignCurrency.postedDate, "2026-09-02");
assert.equal(normalizedForeignCurrency.currency, "USD");
assert.equal(normalizedForeignCurrency.amountMinor, 1000);
assert.equal(normalizedForeignCurrency.amountPlnMinor, 4000);
assert.equal(normalizedForeignCurrency.fxRate, "4.00");
assert.equal(normalizedForeignCurrency.bankReference, "bank-ref-1");
assert.match(normalizedForeignCurrency.dedupeKey, /^v2:[a-f0-9]{64}$/);
assert.throws(
  () =>
    normalizeImportRow(
      "usr_import_test",
      { Data: "2026-09-01", Kwota: "10.00", Waluta: "USD", Opis: "Bez kursu" },
      {
        dateColumn: "Data",
        amountColumn: "Kwota",
        currencyColumn: "Waluta",
        descriptionColumn: "Opis",
        categoryId: "cat_import_test",
        defaultType: "expense",
      },
    ),
  /podaj kolumne kursu/,
);
const batchId = createImportPreview({
    userId: "usr_import_test",
    fileName: "test.csv",
    fileType: "csv",
    fileHash: "test-hash",
    sourceInstitution: "test",
    financialAccountId: "acc_import_test",
    mapping: {
      dateColumn: "Data",
      amountColumn: "Kwota",
      descriptionColumn: "Opis",
      categoryId: "cat_import_test",
      defaultType: "expense",
    },
    rows: [
      {
        rowNumber: 2,
        raw: { Data: "2026-09-01", Kwota: "-12.34", Opis: "Sklep testowy" },
        normalized,
      },
      {
        rowNumber: 3,
        raw: { Data: "2026-09-01", Kwota: "-12.34", Opis: "Sklep testowy" },
        normalized,
      },
      {
        rowNumber: 4,
        raw: { Data: "nie-data", Kwota: "", Opis: "" },
        error: "Nieprawidlowy wiersz.",
      },
    ],
  });

  const beforeConfirm = getImportPreviewForUser("usr_import_test", batchId);
  assert.equal(beforeConfirm?.rows[0]?.rawDataJson, "{}");
  assert.equal(beforeConfirm?.rows.length, 3);
  assert.equal(
    getImportPreviewForUser("usr_import_test", batchId, { rowLimit: 1 })?.rows.length,
    1,
  );
  const previewAuditMeta = JSON.parse(
    (rawDb
      .prepare("SELECT meta_json AS metaJson FROM audit_events WHERE action = 'import_preview_created'")
      .get() as { metaJson: string }).metaJson,
  ) as Record<string, unknown>;
  assert.equal(previewAuditMeta.rowsTotal, 3);
  assert.equal("description" in previewAuditMeta, false);

  assert.deepEqual(confirmImportForUser("usr_import_test", batchId), {
    imported: 1,
    skippedDuplicate: 1,
    failed: 1,
  });
  const completionAuditMeta = JSON.parse(
    (rawDb
      .prepare("SELECT meta_json AS metaJson FROM audit_events WHERE action = 'import_completed'")
      .get() as { metaJson: string }).metaJson,
  ) as Record<string, unknown>;
  assert.equal(typeof completionAuditMeta.persistDurationMs, "number");
  assert.equal(
    (rawDb.prepare("SELECT count(*) AS total FROM transactions").get() as { total: number }).total,
    1,
  );
  const persistedTransaction = rawDb
    .prepare(
      "SELECT id, financial_account_id AS financialAccountId, categorization_status AS categorizationStatus FROM transactions",
    )
    .get() as { id: string; financialAccountId: string | null; categorizationStatus: string };
  assert.equal(persistedTransaction.financialAccountId, "acc_import_test");
  assert.equal(persistedTransaction.categorizationStatus, "pending");
  assert.equal(
    claimTransactionForCategorization("usr_import_test", persistedTransaction.id),
    true,
  );
  rawDb
    .prepare("UPDATE transactions SET categorization_started_at = ? WHERE id = ?")
    .run("2000-01-01T00:00:00.000Z", persistedTransaction.id);
  assert.equal(
    resetStaleCategorizationClaimsForUser("usr_import_test", "2000-01-02T00:00:00.000Z"),
    1,
  );
  insertAiSuggestion({
    userId: "usr_import_test",
    transactionId: persistedTransaction.id,
    provider: "test",
    model: "first",
    suggestedCategoryId: "cat_import_test",
    suggestedDescription: null,
    suggestedTagsJson: null,
    confidence: 0.7,
    reasonCode: null,
    needsManualReview: true,
  });
  insertAiSuggestion({
    userId: "usr_import_test",
    transactionId: persistedTransaction.id,
    provider: "test",
    model: "second",
    suggestedCategoryId: "cat_import_test",
    suggestedDescription: null,
    suggestedTagsJson: null,
    confidence: 0.9,
    reasonCode: null,
    needsManualReview: false,
  });
  const suggestionSummary = rawDb
    .prepare("SELECT count(*) AS total, max(model) AS model FROM ai_suggestions")
    .get() as { total: number; model: string };
  assert.equal(suggestionSummary.total, 1);
  assert.equal(suggestionSummary.model, "second");
  createManualTransaction({
    userId: "usr_import_test",
    type: "expense",
    transactionDate: "2026-09-02",
    amountMinor: 500,
    categoryId: "cat_import_test",
    financialAccountId: "acc_import_test",
    description: "Wpis reczny",
  });
  const manualTransaction = rawDb
    .prepare(
      "SELECT financial_account_id AS financialAccountId, verification_status AS verificationStatus, categorization_status AS categorizationStatus FROM transactions WHERE source = 'manual'",
    )
    .get() as {
    financialAccountId: string | null;
    verificationStatus: string;
    categorizationStatus: string;
  };
  assert.equal(manualTransaction.financialAccountId, "acc_import_test");
  assert.equal(manualTransaction.verificationStatus, "verified");
  assert.equal(manualTransaction.categorizationStatus, "done");

  const foreignBatchId = createImportPreview({
    userId: "usr_import_test",
    fileName: "foreign.csv",
    fileType: "csv",
    fileHash: "foreign-hash",
    sourceInstitution: "test",
    financialAccountId: "acc_import_test",
    mapping: {
      dateColumn: "Data",
      postedDateColumn: "Ksiegowanie",
      amountColumn: "Kwota",
      currencyColumn: "Waluta",
      fxRateColumn: "Kurs",
      bankReferenceColumn: "Referencja",
      descriptionColumn: "Opis",
      categoryId: "cat_import_test",
      defaultType: "expense",
    },
    rows: [{ rowNumber: 2, raw: {}, normalized: normalizedForeignCurrency }],
  });
  assert.deepEqual(confirmImportForUser("usr_import_test", foreignBatchId), {
    imported: 1,
    skippedDuplicate: 0,
    failed: 0,
  });
  const persistedForeignTransaction = rawDb
    .prepare(
      "SELECT posted_date AS postedDate, amount_minor AS amountMinor, amount_pln_minor AS amountPlnMinor, currency, fx_rate AS fxRate, bank_reference AS bankReference FROM transactions WHERE bank_reference = ?",
    )
    .get("bank-ref-1") as {
    postedDate: string | null;
    amountMinor: number;
    amountPlnMinor: number;
    currency: string;
    fxRate: string | null;
    bankReference: string | null;
  };
  assert.equal(persistedForeignTransaction.postedDate, "2026-09-02");
  assert.equal(persistedForeignTransaction.amountMinor, 1000);
  assert.equal(persistedForeignTransaction.amountPlnMinor, 4000);
  assert.equal(persistedForeignTransaction.currency, "USD");
  assert.equal(persistedForeignTransaction.fxRate, "4.00");
  assert.equal(persistedForeignTransaction.bankReference, "bank-ref-1");

  rawDb
    .prepare(
      "INSERT INTO transactions (id, user_id, category_id, type, transaction_date, amount_minor, currency, amount_pln_minor, description, verification_status, source, dedupe_key, is_recurring, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      "txn_legacy_dedupe",
      "usr_import_test",
      "cat_import_test",
      "expense",
      "2026-08-31",
      777,
      "PLN",
      777,
      "Legacy row",
      "verified",
      "import",
      "usr_import_test|2026-08-31|777|legacy row",
      0,
      now,
      now,
    );
  assert.deepEqual(migrateLegacyDedupeKeys(), { migrated: 1 });
  const migratedLegacyKey = rawDb
    .prepare("SELECT dedupe_key AS dedupeKey FROM transactions WHERE id = 'txn_legacy_dedupe'")
    .get() as { dedupeKey: string };
  assert.match(migratedLegacyKey.dedupeKey, /^v2:[a-f0-9]{64}$/);
  assert.deepEqual(migrateLegacyDedupeKeys(), { migrated: 0 });

  const afterConfirm = getImportPreviewForUser("usr_import_test", batchId);
  assert.equal(afterConfirm?.rows.length, 1);
  assert.equal(afterConfirm?.rows[0]?.status, "failed");
  assert.throws(
    () => confirmImportForUser("usr_import_test", batchId),
    /zostal juz zapisany/,
  );

  const backupSourcePath = join(importTestDirectory, "backup-source.db");
  const backupOutputPath = join(importTestDirectory, "backup.cfo-backup.json");
  const backupSource = new Database(backupSourcePath);
  backupSource.exec("CREATE TABLE marker (value TEXT NOT NULL); INSERT INTO marker (value) VALUES ('before-restore');");
  backupSource.close();
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousBackupKey = process.env.BACKUP_ENCRYPTION_KEY;
  process.env.DATABASE_URL = backupSourcePath;
  process.env.BACKUP_ENCRYPTION_KEY = "foundation-backup-test-key";

  try {
    const {
      createEncryptedBackup,
      restoreEncryptedBackup,
      verifyEncryptedBackup,
    } = await import("../ops/encrypted-backup");
    const backupPath = await createEncryptedBackup(backupOutputPath);
    await verifyEncryptedBackup(backupPath);
    const changedSource = new Database(backupSourcePath);
    changedSource.prepare("UPDATE marker SET value = ?").run("after-backup");
    changedSource.close();
    assert.equal(await restoreEncryptedBackup(backupPath), backupSourcePath);
    const restoredSource = new Database(backupSourcePath, { readonly: true });
    const marker = restoredSource.prepare("SELECT value FROM marker").get() as { value: string };
    restoredSource.close();
    assert.equal(marker.value, "before-restore");
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (previousBackupKey === undefined) {
      delete process.env.BACKUP_ENCRYPTION_KEY;
    } else {
      process.env.BACKUP_ENCRYPTION_KEY = previousBackupKey;
    }
  }
} finally {
  importTestRawDb?.close();
  rmSync(importTestDirectory, { recursive: true, force: true });
}

console.log("Foundation verification passed");
