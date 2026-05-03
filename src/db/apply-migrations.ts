import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

export function applyMigrations(sqlite: Database.Database) {
  const migrationsDirectory = path.join(process.cwd(), "migrations");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    sqlite
      .prepare("SELECT id FROM schema_migrations")
      .all()
      .map((row) => (row as { id: string }).id),
  );

  const migrations = fs
    .readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const fileName of migrations) {
    if (applied.has(fileName)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDirectory, fileName), "utf8");

    sqlite.transaction(() => {
      sqlite.exec(sql);
      sqlite
        .prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
        .run(fileName, new Date().toISOString());
    })();

    console.log(`Applied migration ${fileName}`);
  }
}
