import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function applySecurityHeaders(request: NextRequest, response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  const proto =
    request.headers.get("x-forwarded-proto") ??
    (process.env.TRUST_PROXY === "1" ? "https" : request.nextUrl.protocol.replace(":", ""));

  if (proto === "https" || process.env.FORCE_HSTS === "1") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  applySecurityHeaders(request, response);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
