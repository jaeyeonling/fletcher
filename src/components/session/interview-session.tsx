"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { useInterviewChat } from "@/hooks/useInterviewChat";
import { ChatInterface } from "@/components/session/chat-interface";
import { VoiceInterface } from "@/components/session/voice-interface";
import { CodeEditorPanel } from "@/components/code-editor/code-editor-panel";
import Image from "next/image";
import {
  Clock, CheckCircle2, LogOut, Mic, MessageSquare, Code, TrendingUp, Target, Lightbulb,
} from "lucide-react";
import type { SessionSummary } from "@/lib/ai/types";

interface InterviewSessionMessages {
  timeWarning?: string;
  timeUp?: string;
  lastMessagePlaceholder?: string;
  afterLastMessage?: string;
  completed?: string;
  timeExpiredPlaceholder?: string;
}

interface InterviewSessionProps {
  nickname: string;
  interviewId?: string;
  interviewTitle?: string;
  persona?: string;
  curriculum?: string;
  firstMessage?: string;
  timeLimitMinutes?: number;
  warningMinutes?: number[];
  messages?: InterviewSessionMessages;
  profileContext?: string;
  sessionId?: string;
  initialMessages?: import("@/hooks/useInterviewChat").ChatMessage[];
  onExit: () => void;
}

