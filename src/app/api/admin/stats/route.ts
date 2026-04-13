import { NextRequest, NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/admin-auth";
import db from "@/lib/db";

const listSessions = db.prepare("SELECT * FROM sessions");

export async function GET(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const rows = listSessions.all() as Record<string, unknown>[];

  const sessions = rows.map((row) => ({
    nickname: row.nickname as string,
    startedAt: row.started_at as string,
    durationSeconds: row.duration_seconds as number,
    messages: JSON.parse((row.messages as string) ?? "[]") as {
      role: string;
      responseTimeMs?: number;
      mode?: string;
    }[],
    summary: row.summary ? JSON.parse(row.summary as string) : null,
  }));

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.summary || (s.startedAt && (Date.now() - new Date(s.startedAt).getTime()) / 1000 >= 3600));

  const durations = sessions.map((s) => s.durationSeconds).filter((d) => d > 0);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  const messageCounts = sessions.map((s) => s.messages.length);
  const avgMessages = messageCounts.length > 0 ? Math.round(messageCounts.reduce((a, b) => a + b, 0) / messageCounts.length) : 0;

  const responseTimes: number[] = [];
  const modeCount: Record<string, number> = { chat: 0, voice: 0, code: 0 };
  for (const s of sessions) {
    for (const m of s.messages) {
      if (m.role === "user" && m.responseTimeMs && m.responseTimeMs > 0) responseTimes.push(m.responseTimeMs);
      if (m.role === "user" && m.mode) modeCount[m.mode] = (modeCount[m.mode] ?? 0) + 1;
    }
  }

  const topicCount: Record<string, number> = {};
  const notMentionedCount: Record<string, number> = {};
  for (const s of sessions) {
    for (const t of s.summary?.topicsDiscussed ?? []) topicCount[t] = (topicCount[t] ?? 0) + 1;
    for (const t of s.summary?.notMentioned ?? []) notMentionedCount[t] = (notMentionedCount[t] ?? 0) + 1;
  }

  const hourDistribution: number[] = new Array(24).fill(0);
  for (const s of sessions) {
    if (s.startedAt) hourDistribution[new Date(s.startedAt).getHours()]++;
  }

  const crewStats = sessions.map((s) => {
    const times = s.messages.filter((m) => m.role === "user" && m.responseTimeMs).map((m) => m.responseTimeMs!);
    return {
      nickname: s.nickname,
      durationSeconds: s.durationSeconds,
      messageCount: s.messages.length,
      avgResponseTimeMs: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      hasCompleted: !!s.summary,
      topicsCount: s.summary?.topicsDiscussed?.length ?? 0,
    };
  }).sort((a, b) => b.messageCount - a.messageCount);

  return NextResponse.json({
    overview: {
      totalSessions,
      completedSessions: completedSessions.length,
      inProgressSessions: totalSessions - completedSessions.length,
      completionRate: totalSessions > 0 ? Math.round((completedSessions.length / totalSessions) * 100) : 0,
    },
    duration: {
      avgSeconds: avgDuration,
      maxSeconds: durations.length > 0 ? Math.max(...durations) : 0,
      minSeconds: durations.length > 0 ? Math.min(...durations) : 0,
    },
    messages: {
      total: messageCounts.reduce((a, b) => a + b, 0),
      avgPerSession: avgMessages,
      avgResponseTimeMs: responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0,
    },
    modeUsage: modeCount,
    topTopics: Object.entries(topicCount).sort(([, a], [, b]) => b - a).slice(0, 10),
    topNotMentioned: Object.entries(notMentionedCount).sort(([, a], [, b]) => b - a).slice(0, 10),
    crewStats,
    hourDistribution,
  });
}
