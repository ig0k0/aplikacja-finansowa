import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { getDatabasePath } from "./database-path";

const databasePath = getDatabasePath();
const directory = path.dirname(databasePath);

if (directory && directory !== ".") {
  fs.mkdirSync(directory, { recursive: true });
}

const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export const rawDb = sqlite;
