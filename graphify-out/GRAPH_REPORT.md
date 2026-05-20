# Graph Report - projekt-aplikacjarozwojowa  (2026-05-20)

## Corpus Check
- 101 files · ~40,768 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 344 nodes · 752 edges · 14 communities detected
- Extraction: 76% EXTRACTED · 24% INFERRED · 0% AMBIGUOUS · INFERRED: 182 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]

## God Nodes (most connected - your core abstractions)
1. `nowIso()` - 43 edges
2. `requireUser()` - 39 edges
3. `createId()` - 26 edges
4. `recordAuditEvent()` - 19 edges
5. `categorizeTransactionForUser()` - 16 edges
6. `getCurrentUser()` - 14 edges
7. `currentMonthInputValue()` - 13 edges
8. `parseAmountToMinor()` - 13 edges
9. `findHeader()` - 11 edges
10. `buildInsightsPdfBuffer()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `deleteInvestmentAssetAction()` --calls--> `deleteInvestmentAssetForUser()`  [INFERRED]
  src/app/investments/actions.ts → src/db/investments.ts
- `HomePage()` --calls--> `getCurrentUser()`  [INFERRED]
  src/app/page.tsx → src/lib/session.ts
- `normalizeMonth()` --calls--> `currentMonthInputValue()`  [INFERRED]
  src/app/insights/page.tsx → src/domain/budgets.ts
- `GET()` --calls--> `getCurrentUser()`  [INFERRED]
  src/app/insights/export/route.ts → src/lib/session.ts
- `GET()` --calls--> `getCurrentUser()`  [INFERRED]
  src/app/insights/export/pdf/route.ts → src/lib/session.ts

## Communities (22 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (26): ensureExpenseCategoryForUser(), upsertBudgetLimit(), upsertCorrectionMemory(), confirmImportForUser(), createImportPreview(), ensureCategoryForUser(), getImportPreviewForUser(), clampNonNegative() (+18 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (27): findImportMappingPreset(), buildStrategyRulesFromForm(), computeAllocationSuggestion(), parseOptionalPercent(), parseQuantityDelta(), toAssetTypeLabel(), toOperationTypeLabel(), parseAmountToMinor() (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (25): addCalendarMonths(), compareExpenseCategoriesMonthOverMonth(), expenseGroupingKey(), forecastMonthEndExpenses(), getPreviousMonthLabel(), listHeuristicRecurringCandidates(), lookbackInclusiveEndMonth(), passesAmountStability() (+17 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (23): ensureFxRatesForPricing(), resolvePlnPerUnit(), upsertFxRates(), parseQuoteCurrency(), refreshInvestmentPricesForUser(), countCategoryTemplateItems(), createDedupeKey(), inferTransactionType() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (17): HomePage(), logoutAction(), findUserByLogin(), getClientIpHash(), hashIp(), useSecureSessionCookies(), assertLoginAllowed(), clearLoginFailures() (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (16): categorizeTransactionForUser(), categoriesForPromptByType(), completeChatText(), insertAiSuggestion(), supersedePendingSuggestionsForTransaction(), listCategoriesForUser(), findCorrectionMemoryCategoryId(), getTransactionForUser() (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (12): applyMigrations(), getDatabasePath(), createEncryptedBackup(), decrypt(), deriveKey(), encrypt(), readAndDecryptBackup(), requireBackupKey() (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (16): normalizeHeader(), asArray(), neutralExtractedTextToMatrix(), parseImportFile(), parsePdf(), parseReceiptImage(), parseXlsx(), pdfTableLinesToMatrix() (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.24
Nodes (16): recordAuditEvent(), deleteTotpLoginPending(), clearTotpPendingSecret(), disableUserTotp(), finalizeTotpEnrollment(), findUserById(), updateUserTotpPendingSecret(), buildTotpKeyUri() (+8 more)

### Community 9 - "Community 9"
Cohesion: 0.32
Nodes (10): detectBankImportMapping(), findHeader(), matchMbankCsv(), normalizeHeader(), matchPkoCsv(), matchRevolutCsv(), buildParserMatch(), findHeader() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.24
Nodes (10): createCorrectionMemoryAction(), deleteCorrectionMemoryAction(), redirectWithError(), updateCorrectionMemoryAction(), createCorrectionMemoryRule(), deleteCorrectionMemoryForUser(), ensureCategoryForUser(), updateCorrectionMemoryCategoryForUser() (+2 more)

## Knowledge Gaps
- **2 isolated node(s):** `PdfPrinter`, `URLResolver`
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireUser()` connect `Community 1` to `Community 2`, `Community 4`, `Community 5`, `Community 8`, `Community 10`?**
  _High betweenness centrality (0.301) - this node is a cross-community bridge._
- **Why does `nowIso()` connect `Community 0` to `Community 3`, `Community 4`, `Community 5`, `Community 8`, `Community 10`?**
  _High betweenness centrality (0.249) - this node is a cross-community bridge._
- **Why does `createImportPreviewAction()` connect `Community 1` to `Community 0`, `Community 9`, `Community 7`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Are the 28 inferred relationships involving `nowIso()` (e.g. with `createSession()` and `getCurrentUser()`) actually correct?**
  _`nowIso()` has 28 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `requireUser()` (e.g. with `createCorrectionMemoryAction()` and `updateCorrectionMemoryAction()`) actually correct?**
  _`requireUser()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `createId()` (e.g. with `createSession()` and `recordLoginFailure()`) actually correct?**
  _`createId()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `recordAuditEvent()` (e.g. with `startTotpEnrollmentAction()` and `cancelTotpEnrollmentAction()`) actually correct?**
  _`recordAuditEvent()` has 11 INFERRED edges - model-reasoned connections that need verification._