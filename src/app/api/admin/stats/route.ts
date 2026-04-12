import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { verifyAdminKey } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

interface SessionData {
  sessionId: string;
  interviewId?: string;
  nickname: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  messages: {
    role: string;
    content: string;
    responseTimeMs?: number;
    mode?: string;
  }[];
  summary?: {
    topicsDiscussed?: string[];
    deepDives?: string[];
    couldExploreMore?: string[];
    notMentioned?: string[];
  };
}

export async function GET(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const baseDir = path.join(process.cwd(), "data", "sessions");
  const sessions: SessionData[] = [];

  try {
    const nicknames = await readdir(baseDir);

    for (const nickname of nicknames) {
      const nicknameDir = path.join(baseDir, nickname);
      const dirStat = await stat(nicknameDir);
      if (!dirStat.isDirectory()) continue;

      const files = await readdir(nicknameDir);
      for (const file of files.filter((f) => f.endsWith(".json"))) {
        try {
          const content = await readFile(path.join(nicknameDir, file), "utf-8");
          sessions.push(JSON.parse(content));
        } catch (error) {
          logger.error("Failed to parse session for stats", error);
        }
      }
    }
  } catch (error) {
    logger.error("Failed to read sessions for stats", error);
  }

  // 통계 계산
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.summary || (s.startedAt && (Date.now() - new Date(s.startedAt).getTime()) / 1000 >= 3600));
  const inProgressSessions = totalSessions - completedSessions.length;

  // 평균 소요 시간
  const durations = sessions.map((s) => s.durationSeconds).filter((d) => d > 0);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
  const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

  // 메시지 통계
  const messageCounts = sessions.map((s) => s.messages?.length ?? 0);
  const avgMessages = messageCounts.length > 0 ? Math.round(messageCounts.reduce((a, b) => a + b, 0) / messageCounts.length) : 0;
  const totalMessages = messageCounts.reduce((a, b) => a + b, 0);

  // 응답 속도 (user 메시지의 responseTimeMs)
  const responseTimes: number[] = [];
  for (const s of sessions) {
    for (const m of s.messages ?? []) {
      if (m.role === "user" && m.responseTimeMs && m.responseTimeMs > 0) {
        responseTimes.push(m.responseTimeMs);
      }
    }
  }
  const avgResponseTime = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;

  // 모드 사용 분포
  const modeCount: Record<string, number> = { chat: 0, voice: 0, code: 0 };
  for (const s of sessions) {
    for (const m of s.messages ?? []) {
      if (m.role === "user" && m.mode) {
        modeCount[m.mode] = (modeCount[m.mode] ?? 0) + 1;
      }
    }
  }

  // 주제 분포 (summary.topicsDiscussed)
  const topicCount: Record<string, number> = {};
  for (const s of sessions) {
    for (const topic of s.summary?.topicsDiscussed ?? []) {
      topicCount[topic] = (topicCount[topic] ?? 0) + 1;
    }
  }
  const topTopics = Object.entries(topicCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  // 미언급 주제 분포
  const notMentionedCount: Record<string, number> = {};
  for (const s of sessions) {
    for (const topic of s.summary?.notMentioned ?? []) {
      notMentionedCount[topic] = (notMentionedCount[topic] ?? 0) + 1;
    }
  }
  const topNotMentioned = Object.entries(notMentionedCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  // 크루별 통계
  const crewStats = sessions.map((s) => ({
    nickname: s.nickname,
    durationSeconds: s.durationSeconds,
    messageCount: s.messages?.length ?? 0,
    avgResponseTimeMs: (() => {
      const times = (s.messages ?? [])
        .filter((m) => m.role === "user" && m.responseTimeMs)
        .map((m) => m.responseTimeMs!);
      return times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    })(),
    hasCompleted: !!(s.summary),
    topicsCount: s.summary?.topicsDiscussed?.length ?? 0,
  })).sort((a, b) => b.messageCount - a.messageCount);

  // 시간대별 세션 시작 분포
  const hourDistribution: number[] = new Array(24).fill(0);
  for (const s of sessions) {
    if (s.startedAt) {
      const hour = new Date(s.startedAt).getHours();
      hourDistribution[hour]++;
    }
  }

  return NextResponse.json({
    overview: {
      totalSessions,
      completedSessions: completedSessions.length,
      inProgressSessions,
      completionRate: totalSessions > 0 ? Math.round((completedSessions.length / totalSessions) * 100) : 0,
    },
    duration: {
      avgSeconds: avgDuration,
      maxSeconds: maxDuration,
      minSeconds: minDuration,
    },
    messages: {
      total: totalMessages,
      avgPerSession: avgMessages,
      avgResponseTimeMs: avgResponseTime,
    },
    modeUsage: modeCount,
    topTopics,
    topNotMentioned,
    crewStats,
    hourDistribution,
  });
}
