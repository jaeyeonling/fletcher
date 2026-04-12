"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { Send, Square, RotateCcw } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  failed?: boolean;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (content: string) => void;
  onStop: () => void;
  onRetry?: (messageId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInterface({
  messages,
  isStreaming,
  onSendMessage,
  onStop,
  onRetry,
  disabled = false,
  placeholder = "답변을 입력하세요...",
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // AI 응답 끝나면 textarea에 자동 포커스
  useEffect(() => {
    if (!isStreaming && !disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming, disabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSendMessage(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  return (
    <div className="flex flex-col h-full" role="region" aria-label="대화">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6" role="log" aria-live="polite" aria-label="대화 기록">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((message) => (
            <div key={message.id} className="flex gap-3" role="article" aria-label={message.role === "assistant" ? "Fletcher 메시지" : "내 메시지"}>
              {message.role === "assistant" ? (
                <>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden mt-0.5 ring-2 ring-amber-600/30">
                    <Image src="/fletcher.png" alt="Fletcher" width={32} height={32} className="object-cover object-top" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="prose-chat">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                    {isStreaming && message === messages[messages.length - 1] && (
                      <span className="inline-block w-1.5 h-4 bg-amber-500 animate-pulse rounded-sm ml-0.5" />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex justify-end items-end gap-2">
                  {message.failed && onRetry && (
                    <button
                      onClick={() => onRetry(message.id)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 mb-1"
                      title="재전송"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className={`max-w-[80%] rounded-2xl rounded-tr-md px-4 py-3 text-sm leading-relaxed ${
                    message.failed
                      ? "bg-red-900/40 text-red-200 border border-red-800"
                      : "bg-amber-600 text-white"
                  }`}>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.failed && (
                      <div className="text-[10px] text-red-400 mt-1">전송 실패</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-stone-800 bg-stone-900/50" role="form" aria-label="메시지 입력">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              aria-label="답변 입력"
              disabled={disabled || isStreaming}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-stone-700 bg-stone-800/80
                px-4 py-3 text-sm text-stone-100
                focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600
                placeholder:text-stone-600
                disabled:opacity-50 transition-all"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="rounded-xl bg-red-600 p-3 text-white hover:bg-red-500 transition-colors"
                aria-label="응답 중지"
              >
                <Square className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || disabled}
                aria-label="전송"
                className="rounded-xl bg-amber-600 p-3 text-white hover:bg-amber-500 transition-all
                  disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
