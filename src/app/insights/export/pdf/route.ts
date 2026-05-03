import { buildInsightsPdfBuffer } from "@/lib/insights-pdf";
import { currentMonthInputValue } from "@/domain/budgets";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function normalizeMonth(raw: string | null): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    return raw;
  }

  return currentMonthInputValue();
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const month = normalizeMonth(url.searchParams.get("month"));

  const buffer = await buildInsightsPdfBuffer(user.id, month);
  const filename = `analityka-${month}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
