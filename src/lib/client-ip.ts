import { createHmac } from "node:crypto";
import { headers } from "next/headers";

function hashIp(ip: string): string {
  const secret = process.env.SESSION_SECRET ?? "local-dev";

  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

export async function getClientIpHash(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");

  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();

    if (first) {
      return hashIp(first);
    }
  }

  const realIp = headerStore.get("x-real-ip")?.trim();

  if (realIp) {
    return hashIp(realIp);
  }

  return hashIp("unknown");
}
