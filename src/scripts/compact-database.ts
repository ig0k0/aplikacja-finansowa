import "../lib/load-env";
import { rawDb } from "../db/client";

function databaseStats() {
  const pageCount = (rawDb.pragma("page_count", { simple: true }) as number) ?? 0;
  const freePageCount = (rawDb.pragma("freelist_count", { simple: true }) as number) ?? 0;
  const pageSize = (rawDb.pragma("page_size", { simple: true }) as number) ?? 0;

  return {
    usedBytes: (pageCount - freePageCount) * pageSize,
    reclaimableBytes: freePageCount * pageSize,
  };
}

try {
  const before = databaseStats();
  rawDb.pragma("wal_checkpoint(TRUNCATE)");
  rawDb.exec("VACUUM");
  const after = databaseStats();

  console.log(
    JSON.stringify({
      before,
      after,
      reclaimedBytes: Math.max(0, before.reclaimableBytes - after.reclaimableBytes),
    }),
  );
} finally {
  rawDb.close();
}
