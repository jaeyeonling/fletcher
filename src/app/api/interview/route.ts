import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_MESSAGES } from "@/lib/interview-config";
import db from "@/lib/db";

const findBySlug = db.prepare("SELECT * FROM interviews WHERE slug = ? AND active = 1");

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const row = findBySlug.get(slug) as Record<string, unknown> | undefined;
  if (!row) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  // 마감 기한 체크
  const deadline = row.deadline as string | null;
  if (deadline && new Date(deadline).getTime() < Date.now()) {
    return NextResponse.json({ error: "이 인터뷰는 마감되었습니다.", expired: true }, { status: 410 });
  }

  return NextResponse.json({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    curriculum: row.curriculum,
    firstMessage: row.first_message,
    timeLimitMinutes: row.time_limit_minutes,
    messages: { ...DEFAULT_MESSAGES, ...JSON.parse((row.messages as string) ?? "{}") },
    warningMinutes: JSON.parse((row.warning_minutes as string) ?? "[30,50,55,59]"),
    deadline,
  });
}
