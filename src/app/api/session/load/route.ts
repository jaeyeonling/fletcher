import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { sanitizeNickname } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const nickname = req.nextUrl.searchParams.get("nickname");
  const interviewId = req.nextUrl.searchParams.get("interviewId");

  if (!nickname) {
    return NextResponse.json({ error: "nickname required" }, { status: 400 });
  }

  const sanitized = sanitizeNickname(nickname);
  const dir = path.join(process.cwd(), "data", "sessions", sanitized);

  try {
    const files = await readdir(dir);
    const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

    if (jsonFiles.length === 0) {
      return NextResponse.json({ session: null });
    }

    // interviewId가 있으면 해당 인터뷰의 최신 세션만, 없으면 전체 최신 세션
    for (let i = jsonFiles.length - 1; i >= 0; i--) {
      const content = await readFile(path.join(dir, jsonFiles[i]), "utf-8");
      const session = JSON.parse(content);

      if (interviewId && session.interviewId !== interviewId) continue;

      return NextResponse.json({ session });
    }

    return NextResponse.json({ session: null });
  } catch (error) {
    logger.error("Failed to load session", error);
    return NextResponse.json({ session: null });
  }
}
