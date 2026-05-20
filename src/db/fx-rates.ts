import { fetchNbpRatesForPricing, type NbpRate } from "@/pricing/nbp";
import { db } from "./client";
import { fxRates } from "./schema";
import { nowIso } from "../lib/time";
import type { QuoteCurrency } from "@/domain/pricing";

export function upsertFxRates(rates: NbpRate[]) {
  const fetchedAt = nowIso();

  db.transaction(() => {
    for (const rate of rates) {
      db.insert(fxRates)
        .values({
          rateDate: rate.rateDate,
          currency: rate.currency,
          plnPerUnit: rate.plnPerUnit,
          source: "nbp",
          fetchedAt,
        })
        .onConflictDoUpdate({
          target: [fxRates.rateDate, fxRates.currency],
          set: {
            plnPerUnit: rate.plnPerUnit,
            source: "nbp",
            fetchedAt,
          },
        })
        .run();
    }
  });
}

export async function ensureFxRatesForPricing(): Promise<{
  usd: NbpRate;
  eur: NbpRate;
}> {
  const fetched = await fetchNbpRatesForPricing();
  upsertFxRates(fetched);

  const usd = fetched.find((rate) => rate.currency === "USD");
  const eur = fetched.find((rate) => rate.currency === "EUR");

  if (!usd || !eur) {
    throw new Error("NBP: nie udalo sie pobrac kursow USD/EUR.");
  }

  return { usd, eur };
}

export function resolvePlnPerUnit(
  quoteCurrency: QuoteCurrency,
  rates: { usd: NbpRate; eur: NbpRate },
): { plnPerUnit: number; rateDate: string; source: string } {
  if (quoteCurrency === "PLN") {
    return { plnPerUnit: 1, rateDate: rates.usd.rateDate, source: "identity" };
  }

  if (quoteCurrency === "USD") {
    return { plnPerUnit: rates.usd.plnPerUnit, rateDate: rates.usd.rateDate, source: "nbp" };
  }

  return { plnPerUnit: rates.eur.plnPerUnit, rateDate: rates.eur.rateDate, source: "nbp" };
}
