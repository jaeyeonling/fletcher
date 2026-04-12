"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Users, Clock, MessageSquare, Mic, Code, TrendingUp, AlertCircle, BarChart3,
} from "lucide-react";

const ADMIN_KEY_STORAGE = "fletcher-admin-key";
function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ADMIN_KEY_STORAGE) ?? "";
}

interface Stats {
  overview: {
    totalSessions: number;
    completedSessions: number;
    inProgressSessions: number;
    completionRate: number;
  };
  duration: {
    avgSeconds: number;
    maxSeconds: number;
    minSeconds: number;
  };
  messages: {
    total: number;
    avgPerSession: number;
    avgResponseTimeMs: number;
  };
  modeUsage: Record<string, number>;
  topTopics: [string, number][];
  topNotMentioned: [string, number][];
  crewStats: {
    nickname: string;
    durationSeconds: number;
    messageCount: number;
    avgResponseTimeMs: number;
    hasCompleted: boolean;
    topicsCount: number;
  }[];
  hourDistribution: number[];
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}초`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: typeof Users;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-amber-500" />
        <span className="text-xs text-stone-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-stone-100">{value}</div>
      {sub && <div className="text-xs text-stone-600 mt-1">{sub}</div>}
    </div>
  );
}

function Bar({ value, max, label, count }: { value: number; max: number; label: string; count: number }) {
  const width = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-stone-400 w-28 truncate text-right">{label}</span>
      <div className="flex-1 h-5 bg-stone-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-600/60 rounded-full transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs text-stone-500 w-8 text-right">{count}</span>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats", { headers: { "x-admin-key": getAdminKey() } })
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((e) => console.error(e))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin w-8 h-8 border-[3px] border-stone-700 border-t-amber-500 rounded-full" />
      </div>
    );
  }

  if (!stats) return null;

  const maxTopic = stats.topTopics.length > 0 ? stats.topTopics[0][1] : 0;
  const maxNotMentioned = stats.topNotMentioned.length > 0 ? stats.topNotMentioned[0][1] : 0;
  const maxHour = Math.max(...stats.hourDistribution, 1);
  const totalModeMessages = Object.values(stats.modeUsage).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-stone-800 bg-stone-900/80 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-amber-600/30">
              <Image src="/fletcher.png" alt="F" width={32} height={32} className="object-cover object-top" />
            </div>
            <div>
              <h1 className="font-semibold text-amber-50">통계 대시보드</h1>
              <p className="text-xs text-stone-500">인터뷰 분석</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="text-xs text-stone-500 hover:text-stone-300">세션 관리</a>
            <a href="/admin/interviews" className="text-xs text-stone-500 hover:text-stone-300">인터뷰 관리</a>
            <a href="/admin/profiles" className="text-xs text-stone-500 hover:text-stone-300">크루 프로필</a>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="총 세션" value={stats.overview.totalSessions} />
          <StatCard
            icon={TrendingUp}
            label="완료율"
            value={`${stats.overview.completionRate}%`}
            sub={`${stats.overview.completedSessions} 완료 / ${stats.overview.inProgressSessions} 진행 중`}
          />
          <StatCard
            icon={Clock}
            label="평균 소요시간"
            value={formatDuration(stats.duration.avgSeconds)}
            sub={`${formatDuration(stats.duration.minSeconds)} ~ ${formatDuration(stats.duration.maxSeconds)}`}
          />
          <StatCard
            icon={MessageSquare}
            label="평균 메시지"
            value={`${stats.messages.avgPerSession}개`}
            sub={`총 ${stats.messages.total}개 메시지`}
          />
        </div>

        {/* Response time + Mode usage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-5">
            <h3 className="text-sm font-medium text-amber-400 mb-4">평균 응답 속도</h3>
            <div className="text-4xl font-bold text-stone-100">
              {(stats.messages.avgResponseTimeMs / 1000).toFixed(1)}
              <span className="text-lg text-stone-500 ml-1">초</span>
            </div>
            <p className="text-xs text-stone-600 mt-2">크루가 AI 질문에 답변하기까지 걸린 평균 시간</p>
          </div>

          <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-5">
            <h3 className="text-sm font-medium text-amber-400 mb-4">모드 사용 분포</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-stone-300">
                  <MessageSquare className="h-3.5 w-3.5" /> 텍스트
                </div>
                <span className="text-sm text-stone-400">{Math.round(((stats.modeUsage.chat ?? 0) / totalModeMessages) * 100)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-stone-300">
                  <Mic className="h-3.5 w-3.5" /> 음성
                </div>
                <span className="text-sm text-stone-400">{Math.round(((stats.modeUsage.voice ?? 0) / totalModeMessages) * 100)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-stone-300">
                  <Code className="h-3.5 w-3.5" /> 코드
                </div>
                <span className="text-sm text-stone-400">{Math.round(((stats.modeUsage.code ?? 0) / totalModeMessages) * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Topics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-5">
            <h3 className="text-sm font-medium text-amber-400 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> 자주 다뤄진 주제
            </h3>
            {stats.topTopics.length > 0 ? (
              <div className="space-y-2">
                {stats.topTopics.map(([topic, count]) => (
                  <Bar key={topic} label={topic} value={count} max={maxTopic} count={count} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-600">데이터 없음</p>
            )}
          </div>

          <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-5">
            <h3 className="text-sm font-medium text-stone-400 mb-4 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> 자주 미언급된 주제
            </h3>
            {stats.topNotMentioned.length > 0 ? (
              <div className="space-y-2">
                {stats.topNotMentioned.map(([topic, count]) => (
                  <Bar key={topic} label={topic} value={count} max={maxNotMentioned} count={count} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-600">데이터 없음</p>
            )}
          </div>
        </div>

        {/* Time distribution */}
        <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-5">
          <h3 className="text-sm font-medium text-amber-400 mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> 시간대별 세션 시작
          </h3>
          <div className="flex items-end gap-1 h-24">
            {stats.hourDistribution.map((count, hour) => (
              <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-amber-600/40 rounded-t transition-all"
                  style={{ height: `${(count / maxHour) * 100}%`, minHeight: count > 0 ? "4px" : "0px" }}
                />
                {hour % 6 === 0 && (
                  <span className="text-[9px] text-stone-600">{hour}시</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Crew ranking */}
        <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-5">
          <h3 className="text-sm font-medium text-amber-400 mb-4">크루별 통계</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-500 border-b border-stone-800">
                  <th className="text-left py-2 px-2">크루</th>
                  <th className="text-right py-2 px-2">상태</th>
                  <th className="text-right py-2 px-2">소요시간</th>
                  <th className="text-right py-2 px-2">메시지</th>
                  <th className="text-right py-2 px-2">평균 응답</th>
                  <th className="text-right py-2 px-2">주제 수</th>
                </tr>
              </thead>
              <tbody>
                {stats.crewStats.map((crew) => (
                  <tr key={crew.nickname} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                    <td className="py-2 px-2 text-stone-200">{crew.nickname}</td>
                    <td className="py-2 px-2 text-right">
                      {crew.hasCompleted ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-950/40 text-green-400">완료</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-400">진행 중</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right text-stone-400">{formatDuration(crew.durationSeconds)}</td>
                    <td className="py-2 px-2 text-right text-stone-400">{crew.messageCount}</td>
                    <td className="py-2 px-2 text-right text-stone-400">
                      {crew.avgResponseTimeMs > 0 ? `${(crew.avgResponseTimeMs / 1000).toFixed(1)}초` : "-"}
                    </td>
                    <td className="py-2 px-2 text-right text-stone-400">{crew.topicsCount || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
