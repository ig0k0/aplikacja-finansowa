"use server";

import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/db/audit";
import { createLoginTotpPending } from "@/db/totp-login";
import { getClientIpHash } from "@/lib/client-ip";
import {
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/login-rate-limit";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const ipHash = await getClientIpHash();

  try {
    assertLoginAllowed(login, ipHash);
  } catch {
    recordAuditEvent({
      userId: null,
      action: "login_failure",
      meta: { reason: "rate_limited" },
    });
    redirect("/login?error=rate_limited");
  }

  if (!login || !password) {
    recordAuditEvent({
      userId: null,
      action: "login_failure",
      meta: { reason: "missing_fields" },
    });
    recordLoginFailure(login, ipHash);
    redirect("/login?error=missing");
  }

  const { findUserByLogin } = await import("@/db/users");
  const user = findUserByLogin(login);

  if (!user) {
    recordLoginFailure(login, ipHash);
    recordAuditEvent({
      userId: null,
      action: "login_failure",
      meta: { reason: "invalid_credentials" },
    });
    redirect("/login?error=invalid");
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    recordLoginFailure(login, ipHash);
    recordAuditEvent({
      userId: user.id,
      action: "login_failure",
      meta: { reason: "invalid_credentials" },
    });
    redirect("/login?error=invalid");
  }

  clearLoginFailures(login, ipHash);

  if (user.totpEnabled && user.totpSecret) {
    const pendingId = createLoginTotpPending(user.id);

    redirect(`/login/totp?pending=${encodeURIComponent(pendingId)}`);
  }

  recordAuditEvent({
    userId: user.id,
    action: "login_success",
  });

  await createSession(user.id);
  redirect("/dashboard");
}
