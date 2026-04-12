"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { InterviewSession } from "@/components/session/interview-session";
import type { ChatMessage } from "@/hooks/useInterviewChat";

interface InterviewData {
  id: string;
  slug: string;
  title: string;
  description: string;
  curriculum: string;
  firstMessage: string;
  timeLimitMinutes: number;
  warningMinutes: number[];
  deadline?: string;
  messages?: {
    timeWarning?: string;
    timeUp?: string;
    lastMessagePlaceholder?: string;
    afterLastMessage?: string;
    completed?: string;
    timeExpiredPlaceholder?: string;
  };
}

interface PreviousSession {
  sessionId: string;
  messages: {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    responseTimeMs?: number;
  }[];
  evaluation?: unknown;
  summary?: unknown;
}

export default function InterviewPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expired, setExpired] = useState(false);

  const [nickname, setNickname] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [showUnknownWarning, setShowUnknownWarning] = useState(false);
  const [pendingNickname, setPendingNickname] = useState<string | null>(null);
  const [previousSession, setPreviousSession] = useState<PreviousSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // 인터뷰 설정 로드
  useEffect(() => {
    fetch(`/api/interview?slug=${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (res.status === 410) { setExpired(true); throw new Error("Expired"); }
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setInterview(data))
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [slug]);

  // 닉네임 입력 후 이전 세션 확인
  useEffect(() => {
    if (!nickname || !interview) return;
    setIsLoadingSession(true);
    fetch(`/api/session/load?nickname=${encodeURIComponent(nickname)}&interviewId=${interview.id}`)
      .then((res) => res.json())
      .then((data) => {
        const s = data.session;
        const elapsedSinceStart = s?.startedAt
          ? (Date.now() - new Date(s.startedAt).getTime()) / 1000
          : 0;
        const isIncomplete = s?.messages?.length > 0
          && !s.evaluation
          && !s.summary
          && elapsedSinceStart < (interview.timeLimitMinutes * 60);
        setPreviousSession(isIncomplete ? s : null);
      })
      .catch(() => setPreviousSession(null))
      .finally(() => setIsLoadingSession(false));
  }, [nickname, interview]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin w-8 h-8 border-[3px] border-stone-700 border-t-amber-500 rounded-full" />
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center space-y-3">
          <p className="text-4xl">⏰</p>
          <p className="text-lg font-semibold text-stone-300">마감되었습니다</p>
          <p className="text-sm text-stone-600">이 인터뷰의 참여 기한이 종료되었습니다.</p>
        </div>
      </div>
    );
  }

  if (notFound || !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center space-y-3">
          <p className="text-2xl font-bold text-stone-400">404</p>
          <p className="text-stone-600">인터뷰를 찾을 수 없습니다</p>
        </div>
      </div>
    );
  }

  // 세션 진행 중
  if (nickname && !isLoadingSession) {
    const initialMessages: ChatMessage[] | undefined = previousSession?.messages.map((m) => ({
      id: crypto.randomUUID(),
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp),
      responseTimeMs: m.responseTimeMs,
    }));

    return (
      <InterviewSession
        nickname={nickname}
        interviewId={interview.id}
        interviewTitle={interview.title}
        curriculum={interview.curriculum}
        firstMessage={interview.firstMessage}
        timeLimitMinutes={interview.timeLimitMinutes}
        messages={interview.messages}
        warningMinutes={interview.warningMinutes}
        sessionId={previousSession?.sessionId}
        initialMessages={initialMessages}
        onExit={() => setNickname(null)}
      />
    );
  }

  if (nickname && isLoadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-[3px] border-stone-700 border-t-amber-500 rounded-full" />
          <p className="text-sm text-stone-500">이전 세션을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 닉네임 입력 — 프로필 체크 후 진행
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = input.trim();
    if (!name) return;

    try {
      const res = await fetch(`/api/profile/check?nickname=${encodeURIComponent(name)}`);
      const data = await res.json();

      if (data.exists) {
        setNickname(name);
      } else {
        setPendingNickname(name);
        setShowUnknownWarning(true);
      }
    } catch {
      // 체크 실패하면 그냥 진행
      setNickname(name);
    }
  };

  const confirmUnknown = () => {
    if (pendingNickname) setNickname(pendingNickname);
    setShowUnknownWarning(false);
    setPendingNickname(null);
  };

  const cancelUnknown = () => {
    setShowUnknownWarning(false);
    setPendingNickname(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-amber-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <div className="relative w-48 h-56 rounded-2xl overflow-hidden fletcher-portrait">
            <Image src="/fletcher.png" alt="Fletcher" fill className="object-cover object-top" priority />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-amber-50">Fletcher</h1>
          <p className="text-stone-300 text-sm font-medium">{interview.title}</p>
          {interview.description && (
            <p className="text-stone-500 text-xs">{interview.description}</p>
          )}
          <p className="text-stone-600 text-xs italic">
            &ldquo;이 세상에서 가장 해로운 말은, 잘했어.&rdquo;
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="닉네임"
            autoFocus
            maxLength={20}
            className="w-full rounded-xl border border-stone-700 bg-stone-900/80
              px-5 py-4 text-center text-lg text-stone-100
              focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600
              placeholder:text-stone-600 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-full rounded-xl bg-amber-600 px-5 py-4 text-white font-semibold text-base
              hover:bg-amber-500 active:scale-[0.98] transition-all
              disabled:opacity-20 disabled:cursor-not-allowed"
          >
            증명하러 가기
          </button>
        </form>

        {showUnknownWarning && (
          <div className="rounded-xl bg-amber-950/40 border border-amber-800 p-4 space-y-3">
            <p className="text-sm text-amber-300 text-center">
              <span className="font-medium">&ldquo;{pendingNickname}&rdquo;</span>은 등록된 크루가 아닙니다.
              <br />
              <span className="text-amber-400/70 text-xs">학습 프로필 없이 진행됩니다.</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={cancelUnknown}
                className="flex-1 rounded-lg border border-stone-700 px-3 py-2 text-sm text-stone-400 hover:text-stone-200 transition-colors"
              >
                다시 입력
              </button>
              <button
                onClick={confirmUnknown}
                className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm text-white font-medium hover:bg-amber-500 transition-colors"
              >
                계속 진행
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-stone-600">
          제한시간 {interview.timeLimitMinutes}분
          {interview.deadline && (
            <span className="block mt-1">
              마감: {new Date(interview.deadline).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
