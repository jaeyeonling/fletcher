import { NextRequest, NextResponse } from "next/server";

export function verifyAdminKey(req: NextRequest): NextResponse | null {
  const key =
    req.headers.get("x-admin-key") ??
    req.nextUrl.searchParams.get("key");

  if (!process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "ADMIN_KEY not configured" }, { status: 500 });
  }

  if (key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // 인증 성공
}