export function InterviewSession({
  nickname,
  interviewId,
  interviewTitle,
  persona: personaProp,
  curriculum: curriculumProp,
  firstMessage: firstMessageProp,
  timeLimitMinutes = 60,
  warningMinutes: warningMinutesProp,
  messages: messagesProp,
  profileContext,
  sessionId: existingSessionId,
  initialMessages,
  onExit,
}: InterviewSessionProps) {
  const [sessionId] = useState(() => {
    if (existingSessionId) return existingSessionId;
    const date = new Date().toISOString().slice(0, 10);
    const rand = Math.random().toString(36).slice(2, 8);
    return `${date}-${rand}`;
  });
  const TIME_LIMIT = useMemo(() => timeLimitMinutes * 60, [timeLimitMinutes]);
  const TIME_WARNINGS = useMemo(() => (warningMinutesProp ?? [30, 50, 55, 59]).map((m) => m * 60), [warningMinutesProp]);
  const msg = useMemo(() => ({
    timeWarning: messagesProp?.timeWarning ?? "⏰ 남은 시간: {minutes}",
    timeUp: messagesProp?.timeUp ?? "⏰ 평가 시간이 종료되었습니다.\n\n마지막으로 **한 번만** 메시지를 보낼 수 있습니다. 하고 싶은 말을 남겨주세요.",
    lastMessagePlaceholder: messagesProp?.lastMessagePlaceholder ?? "마지막 메시지입니다. 하고 싶은 말을 남겨주세요.",
    afterLastMessage: messagesProp?.afterLastMessage ?? "평가가 종료되었습니다. 수고하셨습니다.",
    completed: messagesProp?.completed ?? "평가가 완료되었습니다",
    timeExpiredPlaceholder: messagesProp?.timeExpiredPlaceholder ?? "시간이 종료되었습니다",
  }), [messagesProp]);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [acceptLastMessage, setAcceptLastMessage] = useState(false);
  const shownWarningsRef = useRef(new Set<number>());

  const [mode, setMode] = useState<"chat" | "voice" | "code">("chat");
  const prevModeRef = useRef<"chat" | "voice">("chat");
  const [codeState, setCodeState] = useState({ code: "", language: "java" });
  const [startedAt] = useState(() => {
    if (initialMessages && initialMessages.length > 0) {
      return new Date(initialMessages[0].timestamp);
    }
    return new Date();
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const voiceMessagesEndRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startedRef = useRef(false);
  const evaluatedRef = useRef(false);
  const elapsedRef = useRef(elapsedSeconds);
  elapsedRef.current = elapsedSeconds;
  const eventsRef = useRef<unknown[]>([]);

  const saveMessages = useCallback(
    (msgs: { role: string; content: string; timestamp: Date; responseTimeMs?: number; mode?: string }[]) => {
      fetch("/api/session/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          interviewId,
          nickname,
          startedAt: msgs[0]?.timestamp,
          completedAt: new Date().toISOString(),
          durationSeconds: elapsedRef.current,
          messages: msgs.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            responseTimeMs: m.responseTimeMs,
            mode: m.mode,
          })),
          events: eventsRef.current,
        }),
      }).catch((e) => console.error(e));
    },
    [sessionId, interviewId, nickname]
  );

  const {
    messages,
    isStreaming,
    isComplete,
    sendMessage,
    retryMessage,
    startInterview,
    stopStreaming,
    addSystemMessage,
    addUserMessage,
    markComplete,
    events,
    addEvent,
    conversationHistory,
  } = useInterviewChat({
    nickname,
    interviewId,
    persona: personaProp ?? "",
    curriculum: curriculumProp ?? "",
    firstMessage: firstMessageProp ?? "",
    profileContext,
    initialMessages,
    onMessagesUpdate: saveMessages,
    onCodeEditorSignal: useCallback((signal: "show" | "hide" | null) => {
      if (signal === "show") {
        setMode((current) => {
          if (current !== "code") prevModeRef.current = current as "chat" | "voice";
          return "code";
        });
      } else if (signal === "hide") {
        setMode(prevModeRef.current);
      }
    }, []),
  });

  eventsRef.current = events;

  const addSystemNoticeRef = useRef((content: string) => addSystemMessage(content));
  addSystemNoticeRef.current = (content: string) => addSystemMessage(content);

  // Voice mode auto-scroll
  useEffect(() => {
    if (mode === "voice") {
      voiceMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, mode]);

  // Timer
  useEffect(() => {
    const update = () => {
      const raw = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      const elapsed = Math.min(raw, TIME_LIMIT);
      setElapsedSeconds(elapsed);

      for (const warningAt of TIME_WARNINGS) {
        if (elapsed >= warningAt && !shownWarningsRef.current.has(warningAt)) {
          shownWarningsRef.current.add(warningAt);
          const remaining = TIME_LIMIT - warningAt;
          const mins = Math.floor(remaining / 60);
          const timeText = mins > 0 ? `${mins}분` : `${remaining}초`;
          addSystemNoticeRef.current(msg.timeWarning.replace("{minutes}", timeText));
        }
      }

      if (elapsed >= TIME_LIMIT && !isTimeUp) {
        setIsTimeUp(true);
        setAcceptLastMessage(true);
        addSystemNoticeRef.current(msg.timeUp);
      }
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current);
  }, [startedAt, isTimeUp, TIME_LIMIT, TIME_WARNINGS, msg.timeWarning, msg.timeUp]);

  // Start
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startInterview();
  }, [startInterview]);

  // Summary
  useEffect(() => {
    if (!isComplete || evaluatedRef.current) return;
    evaluatedRef.current = true;
    setIsSummarizing(true);
    fetch("/api/ai/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, curriculum: curriculumProp ?? "", conversationHistory }),
    })
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .catch((e) => console.error(e))
      .finally(() => setIsSummarizing(false));
  }, [isComplete, nickname, curriculumProp, conversationHistory]);

  const handleSendMessage = useCallback(
    (content: string) => {
      // 코드 에디터에 코드가 있으면 메시지에 포함
      const enriched = codeState.code.trim()
        ? `${content}\n\n\`\`\`${codeState.language}\n${codeState.code}\n\`\`\``
        : content;

      if (isTimeUp && !acceptLastMessage) return;
      if (isTimeUp && acceptLastMessage) {
        addUserMessage(enriched, { mode });
        setAcceptLastMessage(false);
        markComplete();
        addSystemMessage(msg.afterLastMessage);
        return;
      }
      sendMessage(enriched, { mode });
    },
    [isTimeUp, acceptLastMessage, sendMessage, addUserMessage, addSystemMessage, markComplete, codeState, mode, msg]
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!summary) return;
    const data = {
      sessionId,
      nickname,
      startedAt: messages[0]?.timestamp,
      completedAt: new Date().toISOString(),
      durationSeconds: elapsedSeconds,
      messages: messages.map((m) => ({
        role: m.role, content: m.content, timestamp: m.timestamp, responseTimeMs: m.responseTimeMs, mode: m.mode,
      })),
      events,
      summary,
    };
    fetch("/api/session/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch((e) => console.error(e));
  }, [summary, sessionId, nickname, messages, elapsedSeconds, events]);


  const isDisabled = isComplete || (isTimeUp && !acceptLastMessage);
  const timerColor = isTimeUp
    ? "text-red-500"
    : elapsedSeconds >= 55 * 60
      ? "text-amber-500"
      : "text-[var(--muted)]";

  return (
    <div className="h-screen flex flex-col bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-amber-600/30">
            <Image src="/fletcher.png" alt="F" width={32} height={32} className="object-cover object-top" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-amber-50">{interviewTitle ?? "Fletcher"}</h2>
            <p className="text-xs text-[var(--muted)]">{nickname} 크루</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mode toggle */}
          <div className="flex items-center rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => { addEvent("mode_change", { from: mode, to: "chat" }); prevModeRef.current = "chat"; setMode("chat"); }}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm transition-colors ${
                mode === "chat"
                  ? "bg-amber-600 text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">텍스트</span>
            </button>
            <button
              onClick={() => { addEvent("mode_change", { from: mode, to: "voice" }); prevModeRef.current = "voice"; setMode("voice"); }}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm transition-colors ${
                mode === "voice"
                  ? "bg-amber-600 text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">음성</span>
            </button>
            <button
              onClick={() => { addEvent("mode_change", { from: mode, to: "code" }); setMode("code"); }}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm transition-colors ${
                mode === "code"
                  ? "bg-amber-600 text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">코드</span>
            </button>
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-1 text-sm font-mono tabular-nums ${timerColor}`}>
            <Clock className="h-3.5 w-3.5" />
            {formatTime(elapsedSeconds)}
          </div>

          {/* Status */}
          {isComplete && (
            <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-950/40 px-2 py-1 rounded-md">
              <CheckCircle2 className="h-3.5 w-3.5" />
              완료
            </div>
          )}

          <button
            onClick={onExit}
            title="나가기"
            className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat / Voice panel */}
        <div className={mode === "code" ? "w-1/2" : "w-full"}>
          {mode === "voice" ? (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-3xl mx-auto space-y-5">
                  {messages.map((message) => (
                    <div key={message.id} className="flex gap-3">
                      {message.role === "assistant" ? (
                        <>
                          <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden mt-0.5 ring-2 ring-amber-600/30">
                            <Image src="/fletcher.png" alt="F" width={32} height={32} className="object-cover object-top" />
                          </div>
                          <div className="flex-1 min-w-0 prose-chat">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex justify-end">
                          <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-amber-600 text-white px-4 py-3 text-sm leading-relaxed">
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={voiceMessagesEndRef} />
                </div>
              </div>
              <div className="border-t border-[var(--border)]">
                <VoiceInterface
                  onSendMessage={handleSendMessage}
                  lastAssistantMessage={
                    messages.filter((m) => m.role === "assistant").at(-1)?.content ?? null
                  }
                  isStreaming={isStreaming}
                  disabled={isDisabled}
                  completedMessage={msg.completed}
                />
              </div>
            </div>
          ) : (
            <ChatInterface
              messages={messages}
              isStreaming={isStreaming}
              onSendMessage={handleSendMessage}
              onStop={stopStreaming}
              onRetry={retryMessage}
              disabled={isDisabled}
              placeholder={
                isComplete
                  ? msg.completed
                  : isTimeUp && acceptLastMessage
                    ? msg.lastMessagePlaceholder
                    : isTimeUp && !acceptLastMessage
                      ? msg.timeExpiredPlaceholder
                      : mode === "code"
                        ? "코드에 대해 설명하세요..."
                        : "답변을 입력하세요... (Shift+Enter로 줄바꿈)"
              }
            />
          )}
        </div>

        {/* Code editor panel */}
        {mode === "code" && (
          <div className="w-1/2">
            <CodeEditorPanel
              onCodeChange={(code, language) => {
                setCodeState({ code, language });
                addEvent("code_change", { language, length: code.length });
              }}
            />
          </div>
        )}
      </div>

      {/* Summary */}
      {(isSummarizing || summary) && (
        <div className="border-t border-stone-800 bg-stone-900/80 p-6 max-h-[50vh] overflow-y-auto">
          {isSummarizing ? (
            <div className="text-center space-y-3 py-8">
              <div className="animate-spin inline-block w-8 h-8 border-[3px] border-stone-700 border-t-amber-500 rounded-full" />
              <p className="text-sm text-stone-500">대화를 정리하고 있습니다...</p>
            </div>
          ) : summary ? (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Closing message */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden ring-2 ring-amber-600/30">
                  <Image src="/fletcher.png" alt="F" width={40} height={40} className="object-cover object-top" />
                </div>
                <div className="flex-1 bg-stone-800 rounded-2xl rounded-tl-md px-5 py-4">
                  <p className="text-stone-200 text-sm leading-relaxed italic">
                    &ldquo;{summary.closingMessage}&rdquo;
                  </p>
                </div>
              </div>

              {/* Topics grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {summary.deepDives?.length > 0 && (
                  <div className="rounded-xl bg-stone-800/60 border border-stone-700 p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-amber-400">
                      <TrendingUp className="h-4 w-4" />
                      깊이 있게 다룬 내용
                    </div>
                    <ul className="space-y-1.5">
                      {summary.deepDives.map((s, i) => (
                        <li key={i} className="text-xs text-stone-400 leading-relaxed pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-amber-500">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.couldExploreMore?.length > 0 && (
                  <div className="rounded-xl bg-stone-800/60 border border-stone-700 p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-stone-400">
                      <Target className="h-4 w-4" />
                      더 탐색해볼 수 있었던 부분
                    </div>
                    <ul className="space-y-1.5">
                      {summary.couldExploreMore.map((s, i) => (
                        <li key={i} className="text-xs text-stone-500 leading-relaxed pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-stone-600">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.notMentioned?.length > 0 && (
                  <div className="rounded-xl bg-stone-800/60 border border-stone-700 p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-stone-500">
                      <Lightbulb className="h-4 w-4" />
                      언급되지 않은 영역
                    </div>
                    <ul className="space-y-1.5">
                      {summary.notMentioned.map((s, i) => (
                        <li key={i} className="text-xs text-stone-600 leading-relaxed pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-stone-700">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.topicsDiscussed?.length > 0 && (
                  <div className="rounded-xl bg-stone-800/60 border border-stone-700 p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-stone-400">
                      <MessageSquare className="h-4 w-4" />
                      다룬 주제들
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {summary.topicsDiscussed.map((s, i) => (
                        <span key={i} className="text-xs text-stone-400 bg-stone-700/60 px-2.5 py-1 rounded-md">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
