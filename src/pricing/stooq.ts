import { toStooqSymbol, type QuoteCurrency } from "@/domain/pricing";

export type StooqQuote = {
  symbol: string;
  close: number;
  closeMinor: number;
  currency: QuoteCurrency;
  quoteDate: string;
};

function parseCloseMinor(value: string): number {
  const normalized = value.trim().replace(",", ".");

  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new Error(`Stooq: niepoprawna cena ${value}.`);
  }

  const parts = normalized.split(".");
  const whole = Number(parts[0]);
  const frac = (parts[1] ?? "").padEnd(2, "0").slice(0, 2);

  return whole * 100 + Number(frac);
}

function inferCurrencyFromSymbol(symbol: string): QuoteCurrency {
  if (symbol.endsWith(".us")) {
    return "USD";
  }

  if (symbol.endsWith(".pl")) {
    return "PLN";
  }

  return "EUR";
}

export async function fetchStooqQuote(ticker: string, quoteCurrency: QuoteCurrency): Promise<StooqQuote> {
  const symbol = toStooqSymbol(ticker, quoteCurrency);

  if (!symbol) {
    throw new Error("Brak tickera do pobrania ceny.");
  }

  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Stooq HTTP ${response.status} dla ${symbol}.`);
  }

  const text = await response.text();
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error(`Stooq: brak danych dla ${symbol}.`);
  }

  const headers = lines[0]!.split(",").map((cell) => cell.trim().toLowerCase());
  const values = lines[1]!.split(",").map((cell) => cell.trim());
  const closeIndex = headers.indexOf("close");
  const dateIndex = headers.indexOf("date");

  if (closeIndex < 0) {
    throw new Error(`Stooq: brak kolumny Close dla ${symbol}.`);
  }

  const closeRaw = values[closeIndex] ?? "";

  if (!closeRaw || closeRaw === "N/D") {
    throw new Error(`Stooq: brak ceny zamkniecia dla ${symbol}.`);
  }

  const closeMinor = parseCloseMinor(closeRaw);

  return {
    symbol,
    close: closeMinor / 100,
    closeMinor,
    currency: inferCurrencyFromSymbol(symbol),
    quoteDate: dateIndex >= 0 ? (values[dateIndex] ?? "") : "",
  };
}
