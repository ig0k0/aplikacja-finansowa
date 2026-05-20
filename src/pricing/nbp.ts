import type { QuoteCurrency } from "@/domain/pricing";

const NBP_TABLE_A = "a";
const SUPPORTED: QuoteCurrency[] = ["USD", "EUR"];

export type NbpRate = {
  currency: QuoteCurrency;
  rateDate: string;
  plnPerUnit: number;
};

type NbpResponse = {
  table: string;
  currency: string;
  code: string;
  rates: { no: string; effectiveDate: string; mid: number }[];
};

function mapCode(code: string): QuoteCurrency | null {
  const upper = code.toUpperCase();

  if (upper === "USD" || upper === "EUR") {
    return upper;
  }

  return null;
}

export async function fetchNbpRate(currency: QuoteCurrency, rateDate?: string): Promise<NbpRate> {
  if (!SUPPORTED.includes(currency)) {
    throw new Error(`NBP: nieobslugiwana waluta ${currency}.`);
  }

  const path = rateDate
    ? `exchangerates/rates/${NBP_TABLE_A}/${currency.toLowerCase()}/${rateDate}/`
    : `exchangerates/rates/${NBP_TABLE_A}/${currency.toLowerCase()}/last/`;

  const response = await fetch(`https://api.nbp.pl/api/${path}?format=json`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`NBP HTTP ${response.status} dla ${currency}.`);
  }

  const body = (await response.json()) as NbpResponse;
  const row = body.rates[0];

  if (!row?.mid) {
    throw new Error(`NBP: brak kursu ${currency}.`);
  }

  return {
    currency,
    rateDate: row.effectiveDate,
    plnPerUnit: row.mid,
  };
}

export async function fetchNbpRatesForPricing(rateDate?: string): Promise<NbpRate[]> {
  return Promise.all(SUPPORTED.map((currency) => fetchNbpRate(currency, rateDate)));
}

export function parseNbpCode(code: string): QuoteCurrency | null {
  return mapCode(code);
}
