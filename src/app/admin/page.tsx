"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import {
  Users, MessageSquare, Clock, Trash2, ChevronLeft, Eye, AlertCircle, Lock,
} from "lucide-react";

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

interface SessionDetail {
  sessionId: string;
  nickname: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  messages: {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    responseTimeMs?: number;
  }[];
  summary?: {
    topicsDiscussed: string[];
    deepDives: string[];
    couldExploreMore: string[];
    notMentioned: string[];
    closingMessage: string;
  };
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ADMIN_KEY_STORAGE = "fletcher-admin-key";

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [keyInput, setKeyInput] = useState("");

  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // 저장된 키 복원
  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_KEY_STORAGE);
    if (stored) {
      setAdminKey(stored);
      setIsAuthed(true);
    }
  }, []);

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", "x-admin-key": adminKey }),
    [adminKey]
  );

  const fetchSessions = useCallback(() => {
    if (!adminKey) return;
    setIsLoading(true);
    fetch("/api/admin/sessions", { headers: { "x-admin-key": adminKey } })
      .then((res) => {
        if (res.status === 401) {
          setIsAuthed(false);
          setAuthError(true);
          localStorage.removeItem(ADMIN_KEY_STORAGE);
          throw new Error("Unauthorized");
        }
        return res.json();
      })
      .then((data) => setSessions(data.sessions ?? []))
      .catch((e) => console.error(e))
      .finally(() => setIsLoading(false));
  }, [adminKey]);

  useEffect(() => {
    if (isAuthed) fetchSessions();
  }, [isAuthed, fetchSessions]);

  // 브라우저 뒤로가기 처리
  useEffect(() => {
    if (selectedSession) {
      window.history.pushState({ view: "detail" }, "");
    }

    const handlePopState = () => {
      setSelectedSession(null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedSession]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setAdminKey(keyInput.trim());
    localStorage.setItem(ADMIN_KEY_STORAGE, keyInput.trim());
    setIsAuthed(true);
    setAuthError(false);
  };

  const openSession = (entry: SessionEntry) => {
    setIsLoadingDetail(true);
    fetch(
      `/api/admin/session?nickname=${encodeURIComponent(entry.nickname)}&sessionId=${entry.sessionId}`,
      { headers: { "x-admin-key": adminKey } }
    )
      .then((res) => res.json())
      .then((data) => setSelectedSession(data))
      .catch((e) => console.error(e))
      .finally(() => setIsLoadingDetail(false));
  };

  const deleteSession = (nickname: string, sessionId: string) => {
    fetch("/api/admin/session", {
      method: "DELETE",
      headers: headers(),
      body: JSON.stringify({ nickname, sessionId }),
    })
      .then(() => {
        setDeleteConfirm(null);
        setSelectedSession(null);
        fetchSessions();
      })
      .catch((e) => console.error(e));
  };

  const goBack = () => {
    setSelectedSession(null);
    window.history.back();
  };

  // ─── 인증 화면 ──────────────────────────────
  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-6">
        <form onSubmit={handleLogin} className="w-full max-w-xs space-y-6 text-center">
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-stone-800 text-amber-500">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-amber-50">Fletcher Admin</h1>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Admin Key"
              autoFocus
              className="w-full rounded-xl border border-stone-700 bg-stone-900/80
                px-4 py-3 text-center text-stone-100
                focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600
                placeholder:text-stone-600"
            />
            {authError && (
              <p className="text-xs text-red-400">인증에 실패했습니다</p>
            )}
            <button
              type="submit"
              disabled={!keyInput.trim()}
              className="w-full rounded-xl bg-amber-600 px-4 py-3 text-white font-semibold
                hover:bg-amber-500 transition-all
                disabled:opacity-20 disabled:cursor-not-allowed"
            >
              접속
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ─── 세션 상세 뷰 ──────────────────────────
  if (selectedSession) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <header className="border-b border-stone-800 bg-stone-900/80 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={goBack}
                className="p-1.5 rounded-md text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="font-semibold text-amber-50">{selectedSession.nickname} 크루</h2>
                <p className="text-xs text-stone-500">
                  {formatDate(selectedSession.startedAt)} · {formatDuration(selectedSession.durationSeconds)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDeleteConfirm(selectedSession.sessionId)}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-md hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </button>
          </div>
        </header>

        {deleteConfirm && (
          <div className="max-w-5xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between bg-red-950/30 border border-red-900 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4" />
                이 세션을 삭제하시겠습니까?
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-md">
                  취소
                </button>
                <button
                  onClick={() => deleteSession(selectedSession.nickname, deleteConfirm)}
                  className="text-xs text-red-400 bg-red-950/50 hover:bg-red-900/50 px-3 py-1.5 rounded-md"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {selectedSession.messages.map((msg, i) => (
            <div key={i} className="flex gap-3">
              {msg.role === "assistant" ? (
                <>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden mt-0.5 ring-2 ring-amber-600/30">
                    <Image src="/fletcher.png" alt="F" width={32} height={32} className="object-cover object-top" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="prose-chat">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    <p className="text-[10px] text-stone-600 mt-1">{formatDate(msg.timestamp)}</p>
                  </div>
                </>
              ) : (
                <div className="flex-1">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-amber-600 text-white px-4 py-3 text-sm leading-relaxed">
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-1">
                    {msg.responseTimeMs && (
                      <span className="text-[10px] text-stone-600">
                        응답시간: {(msg.responseTimeMs / 1000).toFixed(1)}초
                      </span>
                    )}
                    <span className="text-[10px] text-stone-600">{formatDate(msg.timestamp)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {selectedSession.summary && (
            <div className="border-t border-stone-800 pt-6 mt-8 space-y-4">
              <h3 className="text-sm font-semibold text-amber-400">대화 요약</h3>
              {selectedSession.summary.closingMessage && (
                <p className="text-sm text-stone-400 italic">&ldquo;{selectedSession.summary.closingMessage}&rdquo;</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {selectedSession.summary.deepDives?.length > 0 && (
                  <div className="rounded-lg bg-stone-800/60 p-3">
                    <p className="text-xs font-medium text-amber-400 mb-1.5">깊이 다룬 내용</p>
                    <ul className="space-y-1">
                      {selectedSession.summary.deepDives.map((s, i) => (
                        <li key={i} className="text-xs text-stone-400">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedSession.summary.couldExploreMore?.length > 0 && (
                  <div className="rounded-lg bg-stone-800/60 p-3">
                    <p className="text-xs font-medium text-stone-400 mb-1.5">더 탐색 가능했던 부분</p>
                    <ul className="space-y-1">
                      {selectedSession.summary.couldExploreMore.map((s, i) => (
                        <li key={i} className="text-xs text-stone-500">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedSession.summary.notMentioned?.length > 0 && (
                  <div className="rounded-lg bg-stone-800/60 p-3">
                    <p className="text-xs font-medium text-stone-500 mb-1.5">언급 안 된 영역</p>
                    <ul className="space-y-1">
                      {selectedSession.summary.notMentioned.map((s, i) => (
                        <li key={i} className="text-xs text-stone-600">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedSession.summary.topicsDiscussed?.length > 0 && (
                  <div className="rounded-lg bg-stone-800/60 p-3">
                    <p className="text-xs font-medium text-stone-400 mb-1.5">다룬 주제</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedSession.summary.topicsDiscussed.map((s, i) => (
                        <span key={i} className="text-[10px] text-stone-400 bg-stone-700/60 px-2 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 세션 목록 뷰 ──────────────────────────
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-stone-800 bg-stone-900/80 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-amber-600/30">
              <Image src="/fletcher.png" alt="F" width={32} height={32} className="object-cover object-top" />
            </div>
            <div>
              <h1 className="font-semibold text-amber-50">Fletcher Admin</h1>
              <p className="text-xs text-stone-500">세션 관리</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin/interviews" className="text-xs text-stone-500 hover:text-stone-300">인터뷰 관리</a>
            <a href="/admin/profiles" className="text-xs text-stone-500 hover:text-stone-300">크루 프로필</a>
            <a href="/admin/stats" className="text-xs text-stone-500 hover:text-stone-300">통계</a>
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <Users className="h-4 w-4" />
              {sessions.length}개 세션
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin inline-block w-8 h-8 border-[3px] border-stone-700 border-t-amber-500 rounded-full" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 text-stone-600">
            아직 세션이 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                key={session.sessionId}
                onClick={() => openSession(session)}
                className="w-full text-left rounded-xl border border-stone-800 bg-stone-900/50
                  hover:border-stone-700 hover:bg-stone-900 transition-all p-4 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-sm font-semibold text-amber-400">
                      {session.nickname.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-200">{session.nickname}</span>
                        {session.hasSummary ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-950/40 text-green-400">완료</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-400">진행 중</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-stone-600 mt-0.5">
                        <span>{formatDate(session.startedAt)}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(session.durationSeconds)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {session.messageCount}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Eye className="h-4 w-4 text-stone-700 group-hover:text-stone-400 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoadingDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-[3px] border-stone-700 border-t-amber-500 rounded-full" />
        </div>
      )}
    </div>
  );
}
