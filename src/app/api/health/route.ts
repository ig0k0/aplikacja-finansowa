import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "centrum-finansow-osobistych",
    timestamp: new Date().toISOString(),
  });
}
