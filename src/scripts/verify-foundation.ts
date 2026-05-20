import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { aiCategorizationResponseSchema, extractJsonObjectFromModelText } from "../domain/ai-categorization";
import { countCategoryTemplateItems } from "../domain/category-template";
import { computeAllocationSuggestion } from "../domain/investments";
import { normalizeImportRow } from "../domain/imports";
import { parseAmountToMinor } from "../domain/transactions";
import {
  convertQuoteMinorToPlnMinor,
  positionMarketValuePlnMinor,
  toStooqSymbol,
} from "../domain/pricing";
import { hashIpForTests, isLoginRateLimitEnabled } from "../lib/login-rate-limit";
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
const mbankDetected = detectBankImportMapping(mbankCsv.headers, "historia.csv");
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
const revolutDetected = detectBankImportMapping(revolutCsv.headers, "account-statement.csv");
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
const pkoDetected = detectBankImportMapping(pkoCsv.headers, "historia_pko.csv");
assert.equal(pkoDetected?.id, "pko_csv");
assert.equal(pkoDetected?.mapping.descriptionColumn, "Opis");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const zenSamplePath = join(scriptDir, "../../file_sample/Wyciąg z konta PLN.csv");
const zenBuffer = readFileSync(zenSamplePath);
const zenFile = new File([zenBuffer], "Wyciąg z konta PLN.csv", { type: "text/csv" });
const zenParsed = await parseImportFile(zenFile);
const zenDetected = detectBankImportMapping(zenParsed.headers, zenFile.name);

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

assert.equal(isLoginRateLimitEnabled(), process.env.LOGIN_RATE_LIMIT_DISABLED !== "1");
assert.equal(hashIpForTests("203.0.113.1").length, 32);

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

console.log("Foundation verification passed");
