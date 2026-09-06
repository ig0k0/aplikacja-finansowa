const MEBIBYTE = 1024 * 1024;

const MAX_BYTES_BY_EXTENSION: Record<string, number> = {
  csv: 15 * MEBIBYTE,
  xlsx: 15 * MEBIBYTE,
  pdf: 8 * MEBIBYTE,
  png: 8 * MEBIBYTE,
  jpg: 8 * MEBIBYTE,
  jpeg: 8 * MEBIBYTE,
  webp: 8 * MEBIBYTE,
};
const OCR_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

export const MAX_IMPORT_ROWS = 50_000;

function fileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isOcrImageFile(fileName: string) {
  return OCR_IMAGE_EXTENSIONS.has(fileExtension(fileName));
}

export function validateImportFileSize(fileName: string, sizeBytes: number) {
  const extension = fileExtension(fileName);
  const maxBytes = MAX_BYTES_BY_EXTENSION[extension] ?? 0;

  if (maxBytes === 0) {
    return "Obslugiwane formaty: CSV, XLSX, PDF oraz PNG/JPEG/WebP.";
  }

  if (sizeBytes > maxBytes) {
    return `Plik .${extension} jest zbyt duzy. Limit: ${Math.floor(maxBytes / MEBIBYTE)} MB.`;
  }

  return null;
}

export function assertImportRowLimit(rowCount: number) {
  if (rowCount > MAX_IMPORT_ROWS) {
    throw new Error(`Plik zawiera wiecej niz ${MAX_IMPORT_ROWS.toLocaleString("pl-PL")} wierszy.`);
  }
}
