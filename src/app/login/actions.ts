"use server";

import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/db/audit";
import { createLoginTotpPending } from "@/db/totp-login";
import { getClientIpHash } from "@/lib/client-ip";
import { clearLoginFailures, isLoginAllowed, recordLoginFailure } from "@/lib/login-rate-limit";
import { verifyPassword, verifyPasswordAgainstDummy } from "@/lib/password";
import { createSession } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const ipHash = await getClientIpHash();

  if (!login || !password) {
    redirect("/login?error=missing");
  }

  if (!isLoginAllowed(login, ipHash)) {
    // Zablokowane proby nie sa zapisywane, zeby zalew zadan nie zapychal bazy.
    redirect("/login?error=rate_limited");
  }

  const { findUserByLogin } = await import("@/db/users");
  const user = findUserByLogin(login);

  // Dla nieistniejacego loginu liczymy skrot "na pusto", zeby czas odpowiedzi
  // nie zdradzal, czy konto istnieje.
  const isValid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPasswordAgainstDummy(password);

  if (!user || !isValid) {
    recordLoginFailure(login, ipHash);
    recordAuditEvent({
      userId: user?.id ?? null,
      action: "login_failure",
      meta: { reason: "invalid_credentials" },
    });
    redirect("/login?error=invalid");
  }

  if (user.totpEnabled && user.totpSecret) {
    // Licznik bledow zerujemy dopiero po poprawnym kodzie TOTP.
    const pendingId = createLoginTotpPending(user.id);

    redirect(`/login/totp?pending=${encodeURIComponent(pendingId)}`);
  }

  clearLoginFailures(login);

  recordAuditEvent({
    userId: user.id,
    action: "login_success",
  });

  await createSession(user.id);
  redirect("/dashboard");
}
