import assert from "node:assert/strict";
import { aiCategorizationResponseSchema, extractJsonObjectFromModelText } from "../domain/ai-categorization";
import { countCategoryTemplateItems } from "../domain/category-template";
import { computeAllocationSuggestion } from "../domain/investments";
import { normalizeImportRow } from "../domain/imports";
import { parseAmountToMinor } from "../domain/transactions";
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

const aiJson = extractJsonObjectFromModelText(
  "```json\n{\"categoryId\":\"cat_1\",\"confidence\":0.9,\"needsManualReview\":false}\n```",
);
const aiParsed = aiCategorizationResponseSchema.parse(aiJson);
assert.equal(aiParsed.categoryId, "cat_1");
assert.equal(aiParsed.confidence, 0.9);

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
