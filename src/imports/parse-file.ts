import { parse } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import type { ParsedImportFile } from "../domain/imports";

function normalizeCell(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value == null ? "" : String(value).trim();
}

function rowsToObjects(rows: unknown[][]): ParsedImportFile {
  const [headerRow, ...dataRows] = rows;

  if (!headerRow) {
    throw new Error("Plik nie zawiera naglowkow.");
  }

  const headers = headerRow.map(normalizeCell).filter(Boolean);

  if (headers.length === 0) {
    throw new Error("Plik nie zawiera naglowkow.");
  }

  return {
    headers,
    rows: dataRows
      .map((row) =>
        Object.fromEntries(headers.map((header, index) => [header, normalizeCell(row[index])])),
      )
      .filter((row) => Object.values(row).some(Boolean)),
  };
}

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (
    extension === "png" ||
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "webp"
  ) {
    return parseReceiptImage(buffer);
  }

  if (extension === "csv") {
    const rows = parse(buffer, {
      bom: true,
      columns: false,
      relaxColumnCount: true,
      skipEmptyLines: true,
      trim: true,
    }) as unknown[][];

    return rowsToObjects(rows);
  }

  if (extension === "xlsx") {
    const rows = await parseXlsx(buffer);

    return rowsToObjects(rows);
  }

  if (extension === "xls") {
    throw new Error(
      "Legacy XLS nie jest jeszcze obslugiwany bezpiecznym parserem. Wyeksportuj plik jako CSV albo XLSX.",
    );
  }

  if (extension === "pdf") {
    return parsePdf(buffer);
  }

  throw new Error(
    "Obslugiwane formaty: CSV, XLSX, PDF (tekst/tabela) oraz PNG/JPEG/WebP (OCR paragonu, jezyk polski).",
  );
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function columnIndex(cellRef: string) {
  const letters = cellRef.replace(/\d+/g, "");
  let index = 0;

  for (const letter of letters) {
    index = index * 26 + letter.toUpperCase().charCodeAt(0) - 64;
  }

  return index - 1;
}

function textValue(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "object" && "#text" in value) {
    return String((value as { "#text": unknown })["#text"]);
  }

  return String(value);
}

function sharedStringValue(item: unknown): string {
  if (!item || typeof item !== "object") {
    return "";
  }

  const sharedString = item as { t?: unknown; r?: { t?: unknown } | { t?: unknown }[] };

  if (sharedString.t != null) {
    return textValue(sharedString.t);
  }

  return asArray(sharedString.r)
    .map((run) => textValue(run.t))
    .join("");
}

async function parseXlsx(buffer: Buffer): Promise<unknown[][]> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new XMLParser({
    attributeNamePrefix: "",
    ignoreAttributes: false,
  });
  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("text");
  const sharedStrings = sharedStringsXml
    ? asArray(
        (
          parser.parse(sharedStringsXml) as {
            sst?: { si?: unknown | unknown[] };
          }
        ).sst?.si,
      ).map(sharedStringValue)
    : [];
  const workbookXml = await zip.file("xl/workbook.xml")?.async("text");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  let sheetPath = "xl/worksheets/sheet1.xml";

  if (workbookXml && relsXml) {
    const workbook = parser.parse(workbookXml) as {
      workbook?: { sheets?: { sheet?: { "r:id"?: string } | { "r:id"?: string }[] } };
    };
    const rels = parser.parse(relsXml) as {
      Relationships?: {
        Relationship?: { Id?: string; Target?: string } | { Id?: string; Target?: string }[];
      };
    };
    const firstSheet = asArray(workbook.workbook?.sheets?.sheet)[0];
    const rel = asArray(rels.Relationships?.Relationship).find(
      (relationship) => relationship.Id === firstSheet?.["r:id"],
    );

    if (rel?.Target) {
      sheetPath = rel.Target.startsWith("/")
        ? rel.Target.slice(1)
        : `xl/${rel.Target}`.replace("xl/worksheets/../", "xl/");
    }
  }

  const sheetXml = await zip.file(sheetPath)?.async("text");

  if (!sheetXml) {
    throw new Error("Nie znaleziono pierwszego arkusza w pliku XLSX.");
  }

  const sheet = parser.parse(sheetXml) as {
    worksheet?: {
      sheetData?: {
        row?: { c?: unknown | unknown[] } | { c?: unknown | unknown[] }[];
      };
    };
  };

  return asArray(sheet.worksheet?.sheetData?.row).map((row) => {
    const values: unknown[] = [];

    for (const rawCell of asArray(row.c)) {
      const cell = rawCell as {
        r?: string;
        t?: string;
        v?: unknown;
        is?: { t?: unknown };
      };
      const index = cell.r ? columnIndex(cell.r) : values.length;
      let value = textValue(cell.v);

      if (cell.t === "s") {
        value = sharedStrings[Number(value)] ?? "";
      } else if (cell.t === "inlineStr") {
        value = textValue(cell.is?.t);
      }

      values[index] = value;
    }

    return values;
  });
}

