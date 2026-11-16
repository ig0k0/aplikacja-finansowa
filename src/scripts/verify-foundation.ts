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
import { disambiguateRepeatedImportRows, normalizeImportRow } from "../domain/imports";
import {
  isValidIsoDate,
  manualTransactionSchema,
  parseAmountToMinor,
} from "../domain/transactions";
import {
  convertQuoteMinorToPlnMinor,
  positionMarketValuePlnMinor,
  toStooqSymbol,
} from "../domain/pricing";
import { detectBankImportMapping } from "../imports/bank-parsers";
import { parseImportFile } from "../imports/parse-file";
import { generateSync } from "otplib";
import { resolveClientIp } from "../lib/client-ip";
import {
  hashPassword,
  validateNewPassword,
  verifyPassword,
  verifyPasswordAgainstDummy,
} from "../lib/password";
import { requireBackupEncryptionKey, requireSessionSecret } from "../lib/secrets";
import { checkTotpToken, generateTotpSecret } from "../lib/totp-app";

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

// Wyciag zawiera identyczne platnosci tego samego dnia — kazda musi dostac wlasny klucz,
// inaczej import gubi transakcje jako rzekome duplikaty.
const zenNormalizedRows = disambiguateRepeatedImportRows(
  zenParsed.rows.map((row) => ({
    normalized: normalizeImportRow(
      "usr_test",
      row,
      {
        dateColumn: "Date",
        amountColumn: "Settlement amount",
        descriptionColumn: "Description",
        categoryId: "cat_test",
        defaultType: "expense",
      },
      { financialAccountId: "acc_test" },
    ),
  })),
);
const zenDedupeKeys = zenNormalizedRows.map((row) => row.normalized.dedupeKey);
assert.equal(new Set(zenDedupeKeys).size, 66);
assert.deepEqual(
  disambiguateRepeatedImportRows(zenNormalizedRows).map((row) => row.normalized.dedupeKey),
  zenDedupeKeys,
  "Ponowny import tego samego pliku musi dawac te same klucze.",
);

// --- Walidacja dat i kwot ---
{
  assert.equal(isValidIsoDate("2026-02-28"), true);
  assert.equal(isValidIsoDate("2026-02-30"), false);
  assert.equal(isValidIsoDate("2026-13-45"), false);

  const baseTransaction = {
    type: "expense",
    transactionDate: "2026-11-12",
    amount: "12,34",
    categoryId: "cat_test",
    description: "test",
  };
  assert.equal(manualTransactionSchema.safeParse(baseTransaction).success, true);

  for (const override of [
    { transactionDate: "2026-13-45" },
    { amount: "0" },
    { amount: "0,00" },
    { amount: "99999999999999999999" },
    { amount: "-5" },
  ]) {
    assert.equal(
      manualTransactionSchema.safeParse({ ...baseTransaction, ...override }).success,
      false,
      `Powinno zostac odrzucone: ${JSON.stringify(override)}`,
    );
  }

  const importMapping = {
    dateColumn: "Data",
    amountColumn: "Kwota",
    descriptionColumn: "Opis",
    categoryId: "cat_test",
    defaultType: "expense" as const,
  };
  assert.throws(
    () => normalizeImportRow("usr_test", { Data: "2026-99-99", Kwota: "-1,00", Opis: "x" }, importMapping),
    /Nieprawidlowa data/,
  );
  assert.throws(
    () => normalizeImportRow("usr_test", { Data: "31.02.2026", Kwota: "-1,00", Opis: "x" }, importMapping),
    /Nieprawidlowa data/,
  );
  assert.throws(
    () =>
      normalizeImportRow(
        "usr_test",
        { Data: "2026-01-05", Kwota: "99999999999999999999", Opis: "x" },
        importMapping,
      ),
    /Nieprawidlowa kwota/,
  );
}

