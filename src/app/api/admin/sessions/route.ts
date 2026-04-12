import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { verifyAdminKey } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

interface SessionEntry {
  sessionId: string;
  nickname: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  messageCount: number;
  hasEvaluation: boolean;
  hasSummary: boolean;
}

export async function GET(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;
  const baseDir = path.join(process.cwd(), "data", "sessions");

  try {
    const nicknames = await readdir(baseDir);
    const sessions: SessionEntry[] = [];

    for (const nickname of nicknames) {
      const nicknameDir = path.join(baseDir, nickname);
      const dirStat = await stat(nicknameDir);
      if (!dirStat.isDirectory()) continue;

      const files = await readdir(nicknameDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      for (const file of jsonFiles) {
        try {
          const content = await readFile(path.join(nicknameDir, file), "utf-8");
          const data = JSON.parse(content);

          sessions.push({
            sessionId: data.sessionId ?? file.replace(".json", ""),
            nickname: data.nickname ?? nickname,
            startedAt: data.startedAt ?? "",
            completedAt: data.completedAt ?? "",
            durationSeconds: data.durationSeconds ?? 0,
            messageCount: data.messages?.length ?? 0,
            hasEvaluation: !!data.evaluation,
            hasSummary: !!(
              data.summary ||
              data.evaluation ||
              (data.startedAt && (Date.now() - new Date(data.startedAt).getTime()) / 1000 >= 3600)
            ),
          });
        } catch (error) {
          logger.error("Failed to parse session file", error);
        }
      }
    }

    // 최신순 정렬
    sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return NextResponse.json({ sessions });
  } catch (error) {
    logger.error("Failed to list sessions", error);
    return NextResponse.json({ sessions: [] });
  }
}
