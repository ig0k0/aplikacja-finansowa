"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importMappingSchema, normalizeImportRow } from "@/domain/imports";
import { requireUser } from "@/lib/session";
import { parseImportFile } from "@/imports/parse-file";

function redirectWithError(message: string): never {
  redirect(`/imports?error=${encodeURIComponent(message)}`);
}

function fileHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function createImportPreviewAction(formData: FormData) {
  const user = await requireUser();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirectWithError("Wybierz plik CSV, XLSX, PDF albo zdjecie (PNG, JPEG, WebP) do OCR.");
  }

  const mapping = importMappingSchema.safeParse({
    dateColumn: String(formData.get("dateColumn") ?? ""),
    amountColumn: String(formData.get("amountColumn") ?? ""),
    descriptionColumn: String(formData.get("descriptionColumn") ?? ""),
    merchantColumn: String(formData.get("merchantColumn") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    defaultType: String(formData.get("defaultType") ?? ""),
  });

  if (!mapping.success) {
    redirectWithError(mapping.error.issues[0]?.message ?? "Niepoprawne mapowanie kolumn.");
  }

  let batchId: string;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseImportFile(file);
    const { createImportPreview } = await import("@/db/imports");
    batchId = createImportPreview({
      userId: user.id,
      fileName: file.name,
      fileType: file.name.split(".").pop()?.toLowerCase() ?? "unknown",
      fileHash: fileHash(buffer),
      sourceInstitution: String(formData.get("sourceInstitution") ?? "generic") || "generic",
      mapping: mapping.data,
      rows: parsed.rows.map((row, index) => {
        try {
          return {
            rowNumber: index + 2,
            raw: row,
            normalized: normalizeImportRow(user.id, row, mapping.data),
          };
        } catch (error) {
          return {
            rowNumber: index + 2,
            raw: row,
            error: error instanceof Error ? error.message : "Niepoprawny wiersz.",
          };
        }
      }),
    });

  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Nie udalo sie sparsowac pliku.");
  }

  redirect(`/imports?batchId=${batchId}`);
}

export async function confirmImportAction(formData: FormData) {
  const user = await requireUser();
  const batchId = String(formData.get("batchId") ?? "");

  if (!batchId) {
    redirectWithError("Brakuje identyfikatora importu.");
  }

  let summary: { imported: number; skippedDuplicate: number; failed: number };

  try {
    const { confirmImportForUser } = await import("@/db/imports");
    summary = confirmImportForUser(user.id, batchId);
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Nie udalo sie zapisac importu.");
  }

  revalidatePath("/imports");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/review");
  revalidatePath("/audit");
  revalidatePath("/investments");
  redirect(
    `/imports?batchId=${batchId}&imported=${summary.imported}&duplicates=${summary.skippedDuplicate}&failed=${summary.failed}`,
  );
}