// --- Uwierzytelnianie: TOTP, hasla, sekrety, adres klienta ---
{
  const totpSecret = generateTotpSecret();
  const totpCode = generateSync({ secret: totpSecret });
  const firstUse = checkTotpToken(totpSecret, totpCode);
  assert.equal(firstUse.valid, true);
  assert.equal(
    firstUse.valid && checkTotpToken(totpSecret, totpCode, firstUse.timeStep).valid,
    false,
    "Ten sam kod TOTP nie moze zostac uzyty drugi raz.",
  );
  assert.equal(checkTotpToken(totpSecret, "12345").valid, false);
  assert.equal(checkTotpToken(totpSecret, "abcdef").valid, false);

  assert.equal(await verifyPasswordAgainstDummy("cokolwiek"), false);
  assert.equal(await verifyPassword("x", "scrypt:00:"), false);
  assert.notEqual(validateNewPassword("krotkie"), null);
  assert.equal(validateNewPassword("wystarczajaco-dlugie-haslo"), null);

  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    SESSION_SECRET: process.env.SESSION_SECRET,
    BACKUP_ENCRYPTION_KEY: process.env.BACKUP_ENCRYPTION_KEY,
    TRUST_PROXY: process.env.TRUST_PROXY,
    CLIENT_IP_HEADER: process.env.CLIENT_IP_HEADER,
  };
  const env = process.env as Record<string, string | undefined>;

  try {
    env.NODE_ENV = "production";
    env.SESSION_SECRET = "change-me-before-use";
    assert.throws(() => requireSessionSecret(), /zbyt slaby/);
    env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";
    assert.equal(requireSessionSecret().length, 32);
    env.BACKUP_ENCRYPTION_KEY = "change-me-backup-key";
    assert.throws(() => requireBackupEncryptionKey(), /zbyt slaby/);

    const spoofed = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    delete env.TRUST_PROXY;
    assert.equal(resolveClientIp(spoofed), "direct", "Bez TRUST_PROXY naglowki klienta sa ignorowane.");
    env.TRUST_PROXY = "1";
    assert.equal(resolveClientIp(spoofed), "203.0.113.9", "Liczy sie adres dopisany przez proxy.");
    env.CLIENT_IP_HEADER = "cf-connecting-ip";
    assert.equal(
      resolveClientIp(new Headers({ "cf-connecting-ip": "198.51.100.4", "x-forwarded-for": "6.6.6.6" })),
      "198.51.100.4",
    );
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete env[key];
      } else {
        env[key] = value;
      }
    }
  }
}

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
  const {
    clearLoginFailures,
    hashIpForTests,
    isLoginAllowed,
    isLoginRateLimitEnabled,
    recordLoginFailure,
  } = await import("../lib/login-rate-limit");

  applyMigrations(rawDb);

  assert.equal(isLoginRateLimitEnabled(), process.env.LOGIN_RATE_LIMIT_DISABLED !== "1");
  assert.equal(hashIpForTests("203.0.113.1").length, 32);

  if (isLoginRateLimitEnabled()) {
    // Limit na pare login + adres (domyslnie 8).
    for (let attempt = 0; attempt < 8; attempt += 1) {
      assert.equal(isLoginAllowed("Limit-Test", "ip-a"), true);
      recordLoginFailure("limit-test", "ip-a");
    }
    assert.equal(isLoginAllowed("limit-test", "ip-a"), false);
    assert.equal(isLoginAllowed("limit-test", "ip-b"), true);

    // Limit na sam login (domyslnie 20) — zmiana adresu nie daje kolejnych prob.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      recordLoginFailure("limit-test", `ip-rotating-${attempt}`);
    }
    assert.equal(isLoginAllowed("limit-test", "ip-nowy"), false);
    assert.equal(isLoginAllowed("inny-login", "ip-a"), true);
    clearLoginFailures("limit-test");
    assert.equal(isLoginAllowed("limit-test", "ip-a"), true);
  }

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
