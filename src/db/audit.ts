import { desc, eq, isNull, or } from "drizzle-orm";
import { db } from "./client";
import { auditEvents } from "./schema";
import { createId } from "../lib/ids";
import { nowIso } from "../lib/time";

export type AuditAction =
  | "login_success"
  | "login_failure"
  | "logout"
  | "import_completed"
  | "backup_created"
  | "backup_restored";

export function recordAuditEvent(input: {
  userId: string | null;
  action: AuditAction | string;
  meta?: Record<string, string | number | boolean | null>;
}) {
  const metaJson =
    input.meta && Object.keys(input.meta).length > 0 ? JSON.stringify(input.meta) : null;

  db.insert(auditEvents)
    .values({
      id: createId("aud"),
      userId: input.userId,
      action: input.action,
      metaJson,
      createdAt: nowIso(),
    })
    .run();
}

export type AuditEventListItem = {
  id: string;
  action: string;
  metaJson: string | null;
  createdAt: string;
  actorUserId: string | null;
};

export function listAuditEventsVisibleToUser(userId: string, limit = 200): AuditEventListItem[] {
  return db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      metaJson: auditEvents.metaJson,
      createdAt: auditEvents.createdAt,
      actorUserId: auditEvents.userId,
    })
    .from(auditEvents)
    .where(or(isNull(auditEvents.userId), eq(auditEvents.userId, userId)))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(limit)
    .all();
}
