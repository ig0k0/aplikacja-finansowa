"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/db/audit";
import {
  clearTotpPendingSecret,
  disableUserTotp,
  finalizeTotpEnrollment,
  findUserById,
  markTotpStepUsed,
  updateUserPasswordHash,
  updateUserTotpPendingSecret,
} from "@/db/users";
import { getClientIpHash } from "@/lib/client-ip";
import { isLoginAllowed, recordLoginFailure } from "@/lib/login-rate-limit";
import { hashPassword, validateNewPassword, verifyPassword } from "@/lib/password";
import { destroyOtherSessions, requireUser } from "@/lib/session";
import { checkTotpToken, generateTotpSecret, verifyTotpToken } from "@/lib/totp-app";

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

  const ipHash = await getClientIpHash();

  if (!isLoginAllowed(latest.login, ipHash)) {
    redirect("/settings/security?error=rate_limited");
  }

  const passwordOk = await verifyPassword(password, latest.passwordHash);

  if (!passwordOk) {
    recordLoginFailure(latest.login, ipHash);
    recordAuditEvent({
      userId: user.id,
      action: "totp_disable_failure",
      meta: { reason: "bad_password" },
    });
    redirect("/settings/security?error=bad_password");
  }

  // Kod jest jednorazowy: ten sam, ktory posluzyl do logowania, nie wylaczy 2FA.
  if (!checkTotpToken(latest.totpSecret, token, latest.totpLastUsedStep).valid) {
    recordLoginFailure(latest.login, ipHash);
    recordAuditEvent({
      userId: user.id,
      action: "totp_disable_failure",
      meta: { reason: "invalid_token" },
    });
    redirect("/settings/security?error=bad_totp");
  }

  disableUserTotp(user.id);
  await destroyOtherSessions(user.id);

  recordAuditEvent({
    userId: user.id,
    action: "totp_disabled",
  });

  revalidatePath("/settings/security");
  revalidatePath("/dashboard");
  redirect("/settings/security?disabled=1");
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const newPasswordRepeat = String(formData.get("newPasswordRepeat") ?? "");
  const token = String(formData.get("token") ?? "").trim();

  if (!currentPassword || !newPassword) {
    redirect("/settings/security?error=password_missing");
  }

  if (newPassword !== newPasswordRepeat) {
    redirect("/settings/security?error=password_mismatch");
  }

  if (validateNewPassword(newPassword)) {
    redirect("/settings/security?error=password_weak");
  }

  if (newPassword === currentPassword) {
    redirect("/settings/security?error=password_same");
  }

  const latest = findUserById(user.id);

  if (!latest) {
    redirect("/login");
  }

  const ipHash = await getClientIpHash();

  if (!isLoginAllowed(latest.login, ipHash)) {
    redirect("/settings/security?error=rate_limited");
  }

  const passwordOk = await verifyPassword(currentPassword, latest.passwordHash);
  const totpCheck =
    latest.totpEnabled && latest.totpSecret
      ? checkTotpToken(latest.totpSecret, token, latest.totpLastUsedStep)
      : null;
  const totpOk = totpCheck === null || totpCheck.valid;

  if (!passwordOk || !totpOk) {
    recordLoginFailure(latest.login, ipHash);
    recordAuditEvent({
      userId: user.id,
      action: "password_change_failure",
      meta: { reason: passwordOk ? "invalid_token" : "bad_password" },
    });
    redirect(`/settings/security?error=${passwordOk ? "bad_totp_password" : "bad_password"}`);
  }

  if (totpCheck?.valid) {
    markTotpStepUsed(user.id, totpCheck.timeStep);
  }

  updateUserPasswordHash(user.id, await hashPassword(newPassword));
  const closedSessions = await destroyOtherSessions(user.id);

  recordAuditEvent({
    userId: user.id,
    action: "password_changed",
    meta: { closedSessions },
  });

  revalidatePath("/settings/security");
  redirect("/settings/security?password=changed");
}

export async function logoutOtherSessionsAction() {
  const user = await requireUser();
  const closedSessions = await destroyOtherSessions(user.id);

  recordAuditEvent({
    userId: user.id,
    action: "sessions_revoked",
    meta: { closedSessions },
  });

  revalidatePath("/settings/security");
  redirect(`/settings/security?sessions=${closedSessions}`);
}
