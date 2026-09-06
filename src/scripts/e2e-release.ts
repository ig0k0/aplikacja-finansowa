import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { applyMigrations } from "../db/apply-migrations";

const sessionSecret = "e2e-session-secret-only-for-temporary-db";
const temporaryDirectory = mkdtempSync(join(tmpdir(), "cfo-release-e2e-"));
const databasePath = join(temporaryDirectory, "app.db");
process.env.DATABASE_URL = databasePath;
process.env.SESSION_SECRET = sessionSecret;
const port = 3200 + Number.parseInt(randomBytes(2).toString("hex"), 16) % 400;
const baseUrl = `http://127.0.0.1:${port}`;
let server: ChildProcess | undefined;
let serverLogs = "";
let applicationRawDb: (typeof import("../db/client"))["rawDb"] | undefined;

function createSeedData() {
  const sqlite = new Database(databasePath);

  try {
    applyMigrations(sqlite);
    const now = "2026-09-06T00:00:00.000Z";
    const userId = "usr_release_e2e";
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHmac("sha256", sessionSecret).update(token).digest("hex");

    sqlite
      .prepare(
        "INSERT INTO users (id, login, display_name, password_hash, base_currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(userId, "release-e2e", "Release E2E", "not-used-by-session-test", "PLN", now, now);
    sqlite
      .prepare(
        "INSERT INTO categories (id, user_id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run("cat_release_e2e", userId, "E2E", "expense", now, now);
    sqlite
      .prepare(
        "INSERT INTO financial_accounts (id, user_id, name, institution, type, currency, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run("acc_release_e2e", userId, "E2E", "E2E", "bank", "PLN", 1, now, now);
    sqlite
      .prepare(
        "INSERT INTO transactions (id, user_id, category_id, type, transaction_date, amount_minor, currency, amount_pln_minor, description, verification_status, source, is_recurring, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "txn_release_e2e",
        userId,
        "cat_release_e2e",
        "expense",
        "2026-09-01",
        1234,
        "PLN",
        1234,
        "E2E release transaction",
        "verified",
        "manual",
        0,
        now,
        now,
      );
    sqlite
      .prepare(
        "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run("ses_release_e2e", userId, tokenHash, "2030-01-01T00:00:00.000Z", now);

    return token;
  } finally {
    sqlite.close();
  }
}

async function createAndDeduplicateImport() {
  const { rawDb } = await import("../db/client");
  const { createImportPreview, confirmImportForUser } = await import("../db/imports");
  const { normalizeImportRow } = await import("../domain/imports");
  applicationRawDb = rawDb;
  const mapping = {
    dateColumn: "Data",
    amountColumn: "Kwota",
    descriptionColumn: "Opis",
    categoryId: "cat_release_e2e",
    defaultType: "expense" as const,
  };
  const normalized = normalizeImportRow(
    "usr_release_e2e",
    { Data: "2026-09-02", Kwota: "-45.67", Opis: "E2E imported transaction" },
    mapping,
    { financialAccountId: "acc_release_e2e" },
  );
  const createBatch = (fileHash: string) =>
    createImportPreview({
      userId: "usr_release_e2e",
      fileName: "e2e.csv",
      fileType: "csv",
      fileHash,
      sourceInstitution: "E2E",
      financialAccountId: "acc_release_e2e",
      mapping,
      rows: [{ rowNumber: 2, raw: {}, normalized }],
    });

  assert.deepEqual(confirmImportForUser("usr_release_e2e", createBatch("e2e-first")), {
    imported: 1,
    skippedDuplicate: 0,
    failed: 0,
  });
  assert.deepEqual(confirmImportForUser("usr_release_e2e", createBatch("e2e-second")), {
    imported: 0,
    skippedDuplicate: 1,
    failed: 0,
  });
  const aiSuggestionCount = (
    rawDb.prepare("SELECT count(*) AS total FROM ai_suggestions").get() as { total: number }
  ).total;
  assert.equal(aiSuggestionCount, 0);
  applicationRawDb.close();
  applicationRawDb = undefined;
  return { aiSuggestionCount };
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(500) });

      if (response.ok) {
        return;
      }
    } catch {
      // Serwer Next.js moze jeszcze inicjalizowac worker.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Serwer release nie uruchomil sie. Logi:\n${serverLogs}`);
}

async function stopServer() {
  if (!server || server.exitCode !== null) {
    return;
  }

  server.kill("SIGINT");
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

try {
  assert.equal(existsSync(join(process.cwd(), ".next", "BUILD_ID")), true, "Najpierw uruchom build.");
  const token = createSeedData();
  const { aiSuggestionCount } = await createAndDeduplicateImport();
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databasePath,
      SESSION_SECRET: sessionSecret,
      COOKIE_SECURE: "0",
      AI_MODE: "disabled",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk: Buffer) => {
    serverLogs += chunk.toString();
  });
  server.stderr?.on("data", (chunk: Buffer) => {
    serverLogs += chunk.toString();
  });

  await waitForHealth();
  const health = await fetch(`${baseUrl}/api/health`);
  const healthBody = (await health.json()) as { status: string };
  assert.equal(healthBody.status, "ok");

  const anonymousDashboard = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
  assert.equal(anonymousDashboard.status, 307);
  assert.equal(anonymousDashboard.headers.get("location"), "/login");

  const authenticatedHeaders = { cookie: `cfo_session=${token}` };
  const protectedPaths = ["/dashboard", "/transactions", "/reports/monthly", "/review", "/imports"];
  const routeDurationsMs: Record<string, number> = {};
  const pageBodies = new Map<string, string>();

  for (const path of protectedPaths) {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${path}`, { headers: authenticatedHeaders });
    assert.equal(response.status, 200, `Nie udalo sie otworzyc ${path}.`);
    routeDurationsMs[path] = Math.round(performance.now() - startedAt);
    pageBodies.set(path, await response.text());
  }

  assert.match(pageBodies.get("/transactions") ?? "", /E2E release transaction/);
  assert.match(pageBodies.get("/review") ?? "", /E2E imported transaction/);
  console.log(
    JSON.stringify({
      result: "Release E2E passed",
      aiSuggestionCount,
      routeDurationsMs,
      authenticatedRouteCount: protectedPaths.length,
    }),
  );
} finally {
  await stopServer();
  applicationRawDb?.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
