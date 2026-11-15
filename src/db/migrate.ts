import "../lib/load-env";
import { rawDb } from "./client";
import { applyMigrations } from "./apply-migrations";
import { requireSessionSecret } from "../lib/secrets";

// Kontener startuje od migracji, wiec tu najwczesniej wychwytujemy nieuzupelniony `.env`.
requireSessionSecret();

applyMigrations(rawDb);
rawDb.close();
console.log("Database migrations are up to date");
