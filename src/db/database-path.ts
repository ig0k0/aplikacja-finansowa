import path from "node:path";

export function getDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL ?? "./data/app.db";
  const databasePath = databaseUrl.startsWith("file:")
    ? databaseUrl.replace("file:", "")
    : databaseUrl;

  if (path.isAbsolute(databasePath)) {
    return databasePath;
  }

  const normalizedPath = databasePath.replace(/^\.\//, "");

  if (normalizedPath === "data") {
    return path.join(process.cwd(), "data");
  }

  if (normalizedPath.startsWith("data/")) {
    return path.join(process.cwd(), "data", normalizedPath.slice("data/".length));
  }

  throw new Error("DATABASE_URL must be an absolute path or point inside ./data.");
}
