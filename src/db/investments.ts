import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import { investmentAssets, investmentOperations, investmentStrategies } from "./schema";
import { createId } from "../lib/ids";
import { nowIso } from "../lib/time";
import type { InvestmentOperationType, StrategyRulesV1 } from "../domain/investments";

export function listInvestmentAssetsForUser(userId: string) {
  return db
    .select()
    .from(investmentAssets)
    .where(eq(investmentAssets.userId, userId))
    .orderBy(desc(investmentAssets.updatedAt))
    .all();
}

export function getInvestmentAssetForUser(userId: string, assetId: string) {
  return db
    .select()
    .from(investmentAssets)
    .where(and(eq(investmentAssets.id, assetId), eq(investmentAssets.userId, userId)))
    .get();
}

export function summarizeInvestmentsForUser(userId: string) {
  const rows = db
    .select({
      market: investmentAssets.marketValuePlnMinor,
      cost: investmentAssets.costBasisPlnMinor,
    })
    .from(investmentAssets)
    .where(eq(investmentAssets.userId, userId))
    .all();

  const totalMarket = rows.reduce((sum, row) => sum + row.market, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);

  return {
    totalMarketPlnMinor: totalMarket,
    totalCostPlnMinor: totalCost,
    pnlPlnMinor: totalMarket - totalCost,
  };
}

export function createInvestmentAsset(input: {
  userId: string;
  name: string;
  ticker?: string;
  type: string;
  marketValuePlnMinor: number;
  costBasisPlnMinor: number;
}) {
  const now = nowIso();

  db.insert(investmentAssets)
    .values({
      id: createId("inv"),
      userId: input.userId,
      name: input.name,
      ticker: input.ticker?.trim() || null,
      type: input.type,
      quantity: 0,
      costBasisPlnMinor: input.costBasisPlnMinor,
      marketValuePlnMinor: input.marketValuePlnMinor,
      targetAllocationPercent: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

export function deleteInvestmentAssetForUser(userId: string, assetId: string) {
  const result = db
    .delete(investmentAssets)
    .where(and(eq(investmentAssets.id, assetId), eq(investmentAssets.userId, userId)))
    .run();

  if (result.changes === 0) {
    throw new Error("Pozycja nie zostala znaleziona.");
  }
}

export function listOperationsForAsset(userId: string, assetId: string, limit = 50) {
  return db
    .select()
    .from(investmentOperations)
    .where(
      and(
        eq(investmentOperations.userId, userId),
        eq(investmentOperations.investmentAssetId, assetId),
      ),
    )
    .orderBy(desc(investmentOperations.operationDate), desc(investmentOperations.createdAt))
    .limit(limit)
    .all();
}

function clampNonNegative(value: number) {
  return Math.max(0, value);
}

export function insertInvestmentOperation(input: {
  userId: string;
  assetId: string;
  type: InvestmentOperationType;
  operationDate: string;
  amountPlnMinor: number;
  feePlnMinor: number;
  quantityDelta: number;
  note?: string;
}) {
  const asset = getInvestmentAssetForUser(input.userId, input.assetId);

  if (!asset) {
    throw new Error("Aktywo nie zostalo znalezione.");
  }

  let cost = asset.costBasisPlnMinor;
  let market = asset.marketValuePlnMinor;
  let quantity = asset.quantity;
  const fee = input.feePlnMinor;
  const amt = input.amountPlnMinor;
  const qd = input.quantityDelta;

  switch (input.type) {
    case "valuation_update":
      market = amt;
      break;
    case "buy":
      cost += amt + fee;
      market += amt + fee;
      quantity += qd;
      break;
    case "dividend":
      market += amt;
      break;
    case "deposit":
      cost += amt;
      market += amt;
      break;
    case "withdrawal":
      cost = clampNonNegative(cost - amt);
      market = clampNonNegative(market - amt);
      break;
    case "sell":
      market = clampNonNegative(market - amt);
      cost = clampNonNegative(cost - amt);
      quantity += qd;
      break;
    default: {
      const _exhaustive: never = input.type;
      throw new Error(`Nieobslugiwany typ operacji: ${_exhaustive}`);
    }
  }

  const now = nowIso();
  const opId = createId("iop");

  db.transaction(() => {
    db.insert(investmentOperations)
      .values({
        id: opId,
        userId: input.userId,
        investmentAssetId: input.assetId,
        type: input.type,
        operationDate: input.operationDate,
        quantityDelta: qd,
        amountPlnMinor: amt,
        feePlnMinor: fee,
        note: input.note?.trim() || null,
        createdAt: now,
      })
      .run();

    db.update(investmentAssets)
      .set({
        costBasisPlnMinor: cost,
        marketValuePlnMinor: market,
        quantity,
        updatedAt: now,
      })
      .where(and(eq(investmentAssets.id, input.assetId), eq(investmentAssets.userId, input.userId)))
      .run();
  });
}

export function getActiveStrategyForUser(userId: string) {
  const active = db
    .select()
    .from(investmentStrategies)
    .where(and(eq(investmentStrategies.userId, userId), eq(investmentStrategies.isActive, true)))
    .orderBy(desc(investmentStrategies.updatedAt))
    .get();

  if (active) {
    return active;
  }

  return db
    .select()
    .from(investmentStrategies)
    .where(eq(investmentStrategies.userId, userId))
    .orderBy(desc(investmentStrategies.updatedAt))
    .get();
}

export function saveActiveStrategyForUser(input: {
  userId: string;
  name: string;
  rules: StrategyRulesV1;
}) {
  const now = nowIso();
  const id = createId("ist");

  db.transaction(() => {
    db.update(investmentStrategies)
      .set({ isActive: false, updatedAt: now })
      .where(eq(investmentStrategies.userId, input.userId))
      .run();

    db.insert(investmentStrategies)
      .values({
        id,
        userId: input.userId,
        name: input.name,
        isActive: true,
        rulesJson: JSON.stringify(input.rules),
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });
}

export function listRecentOperationsForUser(userId: string, limit = 40) {
  return db
    .select({
      id: investmentOperations.id,
      type: investmentOperations.type,
      operationDate: investmentOperations.operationDate,
      amountPlnMinor: investmentOperations.amountPlnMinor,
      feePlnMinor: investmentOperations.feePlnMinor,
      quantityDelta: investmentOperations.quantityDelta,
      note: investmentOperations.note,
      assetName: investmentAssets.name,
    })
    .from(investmentOperations)
    .innerJoin(investmentAssets, eq(investmentOperations.investmentAssetId, investmentAssets.id))
    .where(eq(investmentOperations.userId, userId))
    .orderBy(desc(investmentOperations.createdAt))
    .limit(limit)
    .all();
}
