import "../lib/load-env";
import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";
import { recordAuditEvent } from "../db/audit";
import { createEncryptedBackup, verifyEncryptedBackup } from "../ops/encrypted-backup";

const execFile = promisify(execFileCallback);

function required(name: "GOOGLE_DRIVE_RCLONE_REMOTE" | "GOOGLE_DRIVE_RCLONE_PATH") {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required. Configure rclone outside the repository first.`);
  }

  return value;
}

function remoteFolder(remote: string, folder: string) {
  const normalizedFolder = folder.replace(/^\/+|\/+$/g, "");

  return `${remote}:${normalizedFolder}`;
}

async function runRclone(args: string[]) {
  try {
    return await execFile("rclone", args, { maxBuffer: 1024 * 1024 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown rclone error";

    throw new Error(`Google Drive upload failed: ${detail}`);
  }
}

function removeExpiredLocalBackups() {
  const days = Number(process.env.BACKUP_RETENTION_DAYS ?? "0");

  if (!Number.isFinite(days) || days <= 0) {
    return;
  }

  const destination = resolve(process.cwd(), process.env.BACKUP_DESTINATION ?? "./backups");
  const cutoff = Date.now() - days * 86400000;

  for (const entry of fs.readdirSync(destination)) {
    if (!entry.endsWith(".cfo-backup.json")) {
      continue;
    }

    const fullPath = resolve(destination, entry);

    if (fs.statSync(fullPath).mtimeMs < cutoff) {
      fs.unlinkSync(fullPath);
    }
  }
}

try {
  const remote = required("GOOGLE_DRIVE_RCLONE_REMOTE");
  const folder = required("GOOGLE_DRIVE_RCLONE_PATH");
  const backupPath = await createEncryptedBackup();
  const fileName = basename(backupPath);
  const destinationFolder = remoteFolder(remote, folder);
  const destination = `${destinationFolder}/${fileName}`;

  await verifyEncryptedBackup(backupPath);
  await runRclone(["copyto", backupPath, destination, "--checkers=2", "--transfers=1", "--retries=3"]);
  const listing = await runRclone(["lsf", "--files-only", destinationFolder]);

  if (!listing.stdout.split("\n").some((entry) => entry.trim() === fileName)) {
    throw new Error("Google Drive upload could not be confirmed.");
  }

  recordAuditEvent({
    userId: null,
    action: "backup_created",
    meta: { fileName, source: "google_drive" },
  });
  removeExpiredLocalBackups();
  console.log(`Encrypted backup uploaded to Google Drive: ${fileName}`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown Google Drive backup error.";

  console.error(message);
  process.exitCode = 1;
}
