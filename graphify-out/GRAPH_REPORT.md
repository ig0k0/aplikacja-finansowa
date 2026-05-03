# Graph Report - projekt-aplikacjarozwojowa  (2026-05-03)

## Corpus Check
- 77 files · ~35,013 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 258 nodes · 564 edges · 12 communities detected
- Extraction: 76% EXTRACTED · 24% INFERRED · 0% AMBIGUOUS · INFERRED: 136 edges (avg confidence: 0.8)
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

## God Nodes (most connected - your core abstractions)
1. `nowIso()` - 35 edges
2. `requireUser()` - 33 edges
3. `createId()` - 23 edges
4. `recordAuditEvent()` - 18 edges
5. `categorizeTransactionForUser()` - 16 edges
6. `getCurrentUser()` - 14 edges
7. `currentMonthInputValue()` - 13 edges
8. `parseAmountToMinor()` - 13 edges
9. `buildInsightsPdfBuffer()` - 11 edges
10. `formatCurrencyMinor()` - 11 edges

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

## Communities (17 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (22): countCategoryTemplateItems(), buildStrategyRulesFromForm(), computeAllocationSuggestion(), parseOptionalPercent(), parseQuantityDelta(), toAssetTypeLabel(), toOperationTypeLabel(), parseAmountToMinor() (+14 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (24): HomePage(), logoutAction(), recordAuditEvent(), deleteTotpLoginPending(), clearTotpPendingSecret(), disableUserTotp(), finalizeTotpEnrollment(), findUserById() (+16 more)

### Community 2 - "Community 2"
Cohesion: 0.1
Nodes (23): categorizeTransactionForUser(), categoriesForPromptByType(), completeChatText(), insertAiSuggestion(), supersedePendingSuggestionsForTransaction(), listCategoriesForUser(), findCorrectionMemoryCategoryId(), applyAiCategorizationToTransaction() (+15 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (23): addCalendarMonths(), compareExpenseCategoriesMonthOverMonth(), expenseGroupingKey(), forecastMonthEndExpenses(), getPreviousMonthLabel(), listHeuristicRecurringCandidates(), lookbackInclusiveEndMonth(), passesAmountStability() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (15): ensureExpenseCategoryForUser(), upsertBudgetLimit(), upsertCorrectionMemory(), clampNonNegative(), createInvestmentAsset(), deleteInvestmentAssetForUser(), getInvestmentAssetForUser(), insertInvestmentOperation() (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (12): applyMigrations(), getDatabasePath(), createEncryptedBackup(), decrypt(), deriveKey(), encrypt(), readAndDecryptBackup(), requireBackupKey() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.2
Nodes (9): confirmImportForUser(), createImportPreview(), ensureCategoryForUser(), getImportPreviewForUser(), findImportMappingPreset(), confirmImportAction(), createImportPreviewAction(), fileHash() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (10): asArray(), neutralExtractedTextToMatrix(), parseImportFile(), parsePdf(), parseReceiptImage(), parseXlsx(), pdfTableLinesToMatrix(), rowsToObjects() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.6
Nodes (5): createDedupeKey(), normalizeAmount(), normalizeImportRow(), normalizeText(), parseDate()

## Knowledge Gaps
- **2 isolated node(s):** `PdfPrinter`, `URLResolver`
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireUser()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 6`?**
  _High betweenness centrality (0.335) - this node is a cross-community bridge._
- **Why does `nowIso()` connect `Community 4` to `Community 1`, `Community 2`, `Community 6`?**
  _High betweenness centrality (0.224) - this node is a cross-community bridge._
- **Why does `recordAuditEvent()` connect `Community 1` to `Community 4`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `nowIso()` (e.g. with `createSession()` and `getCurrentUser()`) actually correct?**
  _`nowIso()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `requireUser()` (e.g. with `startTotpEnrollmentAction()` and `cancelTotpEnrollmentAction()`) actually correct?**
  _`requireUser()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `createId()` (e.g. with `createSession()` and `insertAiSuggestion()`) actually correct?**
  _`createId()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `recordAuditEvent()` (e.g. with `startTotpEnrollmentAction()` and `cancelTotpEnrollmentAction()`) actually correct?**
  _`recordAuditEvent()` has 10 INFERRED edges - model-reasoned connections that need verification._