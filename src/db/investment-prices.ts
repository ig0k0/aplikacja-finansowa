import { and, eq } from "drizzle-orm";
import {
  convertQuoteMinorToPlnMinor,
  isAutoPriceAssetType,
  positionMarketValuePlnMinor,
  type QuoteCurrency,
} from "@/domain/pricing";
import { fetchStooqQuote } from "@/pricing/stooq";
import { ensureFxRatesForPricing, resolvePlnPerUnit } from "./fx-rates";
import { db } from "./client";
import { investmentAssets } from "./schema";
import { nowIso } from "../lib/time";

export type PriceRefreshResult = {
  updated: number;
  skipped: number;
  failed: { assetId: string; name: string; message: string }[];
  fxUsdPln: number;
  fxEurPln: number;
  rateDate: string;
};

function parseQuoteCurrency(value: string): QuoteCurrency {
  const upper = value.toUpperCase();

  if (upper === "USD" || upper === "EUR" || upper === "PLN") {
    return upper;
  }

  return "PLN";
}

export async function refreshInvestmentPricesForUser(userId: string): Promise<PriceRefreshResult> {
  const assets = db
    .select()
    .from(investmentAssets)
    .where(eq(investmentAssets.userId, userId))
    .all();

  const rates = await ensureFxRatesForPricing();
  const now = nowIso();
  const result: PriceRefreshResult = {
    updated: 0,
    skipped: 0,
    failed: [],
    fxUsdPln: rates.usd.plnPerUnit,
    fxEurPln: rates.eur.plnPerUnit,
    rateDate: rates.usd.rateDate,
  };

  for (const asset of assets) {
    if (!isAutoPriceAssetType(asset.type)) {
      result.skipped += 1;
      continue;
    }

    if (!asset.ticker?.trim()) {
      result.skipped += 1;
      continue;
    }

    const listingCurrency = parseQuoteCurrency(asset.currency);

    try {
      const quote = await fetchStooqQuote(asset.ticker, listingCurrency);
      const fx = resolvePlnPerUnit(quote.currency, rates);
      const unitPlnMinor = convertQuoteMinorToPlnMinor(quote.closeMinor, quote.currency, fx.plnPerUnit);
      const marketPlnMinor = positionMarketValuePlnMinor(asset.quantity, unitPlnMinor);

      db.update(investmentAssets)
        .set({
          marketValuePlnMinor: marketPlnMinor,
          lastQuotePriceMinor: quote.closeMinor,
          lastQuoteCurrency: quote.currency,
          lastQuoteFxRate: quote.currency === "PLN" ? null : fx.plnPerUnit,
          lastQuoteRateDate: fx.rateDate,
          lastPriceFetchedAt: now,
          priceSource: "stooq+nbp",
          updatedAt: now,
        })
        .where(and(eq(investmentAssets.id, asset.id), eq(investmentAssets.userId, userId)))
        .run();

      result.updated += 1;
    } catch (error) {
      result.failed.push({
        assetId: asset.id,
        name: asset.name,
        message: error instanceof Error ? error.message : "Nieznany blad ceny.",
      });
    }
  }

  return result;
}
