"use server";

import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/db/audit";
import { createLoginTotpPending } from "@/db/totp-login";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!login || !password) {
    recordAuditEvent({
      userId: null,
      action: "login_failure",
      meta: { reason: "missing_fields" },
    });
    redirect("/login?error=missing");
  }

  const { findUserByLogin } = await import("@/db/users");
  const user = findUserByLogin(login);

  if (!user) {
    recordAuditEvent({
      userId: null,
      action: "login_failure",
      meta: { reason: "invalid_credentials" },
    });
    redirect("/login?error=invalid");
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    recordAuditEvent({
      userId: user.id,
      action: "login_failure",
      meta: { reason: "invalid_credentials" },
    });
    redirect("/login?error=invalid");
  }

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
