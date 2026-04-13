import { NextRequest, NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/admin-auth";
import { isValidId } from "@/lib/sanitize";
import db from "@/lib/db";

const findById = db.prepare("SELECT * FROM sessions WHERE id = ?");
const deleteById = db.prepare("DELETE FROM sessions WHERE id = ?");

// GET: 특정 세션 상세 조회
export async function GET(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId || !isValidId(sessionId)) {
    return NextResponse.json({ error: "Valid sessionId required" }, { status: 400 });
  }

  const row = findById.get(sessionId) as Record<string, unknown> | undefined;
  if (!row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: row.id,
    nickname: row.nickname,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    messages: JSON.parse((row.messages as string) ?? "[]"),
    events: JSON.parse((row.events as string) ?? "[]"),
    summary: row.summary ? JSON.parse(row.summary as string) : null,
  });
}

// DELETE: 세션 삭제
export async function DELETE(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const { sessionId } = (await req.json()) as { sessionId: string };
  if (!sessionId || !isValidId(sessionId)) {
    return NextResponse.json({ error: "Valid sessionId required" }, { status: 400 });
  }

  const result = deleteById.run(sessionId);
  return NextResponse.json({ deleted: result.changes > 0 });
}
