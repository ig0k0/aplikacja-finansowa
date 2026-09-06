# Graph Report - projekt-aplikacjarozwojowa  (2026-09-06)

## Corpus Check
- 123 files · ~53,266 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 407 nodes · 909 edges · 16 communities detected
- Extraction: 75% EXTRACTED · 25% INFERRED · 0% AMBIGUOUS · INFERRED: 226 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]

## God Nodes (most connected - your core abstractions)
1. `nowIso()` - 53 edges
2. `requireUser()` - 44 edges
3. `createId()` - 30 edges
4. `recordAuditEvent()` - 23 edges
5. `categorizeTransactionForUser()` - 18 edges
6. `getCurrentUser()` - 14 edges
7. `currentMonthInputValue()` - 14 edges
8. `parseAmountToMinor()` - 13 edges
9. `formatCurrencyMinor()` - 12 edges
10. `normalizeImportRow()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `loginAction()` --calls--> `findUserByLogin()`  [INFERRED]
  src/app/login/actions.ts → src/db/users.ts
- `deleteInvestmentAssetAction()` --calls--> `deleteInvestmentAssetForUser()`  [INFERRED]
  src/app/investments/actions.ts → src/db/investments.ts
- `HomePage()` --calls--> `getCurrentUser()`  [INFERRED]
  src/app/page.tsx → src/lib/session.ts
- `normalizeMonth()` --calls--> `currentMonthInputValue()`  [INFERRED]
  src/app/insights/page.tsx → src/domain/budgets.ts
- `GET()` --calls--> `getCurrentUser()`  [INFERRED]
  src/app/insights/export/route.ts → src/lib/session.ts

## Communities (26 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (41): categorizeTransactionForUser(), categoriesForPromptByType(), completeChatText(), insertAiSuggestion(), supersedePendingSuggestionsForTransaction(), recordAuditEvent(), ensureExpenseCategoryForUser(), upsertBudgetLimit() (+33 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (31): ExpenseBarChart(), addCalendarMonths(), compareExpenseCategoriesMonthOverMonth(), encodeInsightsCategoryId(), expenseGroupingKey(), forecastMonthEndExpenses(), getPreviousMonthLabel(), listCategoryExpenseTransactionsForMonth() (+23 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (26): archiveFinancialAccountAction(), createFinancialAccountAction(), redirectWithError(), toFinancialAccountTypeLabel(), buildStrategyRulesFromForm(), computeAllocationSuggestion(), parseOptionalPercent(), parseQuantityDelta() (+18 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (22): applyMigrations(), countCategoryTemplateItems(), assertImportRowLimit(), fileExtension(), isOcrImageFile(), validateImportFileSize(), findImportMappingPreset(), createDedupeKey() (+14 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (18): HomePage(), logoutAction(), getClientIpHash(), hashIp(), shouldUseSecureSessionCookies(), useSecureSessionCookies(), assertLoginAllowed(), clearLoginFailures() (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (11): getDatabasePath(), createEncryptedBackup(), decrypt(), deriveKey(), encrypt(), readAndDecryptBackup(), requireBackupKey(), restoreEncryptedBackup() (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (19): cleanupExpiredTotpLoginPending(), createLoginTotpPending(), deleteTotpLoginPending(), findValidTotpLoginPending(), clearTotpPendingSecret(), disableUserTotp(), finalizeTotpEnrollment(), findUserById() (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (16): normalizeHeader(), asArray(), neutralExtractedTextToMatrix(), parseImportFile(), parsePdf(), parseReceiptImage(), parseXlsx(), pdfTableLinesToMatrix() (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (15): ensureFxRatesForPricing(), resolvePlnPerUnit(), upsertFxRates(), parseQuoteCurrency(), refreshInvestmentPricesForUser(), convertQuoteMinorToPlnMinor(), isAutoPriceAssetType(), positionMarketValuePlnMinor() (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (11): getLatestAiSuggestionsForTransactions(), bulkAcceptAiSuggestionsForUser(), countBulkAcceptEligibleForUser(), listTransactionsForUser(), resetStaleCategorizationClaimsForUser(), getAiRuntimeConfig(), parseMode(), acceptAiSuggestionsBulkAction() (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.32
Nodes (10): detectBankImportMapping(), findHeader(), matchMbankCsv(), normalizeHeader(), matchPkoCsv(), matchRevolutCsv(), buildParserMatch(), findHeader() (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.24
Nodes (10): createCorrectionMemoryAction(), deleteCorrectionMemoryAction(), redirectWithError(), updateCorrectionMemoryAction(), createCorrectionMemoryRule(), deleteCorrectionMemoryForUser(), ensureCategoryForUser(), updateCorrectionMemoryCategoryForUser() (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.24
Nodes (4): clampNonNegative(), deleteInvestmentAssetForUser(), getInvestmentAssetForUser(), insertInvestmentOperation()

## Knowledge Gaps
- **2 isolated node(s):** `PdfPrinter`, `URLResolver`
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireUser()` connect `Community 2` to `Community 1`, `Community 3`, `Community 4`, `Community 6`, `Community 9`, `Community 11`?**
  _High betweenness centrality (0.279) - this node is a cross-community bridge._
- **Why does `nowIso()` connect `Community 0` to `Community 4`, `Community 6`, `Community 8`, `Community 9`, `Community 11`, `Community 12`?**
  _High betweenness centrality (0.229) - this node is a cross-community bridge._
- **Why does `createImportPreviewAction()` connect `Community 3` to `Community 0`, `Community 2`, `Community 10`, `Community 7`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Are the 35 inferred relationships involving `nowIso()` (e.g. with `createSession()` and `getCurrentUser()`) actually correct?**
  _`nowIso()` has 35 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `requireUser()` (e.g. with `createCorrectionMemoryAction()` and `updateCorrectionMemoryAction()`) actually correct?**
  _`requireUser()` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `createId()` (e.g. with `createSession()` and `recordLoginFailure()`) actually correct?**
  _`createId()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `recordAuditEvent()` (e.g. with `startTotpEnrollmentAction()` and `cancelTotpEnrollmentAction()`) actually correct?**
  _`recordAuditEvent()` has 13 INFERRED edges - model-reasoned connections that need verification._