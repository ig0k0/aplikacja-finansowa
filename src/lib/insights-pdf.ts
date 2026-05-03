import vfsFonts from "pdfmake/build/vfs_fonts.js";
import PdfPrinter from "pdfmake/js/Printer.js";
import URLResolver from "pdfmake/js/URLResolver.js";
import {
  compareExpenseCategoriesMonthOverMonth,
  forecastMonthEndExpenses,
  getPreviousMonthLabel,
  listHeuristicRecurringCandidates,
  summarizeRecurringExpensesByCategoryForMonth,
  totalRecurringExpensesForMonth,
} from "@/db/analytics";
import { currentMonthInputValue } from "@/domain/budgets";
import { formatCurrencyMinor } from "@/lib/format";

/** Minimal vfs: fonty Roboto z pdfmake (obsługa PL). */
class InsightsPdfVfs {
  private readonly storage: Record<string, Buffer>;

  constructor(base64Map: Record<string, string>) {
    this.storage = {};
    for (const key of Object.keys(base64Map)) {
      this.storage[key] = Buffer.from(base64Map[key], "base64");
    }
  }

  existsSync(filename: string): boolean {
    return typeof this.storage[filename] !== "undefined";
  }

  readFileSync(filename: string): Buffer {
    const buffer = this.storage[filename];
    if (!buffer) {
      throw new Error(`Font vfs missing: ${filename}`);
    }

    return buffer;
  }

  writeFileSync(filename: string, content: Buffer | string): void {
    this.storage[filename] = Buffer.isBuffer(content) ? content : Buffer.from(content);
  }
}

const fonts = {
  Roboto: {
    bold: "Roboto-Medium.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
    italics: "Roboto-Italic.ttf",
    normal: "Roboto-Regular.ttf",
  },
};

