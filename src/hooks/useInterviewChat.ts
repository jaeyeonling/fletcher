"use client";

import { useState, useCallback, useRef } from "react";
import type { LLMMessage } from "@/lib/ai/types";
import { MARKERS, stripMarkers } from "@/lib/markers";

export type CodeEditorSignal = "show" | "hide" | null;

interface UseInterviewChatParams {
  nickname: string;
  interviewId?: string;
  persona: string;
  curriculum: string;
  firstMessage: string;
  profileContext?: string;
  initialMessages?: ChatMessage[];
  onMessagesUpdate?: (messages: ChatMessage[]) => void;
  onCodeEditorSignal?: (signal: CodeEditorSignal) => void;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  responseTimeMs?: number;
  mode?: "chat" | "voice" | "code";
  audioBlob?: Blob;
  failed?: boolean;
}

export interface SessionEvent {
  type: "mode_change" | "code_change" | "audio_record";
  timestamp: Date;
  data: Record<string, unknown>;
}

export function useInterviewChat({ nickname, interviewId, persona, curriculum, firstMessage, profileContext, initialMessages, onMessagesUpdate, onCodeEditorSignal }: UseInterviewChatParams) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastAssistantTimeRef = useRef<Date | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Refs for stable callback references
  const nicknameRef = useRef(nickname);
  const interviewIdRef = useRef(interviewId);
  const personaRef = useRef(persona);
  const curriculumRef = useRef(curriculum);
  const firstMessageRef = useRef(firstMessage);
  const profileContextRef = useRef(profileContext);
  const onMessagesUpdateRef = useRef(onMessagesUpdate);
  const onCodeEditorSignalRef = useRef(onCodeEditorSignal);
  const initialMessagesRef = useRef(initialMessages);

  nicknameRef.current = nickname;
  interviewIdRef.current = interviewId;
  personaRef.current = persona;
  curriculumRef.current = curriculum;
  firstMessageRef.current = firstMessage;
  profileContextRef.current = profileContext;
  onMessagesUpdateRef.current = onMessagesUpdate;
  onCodeEditorSignalRef.current = onCodeEditorSignal;
  initialMessagesRef.current = initialMessages;

  const conversationHistory: LLMMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const sendMessage = useCallback(
    async (content: string, options?: { mode?: "chat" | "voice" | "code"; audioBlob?: Blob }) => {
      if (isStreaming || isComplete) return;

      const responseTimeMs = lastAssistantTimeRef.current
        ? Date.now() - lastAssistantTimeRef.current.getTime()
        : undefined;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
        mode: options?.mode,
        audioBlob: options?.audioBlob,
        responseTimeMs,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsStreaming(true);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      try {
        abortControllerRef.current = new AbortController();
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nickname: nicknameRef.current,
            interviewId: interviewIdRef.current,
            persona: personaRef.current,
            curriculum: curriculumRef.current,
            profileContext: profileContextRef.current,
            conversationHistory: [
              ...conversationHistory,
              { role: "user" as const, content },
            ],
          }),
          signal: abortControllerRef.current.signal,
        });

        if (response.status === 429) {
          throw new Error("잠시 후 다시 시도해주세요. 요청이 너무 빠릅니다.");
        }
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "요청에 실패했습니다." }));
          throw new Error(err.error ?? "요청에 실패했습니다.");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("응답을 받을 수 없습니다.");

        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n").filter((line) => line.startsWith("data: "));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: fullContent } : m
                  )
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        lastAssistantTimeRef.current = new Date();

        // 마커 처리
        const cleanContent = stripMarkers(fullContent);

        if (fullContent !== cleanContent) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: cleanContent } : m
            )
          );
        }

        if (fullContent.includes(MARKERS.INTERVIEW_COMPLETE)) {
          setIsComplete(true);
        }

        if (fullContent.includes(MARKERS.SHOW_CODE)) {
          onCodeEditorSignalRef.current?.("show");
        } else if (fullContent.includes(MARKERS.HIDE_CODE)) {
          onCodeEditorSignalRef.current?.("hide");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const errorMsg = error instanceof Error ? error.message : "오류가 발생했습니다.";
        // assistant 빈 메시지 제거, user 메시지를 failed로 마킹
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== assistantId)
            .map((m) =>
              m.id === userMessage.id ? { ...m, failed: true } : m
            )
        );
        setLastFailedMessage(errorMsg);
      } finally {
        setIsStreaming(false);
        // AI 응답 완료 — 최신 메시지로 콜백 (setTimeout으로 state 업데이트 후 실행 보장)
        setTimeout(() => {
          onMessagesUpdateRef.current?.(messagesRef.current);
        }, 100);
      }
    },
    [messages, isStreaming, isComplete, conversationHistory]
  );

  const startInterview = useCallback(() => {
    // 이전 세션이 있으면 시스템 메시지 없이 바로 이어서 진행
    if (initialMessagesRef.current && initialMessagesRef.current.length > 0) {
      lastAssistantTimeRef.current = new Date();
      return;
    }

    // 커리큘럼을 마크다운 볼드 형식으로 변환
    const curriculumFormatted = curriculumRef.current
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const match = line.match(/^\d+\.\s*(.+?)\s*[—-]\s*(.+)$/);
        if (match) return `**${match[1].trim()}**\n- ${match[2].trim()}`;
        return `**${line.trim()}**`;
      })
      .join("\n\n");

    const content = firstMessageRef.current
      .replace("{nickname}", nicknameRef.current)
      .replace("{curriculum_formatted}", curriculumFormatted)
      .replace("{curriculum}", curriculumRef.current);

    const systemMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      timestamp: new Date(),
    };

    setMessages([systemMessage]);
    lastAssistantTimeRef.current = new Date();
  }, []);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const addUserMessage = useCallback((content: string, options?: { mode?: "chat" | "voice" | "code" }) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
      mode: options?.mode,
      responseTimeMs: lastAssistantTimeRef.current
        ? Date.now() - lastAssistantTimeRef.current.getTime()
        : undefined,
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const markComplete = useCallback(() => {
    setIsComplete(true);
  }, []);

  const retryMessage = useCallback((messageId: string) => {
    const failedMsg = messagesRef.current.find((m) => m.id === messageId && m.failed);
    if (!failedMsg) return;

    // failed 마킹 제거하고 다시 전송
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    setLastFailedMessage(null);

    // 약간의 딜레이 후 재전송 (state 업데이트 반영)
    setTimeout(() => {
      sendMessage(failedMsg.content, { mode: failedMsg.mode });
    }, 100);
  }, [sendMessage]);

  return {
    messages,
    isStreaming,
    isComplete,
    lastFailedMessage,
    events,
    sendMessage,
    retryMessage,
    startInterview,
    stopStreaming,
    addSystemMessage,
    addUserMessage,
    markComplete,
    addEvent: useCallback((type: SessionEvent["type"], data: Record<string, unknown>) => {
      setEvents((prev) => [...prev, { type, timestamp: new Date(), data }]);
    }, []),
    conversationHistory,
  };
}
