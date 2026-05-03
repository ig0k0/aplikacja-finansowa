"use server";

import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/db/audit";
import { destroySession, getCurrentUser } from "@/lib/session";

export async function logoutAction() {
  const user = await getCurrentUser();

  if (user) {
    recordAuditEvent({ userId: user.id, action: "logout" });
  }

  await destroySession();
  redirect("/login");
}