export async function buildInsightsPdfBuffer(userId: string, month: string): Promise<Buffer> {
  const previousMonthLabel = getPreviousMonthLabel(month);
  const momRows = compareExpenseCategoriesMonthOverMonth(userId, month);
  const forecast = forecastMonthEndExpenses(userId, month);
  const recurringByCategory = summarizeRecurringExpensesByCategoryForMonth(userId, month);
  const recurringTotalPlnMinor = totalRecurringExpensesForMonth(userId, month);
  const heuristicCandidates = listHeuristicRecurringCandidates(userId, month, 6, 20);

  const vfs = new InsightsPdfVfs(vfsFonts as Record<string, string>);
  const urlResolver = new URLResolver(vfs);
  const printer = new PdfPrinter(fonts, vfs, urlResolver);

  const momBody: unknown[][] = [
    [
      { style: "tableHeader", text: "Kategoria" },
      { style: "tableHeader", text: month },
      { style: "tableHeader", text: previousMonthLabel },
      { style: "tableHeader", text: "Zmiana" },
      { style: "tableHeader", text: "Zmiana %" },
    ],
    ...(momRows.length === 0
      ? [[{ colSpan: 5, style: "muted", text: "Brak danych wydatkowych dla tego okresu." }, {}, {}, {}, {}]]
      : momRows.map((row) => [
          row.categoryName,
          formatCurrencyMinor(row.currentPlnMinor),
          formatCurrencyMinor(row.previousPlnMinor),
          formatCurrencyMinor(row.deltaPlnMinor),
          row.deltaPercent === null
            ? row.previousPlnMinor === 0 && row.currentPlnMinor > 0
              ? "Nowe"
              : "—"
            : `${row.deltaPercent}%`,
        ])),
  ];

  const recurringBody: unknown[][] = [
    [
      { style: "tableHeader", text: "Kategoria" },
      { style: "tableHeader", text: "Suma" },
    ],
    ...(recurringByCategory.length === 0
      ? [[{ colSpan: 2, style: "muted", text: "Brak oznaczonych wydatkow w tym miesiacu." }, {}]]
      : recurringByCategory.map((row) => [
          row.categoryName,
          formatCurrencyMinor(row.spentPlnMinor),
        ])),
  ];

  const heuristicBody: unknown[][] = [
    [
      { style: "tableHeader", text: "Wzorzec" },
      { style: "tableHeader", text: "Mies." },
      { style: "tableHeader", text: "Op." },
      { style: "tableHeader", text: "Lacznie" },
      { style: "tableHeader", text: "Srednia" },
    ],
    ...(heuristicCandidates.length === 0
      ? [
          [
            { colSpan: 5, style: "muted", text: "Brak wzorcow heurystyki w oknie 6 miesiecy." },
            {},
            {},
            {},
            {},
          ],
        ]
      : heuristicCandidates.map((row) => [
          row.label,
          String(row.distinctMonthCount),
          String(row.transactionCount),
          formatCurrencyMinor(row.totalPlnMinor),
          formatCurrencyMinor(row.avgPlnMinor),
        ])),
  ];

  const docDefinition = {
    info: {
      title: `Analityka ${month}`,
    },
    content: [
      { alignment: "center", style: "title", text: "Centrum Finansow Osobistych — raport analityczny" },
      { margin: [0, 8, 0, 4], text: `Miesiac: ${month}`, fontSize: 11 },
      { margin: [0, 0, 0, 12], style: "muted", text: `Wygenerowano PDF na podstawie Twoich transakcji.` },

      { style: "section", text: "Subskrypcje i stale oplaty (oznaczone transakcje)" },
      {
        margin: [0, 0, 0, 8],
        text:
          recurringTotalPlnMinor > 0
            ? `Razem oznaczonych wydatkow: ${formatCurrencyMinor(recurringTotalPlnMinor)}`
            : "Brak oznaczonych wydatkow w wybranym miesiacu.",
      },
      {
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 16],
        table: {
          body: recurringBody,
          headerRows: 1,
          widths: ["*", "auto"],
        },
      },

      { style: "section", text: "Heurystyka (6 miesiecy do wybranego miesiaca)" },
      {
        margin: [0, 0, 0, 8],
        style: "muted",
        text: "Automatyczna analiza — zweryfikuj recznie. Grupowanie po kontrahencie lub opisie, filtr stabilnosci kwoty.",
      },
      {
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 16],
        table: {
          body: heuristicBody,
          headerRows: 1,
          widths: ["*", "auto", "auto", "auto", "auto"],
        },
      },

      { style: "section", text: "Prognoza konca miesiaca (biezacy miesiac)" },
      ...(forecast.applicable
        ? [
            {
              columns: [
                { stack: ["Wydatki narastajaco", { bold: true, text: formatCurrencyMinor(forecast.expenseSoFarPlnMinor) }] },
                {
                  stack: [
                    "Prognoza wydatkow na koniec miesiaca",
                    { bold: true, text: formatCurrencyMinor(forecast.projectedExpensePlnMinor) },
                  ],
                },
                {
                  stack: [
                    "Dzien miesiaca (tempo)",
                    { bold: true, text: `${forecast.dayOfMonth} / ${forecast.daysInMonth}` },
                  ],
                },
              ],
              columnGap: 12,
              margin: [0, 0, 0, 12],
            },
          ]
        : [
            {
              margin: [0, 0, 0, 12],
              style: "muted",
              text: `Prognoza jest dostepna tylko dla biezacego miesiaca kalendarzowego (${currentMonthInputValue()}).`,
            },
          ]),

      { style: "section", text: `Porownanie z poprzednim miesiacem (${previousMonthLabel})` },
      {
        layout: "lightHorizontalLines",
        margin: [0, 8, 0, 0],
        table: {
          body: momBody,
          headerRows: 1,
          widths: ["*", "auto", "auto", "auto", "auto"],
        },
      },
    ],
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
    },
    styles: {
      muted: {
        color: "#555555",
        italics: true,
      },
      section: {
        bold: true,
        fontSize: 12,
        margin: [0, 8, 0, 4],
      },
      tableHeader: {
        bold: true,
        fillColor: "#eeeeee",
      },
      title: {
        bold: true,
        fontSize: 15,
      },
    },
  };

  const pdfDoc = await printer.createPdfKitDocument(docDefinition);

  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    pdfDoc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}