function splitPdfLine(line: string): string[] {
  if (line.includes("\t")) {
    return line
      .split("\t")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  const byMultiSpace = line
    .split(/\s{2,}/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (byMultiSpace.length >= 2) {
    return byMultiSpace;
  }

  return [line.trim()];
}

function pdfTableLinesToMatrix(lines: string[][]): unknown[][] {
  if (lines.length < 2) {
    throw new Error(
      "Nie uzyskano co najmniej dwoch wierszy (tabela/heurystyka). Sprobuj CSV/XLSX albo wyrazniejszy uklad kolumn w zrodle.",
    );
  }

  const width = Math.max(2, ...lines.map((cells) => cells.length));

  const padded = lines.map((cells) => {
    const row = [...cells];

    while (row.length < width) {
      row.push("");
    }

    return row.slice(0, width);
  });

  const headerRow = padded[0].map((cell, index) => cell.trim() || `Kolumna_${index + 1}`);
  const bodyRows = padded.slice(1);

  return [headerRow, ...bodyRows];
}

function neutralExtractedTextToMatrix(text: string): unknown[][] {
  const rawLines = text
    .split(/\r?\n/u)
    .map((l) => l.trim())
    .filter(
      (line) =>
        line.length >= 2 &&
        !/^strona\s+\d+/iu.test(line) &&
        !/^\d+\s*\/\s*\d+$/u.test(line) &&
        !/^---+\s*$/u.test(line),
    );

  const lineCells = rawLines.map(splitPdfLine);
  const width = Math.max(0, ...lineCells.map((c) => c.length));

  if (width < 2) {
    throw new Error(
      "Wyekstrahowany tekst ma mniej niz dwie kolumny po podziale (tab / wielokrotne spacje). Dla PDF: eksport CSV/XLSX z banku. Dla zdjecia: lepsza jakosc OCR lub reczny opis.",
    );
  }

  return pdfTableLinesToMatrix(lineCells);
}

async function parseReceiptImage(buffer: Buffer): Promise<ParsedImportFile> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("pol");

  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    const trimmed = text.trim();

    if (!trimmed) {
      throw new Error(
        "OCR nie zwrocil tekstu — popraw oswietlenie i ostrosc zdjecia albo uzyj importu CSV/XLSX.",
      );
    }

    const matrix = neutralExtractedTextToMatrix(trimmed);

    return rowsToObjects(matrix);
  } finally {
    await worker.terminate();
  }
}

async function parsePdf(buffer: Buffer): Promise<ParsedImportFile> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const tableResult = await parser.getTable();

    for (const table of tableResult.mergedTables) {
      if (table.length >= 2) {
        const maxCols = Math.max(...table.map((r) => r.length));

        if (maxCols >= 2) {
          const padded = table.map((row) => {
            const cells = row.map((c) => String(c ?? "").trim());

            while (cells.length < maxCols) {
              cells.push("");
            }

            return cells.slice(0, maxCols);
          });

          const matrix = padded.map((row, rowIndex) =>
            row.map((cell, index) => {
              const raw = cell;

              if (raw) {
                return raw;
              }

              return rowIndex === 0 ? `Kolumna_${index + 1}` : "";
            }),
          );

          return rowsToObjects(matrix as unknown[][]);
        }
      }
    }

    const textResult = await parser.getText();
    const text = textResult.text?.trim() ?? "";

    if (!text) {
      throw new Error(
        "Nie udalo sie odczytac warstwy tekstowej z PDF. Jezeli to skan, zapisz strone jako obraz (PNG/JPEG) i wgraj go tutaj (OCR) albo uzyj CSV/XLSX z banku.",
      );
    }

    const matrix = neutralExtractedTextToMatrix(text);

    return rowsToObjects(matrix);
  } finally {
    await parser.destroy();
  }
}
