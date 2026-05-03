"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/db/audit";
import {
  clearTotpPendingSecret,
  disableUserTotp,
  finalizeTotpEnrollment,
  findUserById,
  updateUserTotpPendingSecret,
} from "@/db/users";
import { verifyPassword } from "@/lib/password";
import { requireUser } from "@/lib/session";
import { generateTotpSecret, verifyTotpToken } from "@/lib/totp-app";

export async function startTotpEnrollmentAction() {
  const user = await requireUser();

  if (user.totpEnabled) {
    redirect("/settings/security?error=already");
  }

  const secret = generateTotpSecret();

  updateUserTotpPendingSecret(user.id, secret);

  recordAuditEvent({
    userId: user.id,
    action: "totp_enrollment_started",
  });

  revalidatePath("/settings/security");
  redirect("/settings/security");
}

export async function cancelTotpEnrollmentAction() {
  const user = await requireUser();

  clearTotpPendingSecret(user.id);

  recordAuditEvent({
    userId: user.id,
    action: "totp_enrollment_cancelled",
  });

  revalidatePath("/settings/security");
  redirect("/settings/security");
}

export async function confirmTotpEnrollmentAction(formData: FormData) {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "").trim();

  if (!code) {
    redirect("/settings/security?error=missing_code");
  }

  const latest = findUserById(user.id);

  if (!latest?.totpPendingSecret) {
    redirect("/settings/security?error=no_pending");
  }

  if (!verifyTotpToken(latest.totpPendingSecret, code)) {
    recordAuditEvent({
      userId: user.id,
      action: "totp_enrollment_failed",
      meta: { reason: "invalid_token" },
    });
    redirect("/settings/security?error=bad_token");
  }

  finalizeTotpEnrollment(user.id);

  recordAuditEvent({
    userId: user.id,
    action: "totp_enabled",
  });

  revalidatePath("/settings/security");
  revalidatePath("/dashboard");
  redirect("/settings/security?saved=1");
}

export async function disableTotpAction(formData: FormData) {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");
  const token = String(formData.get("token") ?? "").trim();

  if (!password || !token) {
    redirect("/settings/security?error=disable_missing");
  }

  const latest = findUserById(user.id);

  if (!latest?.totpSecret || !latest.totpEnabled) {
    redirect("/settings/security?error=no_totp");
  }

  const passwordOk = await verifyPassword(password, latest.passwordHash);

  if (!passwordOk) {
    recordAuditEvent({
      userId: user.id,
      action: "totp_disable_failure",
      meta: { reason: "bad_password" },
    });
    redirect("/settings/security?error=bad_password");
  }

  if (!verifyTotpToken(latest.totpSecret, token)) {
    recordAuditEvent({
      userId: user.id,
      action: "totp_disable_failure",
      meta: { reason: "invalid_token" },
    });
    redirect("/settings/security?error=bad_totp");
  }

  disableUserTotp(user.id);

  recordAuditEvent({
    userId: user.id,
    action: "totp_disabled",
  });

  revalidatePath("/settings/security");
  revalidatePath("/dashboard");
  redirect("/settings/security?disabled=1");
}
