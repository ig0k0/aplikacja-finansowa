export const quoteCurrencies = ["PLN", "USD", "EUR"] as const;
export type QuoteCurrency = (typeof quoteCurrencies)[number];

export const autoPriceAssetTypes = ["etf", "stock", "crypto"] as const;

export function isAutoPriceAssetType(type: string): boolean {
  return (autoPriceAssetTypes as readonly string[]).includes(type);
}

/** Symbol Stooq (np. aapl.us, pko.pl). */
export function toStooqSymbol(ticker: string, quoteCurrency: QuoteCurrency): string | null {
  const normalized = ticker.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized.includes(".")) {
    return normalized;
  }

  if (quoteCurrency === "USD") {
    return `${normalized}.us`;
  }

  if (quoteCurrency === "PLN") {
    return `${normalized}.pl`;
  }

  return `${normalized}.de`;
}

/** Kwota w minor jednostek waluty notowania → minor PLN (grosze). */
export function convertQuoteMinorToPlnMinor(
  quoteMinor: number,
  quoteCurrency: QuoteCurrency,
  plnPerUnit: number,
): number {
  if (quoteCurrency === "PLN") {
    return quoteMinor;
  }

  return Math.round((quoteMinor / 100) * plnPerUnit * 100);
}

export function positionMarketValuePlnMinor(
  quantity: number,
  unitPlnMinor: number,
): number {
  if (quantity > 0) {
    return Math.max(0, Math.round(quantity * unitPlnMinor));
  }

  return unitPlnMinor;
}
