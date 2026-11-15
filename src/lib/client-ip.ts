import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { requireSessionSecret } from "./secrets";

function hashIp(ip: string): string {
  return createHmac("sha256", requireSessionSecret()).update(ip).digest("hex").slice(0, 32);
}

function lastListItem(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.at(-1) ?? null;
}

/**
 * Adres klienta do limitu logowania.
 *
 * Naglowki `X-Forwarded-For` / `X-Real-IP` moze ustawic kazdy klient, wiec ufamy im
 * tylko za wlasnym reverse proxy (`TRUST_PROXY=1`). Bierzemy OSTATNI element listy,
 * bo to on jest dopisywany przez nasze proxy — pierwszy pochodzi od klienta.
 * `CLIENT_IP_HEADER` pozwala wskazac naglowek dostawcy (np. `cf-connecting-ip`).
 */
export function resolveClientIp(headerStore: { get(name: string): string | null }): string {
  if (process.env.TRUST_PROXY !== "1") {
    return "direct";
  }

  const customHeader = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();

  if (customHeader) {
    const custom = lastListItem(headerStore.get(customHeader));

    if (custom) {
      return custom;
    }
  }

  return (
    lastListItem(headerStore.get("x-forwarded-for")) ??
    lastListItem(headerStore.get("x-real-ip")) ??
    "unknown"
  );
}

export async function getClientIpHash(): Promise<string> {
  return hashIp(resolveClientIp(await headers()));
}
