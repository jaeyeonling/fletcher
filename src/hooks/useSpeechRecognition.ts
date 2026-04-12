"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface StopResult {
  text: string;
  audioBlob?: Blob;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isTranscribing: boolean;
  isReady: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => Promise<StopResult>;
  resetTranscript: () => void;
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer;

  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcPos = i * ratio;
    const srcIndex = Math.floor(srcPos);
    const frac = srcPos - srcIndex;

    const a = buffer[srcIndex] ?? 0;
    const b = buffer[Math.min(srcIndex + 1, buffer.length - 1)] ?? 0;
    result[i] = a + frac * (b - a);
  }

  return result;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [transcript, setTranscript] = useState("");

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const nativeSampleRateRef = useRef(48000);
  const useWorkletRef = useRef(false);

  // ScriptProcessor fallback refs
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        mediaStreamRef.current = stream;
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        nativeSampleRateRef.current = audioContext.sampleRate;

        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;

        // AudioWorklet 사용 시도 (더 높은 품질)
        try {
          await audioContext.audioWorklet.addModule("/audio-processor.js");
          const workletNode = new AudioWorkletNode(audioContext, "recorder-processor");
          workletNodeRef.current = workletNode;

          workletNode.port.onmessage = (e) => {
            if (e.data.type === "audio" && isRecordingRef.current) {
              chunksRef.current.push(new Float32Array(e.data.samples));
            }
          };

          source.connect(workletNode);
          workletNode.connect(audioContext.destination);
          useWorkletRef.current = true;
        } catch {
          // AudioWorklet 미지원 시 ScriptProcessor fallback
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (isRecordingRef.current) {
              chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
            }
          };

          source.connect(processor);
          processor.connect(audioContext.destination);
        }

        if (!cancelled) setIsReady(true);
      } catch (err) {
        console.error("Microphone access denied:", err);
      }
    }

    init();

    return () => {
      cancelled = true;
      workletNodeRef.current?.disconnect();
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      audioContextRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startListening = useCallback(() => {
    chunksRef.current = [];
    setTranscript("");
    isRecordingRef.current = true;

    if (useWorkletRef.current && workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: "start" });
    }

    setIsListening(true);
  }, []);

  const stopListening = useCallback(async (): Promise<StopResult> => {
    isRecordingRef.current = false;

    if (useWorkletRef.current && workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: "stop" });
    }

    setIsListening(false);

    const chunks = chunksRef.current;
    if (chunks.length === 0) return { text: "" };

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // 네이티브 샘플레이트 → 16kHz 다운샘플링 (linear interpolation)
    const targetRate = 16000;
    const downsampled = downsample(merged, nativeSampleRateRef.current, targetRate);
    const wavBuffer = encodeWav(downsampled, targetRate);
    const audioBlob = new Blob([wavBuffer], { type: "audio/wav" });

    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");

      const response = await fetch("/api/voice/stt", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      const text = data.text || "";
      setTranscript(text);
      return { text, audioBlob };
    } catch {
      return { text: "", audioBlob };
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  return {
    isListening,
    isTranscribing,
    isReady,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  };
}
