import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import type { User } from "@/db/schema";
import { useSecureSessionCookies } from "./cookie-security";
import { createId } from "./ids";
import { nowIso } from "./time";

const sessionCookieName = "cfo_session";
const sessionDurationMs = 1000 * 60 * 60 * 24 * 14;

function hashSessionToken(token: string) {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is required for local sessions.");
  }

  return createHmac("sha256", secret).update(token).digest("hex");
}

export async function createSession(userId: string) {
  const [{ db }, { sessions }] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
  ]);
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + sessionDurationMs).toISOString();

  db.insert(sessions)
    .values({
      id: createId("ses"),
      userId,
      tokenHash,
      expiresAt,
      createdAt: nowIso(),
    })
    .run();

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureSessionCookies(),
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const now = nowIso();
  const [{ db }, { sessions, users }] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
  ]);

  const row = db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .get();

  return row?.user ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (token) {
    const [{ db }, { sessions }] = await Promise.all([
      import("@/db/client"),
      import("@/db/schema"),
    ]);

    db.delete(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(token)))
      .run();
  }

  cookieStore.delete(sessionCookieName);
}
