"use server";

import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/db/audit";
import {
  deleteTotpLoginPending,
  findValidTotpLoginPending,
  registerTotpLoginFailure,
} from "@/db/totp-login";
import { findUserById, markTotpStepUsed } from "@/db/users";
import { getClientIpHash } from "@/lib/client-ip";
import { clearLoginFailures, isLoginAllowed, recordLoginFailure } from "@/lib/login-rate-limit";
import { createSession } from "@/lib/session";
import { checkTotpToken } from "@/lib/totp-app";

function redirectTotpError(pendingId: string, code: string): never {
  redirect(`/login/totp?pending=${encodeURIComponent(pendingId)}&error=${code}`);
}

export async function completeTotpLoginAction(formData: FormData) {
  const pendingId = String(formData.get("pendingId") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();

  if (!pendingId || !token) {
    if (pendingId) {
      redirectTotpError(pendingId, "missing");
    }
    redirect("/login");
  }

  const userId = findValidTotpLoginPending(pendingId);

  if (!userId) {
    recordAuditEvent({
      userId: null,
      action: "login_totp_failure",
      meta: { reason: "expired_or_invalid_pending" },
    });
    redirect("/login/totp?error=expired");
  }

  const user = findUserById(userId);

  if (!user?.totpSecret || !user.totpEnabled) {
    deleteTotpLoginPending(pendingId);
    redirect("/login");
  }

  const ipHash = await getClientIpHash();

  // Bledne kody licza sie do tego samego limitu co bledne hasla, wiec ponowne
  // przechodzenie przez haslo nie daje kolejnych prob zgadywania kodu.
  if (!isLoginAllowed(user.login, ipHash)) {
    deleteTotpLoginPending(pendingId);
    recordAuditEvent({
      userId: user.id,
      action: "login_totp_failure",
      meta: { reason: "rate_limited" },
    });
    redirect("/login?error=rate_limited");
  }

  const check = checkTotpToken(user.totpSecret, token, user.totpLastUsedStep);

  if (!check.valid) {
    recordLoginFailure(user.login, ipHash);
    recordAuditEvent({
      userId: user.id,
      action: "login_totp_failure",
      meta: { reason: "invalid_token" },
    });

    if (!registerTotpLoginFailure(pendingId)) {
      redirect("/login?error=totp_locked");
    }

    redirectTotpError(pendingId, "invalid");
  }

  deleteTotpLoginPending(pendingId);
  markTotpStepUsed(user.id, check.timeStep);
  clearLoginFailures(user.login);

  recordAuditEvent({
    userId: user.id,
    action: "login_success",
  });

  await createSession(user.id);
  redirect("/dashboard");
}
