import { NextRequest, NextResponse } from "next/server";
import { isValidId } from "@/lib/sanitize";
import db from "@/lib/db";
import { logger } from "@/lib/logger";

interface SessionData {
  sessionId: string;
  interviewId?: string;
  nickname: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  messages: unknown[];
  events?: unknown[];
  summary?: unknown;
}

const upsert = db.prepare(`
  INSERT INTO sessions (id, interview_id, nickname, started_at, completed_at, duration_seconds, messages, events, summary)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    completed_at = excluded.completed_at,
    duration_seconds = excluded.duration_seconds,
    messages = excluded.messages,
    events = excluded.events,
    summary = COALESCE(excluded.summary, sessions.summary)
`);

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as SessionData;

    if (!data.nickname || !data.sessionId) {
      return NextResponse.json({ error: "nickname and sessionId required" }, { status: 400 });
    }
    if (!isValidId(data.sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    upsert.run(
      data.sessionId,
      data.interviewId ?? null,
      data.nickname,
      data.startedAt,
      data.completedAt,
      data.durationSeconds,
      JSON.stringify(data.messages ?? []),
      JSON.stringify(data.events ?? []),
      data.summary ? JSON.stringify(data.summary) : null,
    );

    return NextResponse.json({ saved: true });
  } catch (error) {
    logger.error("Failed to save session", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
