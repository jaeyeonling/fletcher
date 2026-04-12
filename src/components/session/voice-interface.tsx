"use client";

import { useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { cn } from "@/lib/utils";

interface VoiceInterfaceProps {
  onSendMessage: (content: string) => void;
  lastAssistantMessage: string | null;
  isStreaming: boolean;
  disabled?: boolean;
  completedMessage?: string;
}

export function VoiceInterface({
  onSendMessage,
  lastAssistantMessage,
  isStreaming,
  disabled = false,
  completedMessage = "평가가 완료되었습니다",
}: VoiceInterfaceProps) {
  const {
    isListening,
    isTranscribing,
    isReady,
    transcript,
    startListening,
    stopListening,
  } = useSpeechRecognition();

  const { isSpeaking, speak, stop: stopSpeaking } = useTextToSpeech();
  const lastSpokenRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  // 마운트 시 현재 메시지를 이미 "읽은 것"으로 표시 (중복 재생 방지)
  useEffect(() => {
    if (!mountedRef.current) {
      lastSpokenRef.current = lastAssistantMessage;
      mountedRef.current = true;
    }
  }, [lastAssistantMessage]);

  // 언마운트 시 음성 정지
  useEffect(() => {
    return () => stopSpeaking();
  }, [stopSpeaking]);

  // AI 응답 완료 시 자동 TTS (마운트 이후 새 메시지만)
  useEffect(() => {
    if (
      mountedRef.current &&
      !isStreaming &&
      lastAssistantMessage &&
      lastAssistantMessage !== lastSpokenRef.current
    ) {
      lastSpokenRef.current = lastAssistantMessage;
      speak(lastAssistantMessage);
    }
  }, [isStreaming, lastAssistantMessage, speak]);

  const handleMicToggle = useCallback(async () => {
    if (disabled || isTranscribing) return;

    if (isListening) {
      const result = await stopListening();
      if (result.text.trim()) {
        onSendMessage(result.text.trim());
      }
    } else {
      stopSpeaking();
      startListening();
    }
  }, [disabled, isTranscribing, isListening, stopListening, onSendMessage, stopSpeaking, startListening]);

  const isBusy = isTranscribing || isStreaming || !isReady;

  // 스페이스바로 마이크 토글
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // input/textarea에 포커스 있으면 무시
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space") {
        e.preventDefault();
        handleMicToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleMicToggle]);

  return (
    <div className="flex flex-col items-center gap-4 py-6" role="region" aria-label="음성 입력">
      {/* Transcript preview */}
      {(transcript || isTranscribing) && (
        <div className="max-w-md text-center text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2">
          {isTranscribing ? (
            <span className="flex items-center gap-2 justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              음성을 텍스트로 변환 중...
            </span>
          ) : (
            transcript
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* TTS control */}
        <button
          onClick={isSpeaking ? stopSpeaking : () => lastAssistantMessage && speak(lastAssistantMessage)}
          className={cn(
            "rounded-full p-3 transition-colors",
            isSpeaking
              ? "bg-amber-900/30 text-amber-400"
              : "bg-stone-800 text-stone-500 hover:text-stone-300"
          )}
          aria-label={isSpeaking ? "음성 정지" : "다시 듣기"}
        >
          {isSpeaking ? <Volume2 className="h-5 w-5 animate-pulse" aria-hidden="true" /> : <VolumeX className="h-5 w-5" aria-hidden="true" />}
        </button>

        {/* Mic button */}
        <button
          onClick={handleMicToggle}
          disabled={disabled || isBusy}
          aria-label={isListening ? "녹음 중지 및 전송" : isTranscribing ? "변환 중" : "녹음 시작"}
          className={cn(
            "rounded-full p-6 transition-all",
            isListening
              ? "bg-red-500 text-white shadow-lg shadow-red-500/25 scale-110"
              : isTranscribing
                ? "bg-amber-500 text-white"
                : "bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          {isTranscribing ? (
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
          ) : isListening ? (
            <MicOff className="h-8 w-8" aria-hidden="true" />
          ) : (
            <Mic className="h-8 w-8" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Status */}
      <p className="text-xs text-gray-400">
        {isListening
          ? "듣고 있습니다... Space 또는 버튼을 눌러 전송"
          : isTranscribing
            ? "변환 중..."
            : isStreaming
              ? "AI가 답변 중..."
              : isSpeaking
                ? "AI가 말하고 있습니다..."
                : disabled
                  ? completedMessage
                  : !isReady
                    ? "마이크 준비 중..."
                    : "Space 또는 마이크 버튼을 눌러 답변하세요"}
      </p>
    </div>
  );
}
