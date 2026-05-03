import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "tesseract.js"],
};

export default nextConfig;
