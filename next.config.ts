import type { NextConfig } from "next";

// Musi pokrywac najwiekszy limit z `src/domain/import-limits.ts` (15 MB) plus narzut formularza.
const IMPORT_BODY_LIMIT = "16mb";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "tesseract.js"],
  experimental: {
    serverActions: {
      bodySizeLimit: IMPORT_BODY_LIMIT,
    },
    proxyClientMaxBodySize: IMPORT_BODY_LIMIT,
  },
};

export default nextConfig;
