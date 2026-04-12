import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { sanitizeNickname, isValidId } from "@/lib/sanitize";

interface SessionData {
  sessionId: string;
  nickname: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  messages: {
    role: string;
    content: string;
    timestamp: string;
    responseTimeMs?: number;
  }[];
  evaluation?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as SessionData;

    if (!data.nickname || !data.sessionId) {
      return NextResponse.json({ error: "nickname and sessionId required" }, { status: 400 });
    }

    if (!isValidId(data.sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    const nickname = sanitizeNickname(data.nickname);
    const dir = path.join(process.cwd(), "data", "sessions", nickname);
    await mkdir(dir, { recursive: true });

    const filename = `${data.sessionId}.json`;
    const filepath = path.join(dir, filename);

    await writeFile(filepath, JSON.stringify(data, null, 2), "utf-8");

    return NextResponse.json({ saved: true, path: `data/sessions/${nickname}/${filename}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
