import fs from "node:fs";
import path from "node:path";
import { createEncryptedBackup } from "../ops/encrypted-backup";
import { recordAuditEvent } from "../db/audit";

const outputPath = await createEncryptedBackup();
const fileName = path.basename(outputPath);

recordAuditEvent({
  userId: null,
  action: "backup_created",
  meta: { fileName, source: "scheduled" },
});

console.log(`Scheduled backup created: ${outputPath}`);

const days = Number(process.env.BACKUP_RETENTION_DAYS ?? "0");

if (Number.isFinite(days) && days > 0) {
  const destination = path.resolve(process.cwd(), process.env.BACKUP_DESTINATION ?? "./backups");
  const cutoff = Date.now() - days * 86400000;

  for (const entry of fs.readdirSync(destination)) {
    if (!entry.endsWith(".cfo-backup.json")) {
      continue;
    }

    const fullPath = path.join(destination, entry);
    const stat = fs.statSync(fullPath);

    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(fullPath);
      console.log(`Removed old backup: ${entry}`);
    }
  }
}
