import path from "node:path";
import {
  createEncryptedBackup,
  restoreEncryptedBackup,
  verifyEncryptedBackup,
} from "../ops/encrypted-backup";
import { recordAuditEvent } from "../db/audit";

function usage() {
  console.log(`Usage:
  npm run backup:create -- [output-path]
  npm run backup:verify -- <backup-path>
  npm run backup:restore -- <backup-path>`);
}

const [command, filePath] = process.argv.slice(2);

try {
  if (command === "create") {
    const outputPath = await createEncryptedBackup(filePath);
    recordAuditEvent({
      userId: null,
      action: "backup_created",
      meta: { fileName: path.basename(outputPath), source: "cli" },
    });
    console.log(`Encrypted backup created: ${outputPath}`);
  } else if (command === "verify") {
    if (!filePath) {
      usage();
      process.exitCode = 1;
    } else {
      const metadata = await verifyEncryptedBackup(filePath);
      console.log(
        `Backup verified: ${metadata.createdAt}, app version ${metadata.appVersion}`,
      );
    }
  } else if (command === "restore") {
    if (!filePath) {
      usage();
      process.exitCode = 1;
    } else {
      const databasePath = await restoreEncryptedBackup(filePath);
      recordAuditEvent({
        userId: null,
        action: "backup_restored",
        meta: { fileName: path.basename(filePath) },
      });
      console.log(`Database restored to: ${databasePath}`);
    }
  } else {
    usage();
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown backup error.";

  console.error(message);
  process.exitCode = 1;
}
