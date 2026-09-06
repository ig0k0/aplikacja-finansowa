import "../lib/load-env";
import { rawDb } from "../db/client";
import { migrateLegacyDedupeKeys } from "../db/dedupe-migration";

try {
  console.log(JSON.stringify(migrateLegacyDedupeKeys()));
} finally {
  rawDb.close();
}
