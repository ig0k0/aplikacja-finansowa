import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { applyMigrations } from "../db/apply-migrations";
import { getDatabasePath } from "../db/database-path";

const scrypt = promisify(scryptCallback);
const algorithm = "aes-256-gcm";
const keyLength = 32;

type BackupEnvelope = {
  format: "cfo-sqlite-backup";
  formatVersion: 1;
  appVersion: string;
  createdAt: string;
  databaseSha256: string;
  encryption: {
    algorithm: "aes-256-gcm";
    kdf: "scrypt";
    salt: string;
    iv: string;
    authTag: string;
  };
  payload: string;
};

function requireBackupKey() {
  const key = process.env.BACKUP_ENCRYPTION_KEY;

  if (!key) {
    throw new Error("BACKUP_ENCRYPTION_KEY is required.");
  }

  return key;
}

async function deriveKey(secret: string, salt: Buffer) {
  return (await scrypt(secret, salt, keyLength)) as Buffer;
}

async function encrypt(plaintext: Buffer, secret: string) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(secret, salt);
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    encrypted,
    salt,
    iv,
    authTag: cipher.getAuthTag(),
  };
}

async function decrypt(envelope: BackupEnvelope, secret: string) {
  const salt = Buffer.from(envelope.encryption.salt, "base64");
  const iv = Buffer.from(envelope.encryption.iv, "base64");
  const authTag = Buffer.from(envelope.encryption.authTag, "base64");
  const key = await deriveKey(secret, salt);
  const decipher = createDecipheriv(algorithm, key, iv);

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(Buffer.from(envelope.payload, "base64")),
    decipher.final(),
  ]);
}

async function readAppVersion() {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, "utf8")) as {
    version?: string;
  };

  return packageJson.version ?? "0.0.0";
}

async function sha256(buffer: Buffer) {
  const { createHash } = await import("node:crypto");

  return createHash("sha256").update(buffer).digest("hex");
}

function defaultBackupPath() {
  const destination = process.env.BACKUP_DESTINATION ?? "./backups";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return path.join(destination, `backup-${timestamp}.cfo-backup.json`);
}

async function withTempDatabase<T>(callback: (tempPath: string) => Promise<T>) {
  const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "cfo-backup-"));
  const tempPath = path.join(tempDirectory, "backup.sqlite");

  try {
    return await callback(tempPath);
  } finally {
    await fs.promises.rm(tempDirectory, { recursive: true });
  }
}

export async function createEncryptedBackup(outputPath = defaultBackupPath()) {
  const secret = requireBackupKey();
  const resolvedOutputPath = path.resolve(process.cwd(), outputPath);

  await fs.promises.mkdir(path.dirname(resolvedOutputPath), { recursive: true });

  return withTempDatabase(async (tempDatabasePath) => {
    const databasePath = getDatabasePath();
    const source = new Database(databasePath);

    try {
      source.pragma("journal_mode = WAL");

      await source.backup(tempDatabasePath);
    } finally {
      source.close();
    }

    const plaintext = await fs.promises.readFile(tempDatabasePath);
    const encrypted = await encrypt(plaintext, secret);
    const envelope: BackupEnvelope = {
      format: "cfo-sqlite-backup",
      formatVersion: 1,
      appVersion: await readAppVersion(),
      createdAt: new Date().toISOString(),
      databaseSha256: await sha256(plaintext),
      encryption: {
        algorithm,
        kdf: "scrypt",
        salt: encrypted.salt.toString("base64"),
        iv: encrypted.iv.toString("base64"),
        authTag: encrypted.authTag.toString("base64"),
      },
      payload: encrypted.encrypted.toString("base64"),
    };

    await fs.promises.writeFile(resolvedOutputPath, JSON.stringify(envelope, null, 2));

    return resolvedOutputPath;
  });
}

async function readAndDecryptBackup(inputPath: string) {
  const secret = requireBackupKey();
  const rawEnvelope = await fs.promises.readFile(path.resolve(process.cwd(), inputPath), "utf8");
  const envelope = JSON.parse(rawEnvelope) as BackupEnvelope;

  if (envelope.format !== "cfo-sqlite-backup" || envelope.formatVersion !== 1) {
    throw new Error("Unsupported backup format.");
  }

  const plaintext = await decrypt(envelope, secret);
  const checksum = await sha256(plaintext);

  if (checksum !== envelope.databaseSha256) {
    throw new Error("Backup checksum verification failed.");
  }

  return { envelope, plaintext };
}

export async function verifyEncryptedBackup(inputPath: string) {
  const { envelope, plaintext } = await readAndDecryptBackup(inputPath);

  await withTempDatabase(async (tempDatabasePath) => {
    await fs.promises.writeFile(tempDatabasePath, plaintext);
    const sqlite = new Database(tempDatabasePath, { readonly: true });
    const integrity = sqlite.prepare("PRAGMA integrity_check").get() as {
      integrity_check: string;
    };
    sqlite.close();

    if (integrity.integrity_check !== "ok") {
      throw new Error("SQLite integrity check failed.");
    }
  });

  return envelope;
}

function preRestorePath(databasePath: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return `${databasePath}.pre-restore-${timestamp}`;
}

async function moveIfExists(sourcePath: string, targetPath: string) {
  if (fs.existsSync(sourcePath)) {
    await fs.promises.rename(sourcePath, targetPath);
  }
}

export async function restoreEncryptedBackup(inputPath: string) {
  const { plaintext } = await readAndDecryptBackup(inputPath);
  const databasePath = getDatabasePath();

  await fs.promises.mkdir(path.dirname(databasePath), { recursive: true });

  await withTempDatabase(async (tempDatabasePath) => {
    await fs.promises.writeFile(tempDatabasePath, plaintext);
    const restoredDb = new Database(tempDatabasePath);
    const integrity = restoredDb.prepare("PRAGMA integrity_check").get() as {
      integrity_check: string;
    };

    if (integrity.integrity_check !== "ok") {
      restoredDb.close();
      throw new Error("SQLite integrity check failed.");
    }

    applyMigrations(restoredDb);
    restoredDb.close();

    const preservedPath = preRestorePath(databasePath);
    await moveIfExists(databasePath, preservedPath);
    await moveIfExists(`${databasePath}-wal`, `${preservedPath}-wal`);
    await moveIfExists(`${databasePath}-shm`, `${preservedPath}-shm`);
    await fs.promises.copyFile(tempDatabasePath, databasePath);
  });

  return databasePath;
}
