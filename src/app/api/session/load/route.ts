import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const findLatest = db.prepare(`
  SELECT * FROM sessions
  WHERE nickname = ? AND (? IS NULL OR interview_id = ?)
  ORDER BY created_at DESC
  LIMIT 1
`);

export async function GET(req: NextRequest) {
  const nickname = req.nextUrl.searchParams.get("nickname");
  const interviewId = req.nextUrl.searchParams.get("interviewId");

  if (!nickname) {
    return NextResponse.json({ error: "nickname required" }, { status: 400 });
  }

  const row = findLatest.get(nickname, interviewId, interviewId) as Record<string, unknown> | undefined;

  if (!row) {
    return NextResponse.json({ session: null });
  }

  return NextResponse.json({
    session: {
      sessionId: row.id,
      interviewId: row.interview_id,
      nickname: row.nickname,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationSeconds: row.duration_seconds,
      messages: JSON.parse((row.messages as string) ?? "[]"),
      events: JSON.parse((row.events as string) ?? "[]"),
      summary: row.summary ? JSON.parse(row.summary as string) : null,
    },
  });
}
