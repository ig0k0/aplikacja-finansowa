import { relations } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  login: text("login").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  baseCurrency: text("base_currency").notNull().default("PLN"),
  totpSecret: text("totp_secret"),
  totpPendingSecret: text("totp_pending_secret"),
  totpEnabled: integer("totp_enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const loginTotpPending = sqliteTable(
  "login_totp_pending",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    expiresAtIdx: index("login_totp_pending_expires_at_idx").on(table.expiresAt),
  }),
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
    expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
  }),
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    metaJson: text("meta_json"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    userIdIdx: index("audit_events_user_id_idx").on(table.userId),
    createdAtIdx: index("audit_events_created_at_idx").on(table.createdAt),
    actionIdx: index("audit_events_action_idx").on(table.action),
  }),
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnySQLiteColumn => categories.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(true),
    isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    userIdIdx: index("categories_user_id_idx").on(table.userId),
    parentIdIdx: index("categories_parent_id_idx").on(table.parentId),
    uniquePerParent: uniqueIndex("categories_user_parent_name_type_idx").on(
      table.userId,
      table.parentId,
      table.name,
      table.type,
    ),
  }),
);

export const financialAccounts = sqliteTable(
  "financial_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    institution: text("institution").notNull(),
    type: text("type").notNull(),
    currency: text("currency").notNull().default("PLN"),
    externalAccountHint: text("external_account_hint"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    userIdIdx: index("financial_accounts_user_id_idx").on(table.userId),
  }),
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    financialAccountId: text("financial_account_id").references(
      () => financialAccounts.id,
      { onDelete: "set null" },
    ),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    transactionDate: text("transaction_date").notNull(),
    postedDate: text("posted_date"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("PLN"),
    amountPlnMinor: integer("amount_pln_minor").notNull(),
    fxRate: text("fx_rate"),
    merchantName: text("merchant_name"),
    counterpartyName: text("counterparty_name"),
    description: text("description"),
    rawDescription: text("raw_description"),
    tagList: text("tag_list"),
    verificationStatus: text("verification_status").notNull().default("needs_review"),
    source: text("source").notNull().default("manual"),
    dedupeKey: text("dedupe_key"),
    isRecurring: integer("is_recurring", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    userIdIdx: index("transactions_user_id_idx").on(table.userId),
    dateIdx: index("transactions_date_idx").on(table.transactionDate),
    dedupeIdx: uniqueIndex("transactions_user_dedupe_key_idx").on(
      table.userId,
      table.dedupeKey,
    ),
  }),
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    limitPlnMinor: integer("limit_pln_minor").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    userIdIdx: index("budgets_user_id_idx").on(table.userId),
    monthIdx: index("budgets_month_idx").on(table.month),
    uniquePerMonth: uniqueIndex("budgets_user_category_month_idx").on(
      table.userId,
      table.categoryId,
      table.month,
    ),
  }),
);

export const importBatches = sqliteTable(
  "import_batches",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceInstitution: text("source_institution").notNull(),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    fileHash: text("file_hash").notNull(),
    status: text("status").notNull(),
    mappingJson: text("mapping_json").notNull(),
    rowsTotal: integer("rows_total").notNull().default(0),
    rowsImported: integer("rows_imported").notNull().default(0),
    rowsSkippedDuplicate: integer("rows_skipped_duplicate").notNull().default(0),
    rowsFailed: integer("rows_failed").notNull().default(0),
    errorSummary: text("error_summary"),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => ({
    userIdIdx: index("import_batches_user_id_idx").on(table.userId),
    fileHashIdx: index("import_batches_file_hash_idx").on(table.fileHash),
  }),
);

export const userCorrectionMemory = sqliteTable(
  "user_correction_memory",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    patternType: text("pattern_type").notNull(),
    patternValue: text("pattern_value").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    confidenceBoost: real("confidence_boost").notNull().default(0.15),
    lastUsedAt: text("last_used_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    userPatternUnique: uniqueIndex("user_correction_memory_user_pattern_idx").on(
      table.userId,
      table.patternType,
      table.patternValue,
    ),
    userIdIdx: index("user_correction_memory_user_id_idx").on(table.userId),
  }),
);

export const aiSuggestions = sqliteTable(
  "ai_suggestions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    suggestedCategoryId: text("suggested_category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    suggestedDescription: text("suggested_description"),
    suggestedTagsJson: text("suggested_tags_json"),
    confidence: real("confidence").notNull(),
    reasonCode: text("reason_code"),
    needsManualReview: integer("needs_manual_review", { mode: "boolean" }).notNull().default(true),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    userIdIdx: index("ai_suggestions_user_id_idx").on(table.userId),
    transactionIdIdx: index("ai_suggestions_transaction_id_idx").on(table.transactionId),
    statusIdx: index("ai_suggestions_status_idx").on(table.status),
  }),
);

export const importedRows = sqliteTable(
  "imported_rows",
  {
    id: text("id").primaryKey(),
    importBatchId: text("import_batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    rawDataJson: text("raw_data_json").notNull(),
    normalizedDataJson: text("normalized_data_json"),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    transactionId: text("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    batchIdIdx: index("imported_rows_batch_id_idx").on(table.importBatchId),
  }),
);

export const investmentAssets = sqliteTable(
  "investment_assets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ticker: text("ticker"),
    type: text("type").notNull(),
    currency: text("currency").notNull().default("PLN"),
    quantity: real("quantity").notNull().default(0),
    costBasisPlnMinor: integer("cost_basis_pln_minor").notNull().default(0),
    marketValuePlnMinor: integer("market_value_pln_minor").notNull().default(0),
    targetAllocationPercent: real("target_allocation_percent"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    userIdIdx: index("investment_assets_user_id_idx").on(table.userId),
  }),
);

export const investmentOperations = sqliteTable(
  "investment_operations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    investmentAssetId: text("investment_asset_id")
      .notNull()
      .references(() => investmentAssets.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    operationDate: text("operation_date").notNull(),
    quantityDelta: real("quantity_delta").notNull().default(0),
    amountPlnMinor: integer("amount_pln_minor").notNull(),
    feePlnMinor: integer("fee_pln_minor").notNull().default(0),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    userIdIdx: index("investment_operations_user_id_idx").on(table.userId),
    assetIdIdx: index("investment_operations_asset_id_idx").on(table.investmentAssetId),
  }),
);

export const investmentStrategies = sqliteTable(
  "investment_strategies",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    rulesJson: text("rules_json").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    userIdIdx: index("investment_strategies_user_id_idx").on(table.userId),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  categories: many(categories),
  sessions: many(sessions),
  accounts: many(financialAccounts),
  transactions: many(transactions),
  budgets: many(budgets),
  importBatches: many(importBatches),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type ImportedRow = typeof importedRows.$inferSelect;
export type UserCorrectionMemory = typeof userCorrectionMemory.$inferSelect;
export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type InvestmentAsset = typeof investmentAssets.$inferSelect;
export type InvestmentOperation = typeof investmentOperations.$inferSelect;
export type InvestmentStrategy = typeof investmentStrategies.$inferSelect;
