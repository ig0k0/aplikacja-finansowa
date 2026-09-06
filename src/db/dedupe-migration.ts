import { eq, isNotNull } from "drizzle-orm";
import { createVersionedImportDedupeKey } from "../domain/imports";
import { nowIso } from "../lib/time";
import { recordAuditEvent } from "./audit";
import { db } from "./client";
import { transactions } from "./schema";

export function migrateLegacyDedupeKeys() {
  const rows = db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      financialAccountId: transactions.financialAccountId,
      transactionDate: transactions.transactionDate,
      postedDate: transactions.postedDate,
      amountMinor: transactions.amountMinor,
      currency: transactions.currency,
      bankReference: transactions.bankReference,
      description: transactions.description,
      dedupeKey: transactions.dedupeKey,
    })
    .from(transactions)
    .where(isNotNull(transactions.dedupeKey))
    .all()
    .filter(
      (row): row is typeof row & { dedupeKey: string } =>
        row.dedupeKey !== null && !row.dedupeKey.startsWith("v2:"),
    );

  if (rows.length === 0) {
    return { migrated: 0 };
  }

  const proposals = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    dedupeKey: createVersionedImportDedupeKey({
      userId: row.userId,
      financialAccountId: row.financialAccountId,
      date: row.transactionDate,
      postedDate: row.postedDate,
      amountMinor: row.amountMinor,
      currency: row.currency,
      bankReference: row.bankReference,
      description: row.description ?? "",
    }),
  }));
  const seen = new Set<string>();

  for (const proposal of proposals) {
    const compoundKey = `${proposal.userId}|${proposal.dedupeKey}`;

    if (seen.has(compoundKey)) {
      throw new Error("Migracja kluczy deduplikacji wykryla konflikt kanonicznych rekordow.");
    }

    seen.add(compoundKey);
  }

  db.transaction(() => {
    const updatedAt = nowIso();

    for (const proposal of proposals) {
      db.update(transactions)
        .set({ dedupeKey: proposal.dedupeKey, updatedAt })
        .where(eq(transactions.id, proposal.id))
        .run();
    }
  });

  recordAuditEvent({
    userId: null,
    action: "dedupe_keys_migrated",
    meta: { migrated: proposals.length },
  });

  return { migrated: proposals.length };
}
