import { NextResponse } from "next/server";
import { currentMonthInputValue } from "@/domain/budgets";
import { compareExpenseCategoriesMonthOverMonth } from "@/db/analytics";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function normalizeMonth(raw: string | null): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    return raw;
  }

  return currentMonthInputValue();
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const month = normalizeMonth(url.searchParams.get("month"));
  const rows = compareExpenseCategoriesMonthOverMonth(user.id, month);

  const header = ["Kategoria", "Miesiac_biezacy_gr", "Miesiac_poprzedni_gr", "Zmiana_gr", "Zmiana_proc"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        csvEscape(row.categoryName),
        String(row.currentPlnMinor),
        String(row.previousPlnMinor),
        String(row.deltaPlnMinor),
        row.deltaPercent === null ? "" : String(row.deltaPercent),
      ].join(","),
    ),
  ];

  const body = `\ufeff${lines.join("\r\n")}`;
  const filename = `analityka-${month}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
