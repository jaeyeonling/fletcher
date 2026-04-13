import { NextRequest, NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/admin-auth";
import db from "@/lib/db";

const listAll = db.prepare(`
  SELECT id, interview_id, nickname, started_at, completed_at, duration_seconds, messages, summary
  FROM sessions
  ORDER BY created_at DESC
`);

export async function GET(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const rows = listAll.all() as Record<string, unknown>[];

  const sessions = rows.map((row) => {
    const messages = JSON.parse((row.messages as string) ?? "[]");
    const hasSummary = !!(
      row.summary ||
      (row.started_at && (Date.now() - new Date(row.started_at as string).getTime()) / 1000 >= 3600)
    );

    return {
      sessionId: row.id,
      nickname: row.nickname,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationSeconds: row.duration_seconds,
      messageCount: messages.length,
      hasSummary,
    };
  });

  return NextResponse.json({ sessions });
}
