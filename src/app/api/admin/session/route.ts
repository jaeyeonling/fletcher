import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile, rm } from "fs/promises";
import path from "path";
import { verifyAdminKey } from "@/lib/admin-auth";
import { sanitizeNickname, isValidId } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

// GET: 특정 세션 상세 조회
export async function GET(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;
  const nickname = req.nextUrl.searchParams.get("nickname");
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!nickname || !sessionId) {
    return NextResponse.json({ error: "nickname and sessionId required" }, { status: 400 });
  }
  if (!isValidId(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  const sanitized = sanitizeNickname(nickname);
  const filepath = path.join(process.cwd(), "data", "sessions", sanitized, `${sessionId}.json`);

  try {
    const content = await readFile(filepath, "utf-8");
    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    logger.error("Failed to read session detail", error);
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
}

// DELETE: 특정 세션 삭제
export async function DELETE(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;
  const { nickname, sessionId } = (await req.json()) as {
    nickname: string;
    sessionId: string;
  };

  if (!nickname || !sessionId) {
    return NextResponse.json({ error: "nickname and sessionId required" }, { status: 400 });
  }

  const sanitized = sanitizeNickname(nickname);
  const filepath = path.join(process.cwd(), "data", "sessions", sanitized, `${sessionId}.json`);

  try {
    await rm(filepath);

    // 디렉토리가 비어있으면 삭제
    const dir = path.join(process.cwd(), "data", "sessions", sanitized);
    const remaining = await readdir(dir);
    if (remaining.length === 0) {
      await rm(dir, { recursive: true });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error("Failed to delete session", error);
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
}
