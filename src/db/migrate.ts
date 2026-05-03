import { rawDb } from "./client";
import { applyMigrations } from "./apply-migrations";

applyMigrations(rawDb);
rawDb.close();
console.log("Database migrations are up to date");
