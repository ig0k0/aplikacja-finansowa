/** Czy sesja ma flagę Secure (HTTPS). Za proxy: ustaw COOKIE_SECURE=1. */
export function useSecureSessionCookies(): boolean {
  if (process.env.COOKIE_SECURE === "1") {
    return true;
  }

  if (process.env.COOKIE_SECURE === "0") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}
