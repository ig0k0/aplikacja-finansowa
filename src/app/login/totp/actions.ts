"use server";

import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/db/audit";
import { deleteTotpLoginPending, findValidTotpLoginPending } from "@/db/totp-login";
import { findUserById } from "@/db/users";
import { createSession } from "@/lib/session";
import { verifyTotpToken } from "@/lib/totp-app";

function redirectTotpError(pendingId: string, code: string): never {
  redirect(`/login/totp?pending=${encodeURIComponent(pendingId)}&error=${code}`);
}

export async function completeTotpLoginAction(formData: FormData) {
  const pendingId = String(formData.get("pendingId") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();

  if (!pendingId || !token) {
    recordAuditEvent({
      userId: null,
      action: "login_totp_failure",
      meta: { reason: "missing_fields" },
    });
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
    redirectTotpError(pendingId, "invalid");
  }

  if (!verifyTotpToken(user.totpSecret, token)) {
    recordAuditEvent({
      userId: user.id,
      action: "login_totp_failure",
      meta: { reason: "invalid_token" },
    });
    redirectTotpError(pendingId, "invalid");
  }

  deleteTotpLoginPending(pendingId);

  recordAuditEvent({
    userId: user.id,
    action: "login_success",
  });

  await createSession(user.id);
  redirect("/dashboard");
}
