import { NextRequest, NextResponse } from "next/server";
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import { checkRateLimit } from "@/lib/rate-limit";

const transcribeClient = new TranscribeStreamingClient({
  region: process.env.AWS_REGION ?? "ap-northeast-2",
  ...(process.env.AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      ...(process.env.AWS_SESSION_TOKEN && {
        sessionToken: process.env.AWS_SESSION_TOKEN,
      }),
    },
  }),
});

async function* audioStreamGenerator(pcmBuffer: Buffer) {
  // AWS Transcribe best practice: 100ms chunks
  // 16kHz mono PCM 16-bit: 100ms = 16000 * 2 * 0.1 = 3200 bytes
  const chunkSize = 3200;
  for (let i = 0; i < pcmBuffer.length; i += chunkSize) {
    yield {
      AudioEvent: {
        AudioChunk: pcmBuffer.subarray(i, Math.min(i + chunkSize, pcmBuffer.length)),
      },
    };
  }
}

function webmToPcm(webmBuffer: Buffer): Buffer {
  // WebM/Opus → raw PCM 변환은 복잡하므로,
  // 브라우저에서 직접 PCM (WAV) 형식으로 녹음하도록 변경
  // 여기서는 WAV 헤더를 건너뛰고 PCM 데이터만 추출
  const wavHeaderSize = 44;
  if (webmBuffer.length <= wavHeaderSize) return webmBuffer;

  // RIFF 헤더 확인
  const riff = webmBuffer.toString("ascii", 0, 4);
  if (riff === "RIFF") {
    return webmBuffer.subarray(wavHeaderSize);
  }

  return webmBuffer;
}

export async function POST(req: NextRequest) {
  // 200명 동시, 50% 음성, 분당 10회: 글로벌 분당 1000회
  const { allowed } = checkRateLimit("stt:global", { maxRequests: 1000, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const pcmData = webmToPcm(audioBuffer);

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: "ko-KR",
      MediaSampleRateHertz: 16000,
      MediaEncoding: "pcm",
      AudioStream: audioStreamGenerator(pcmData),
    });

    const response = await transcribeClient.send(command);

    let fullTranscript = "";

    if (response.TranscriptResultStream) {
      for await (const event of response.TranscriptResultStream) {
        if (event.TranscriptEvent?.Transcript?.Results) {
          for (const result of event.TranscriptEvent.Transcript.Results) {
            if (!result.IsPartial && result.Alternatives?.[0]?.Transcript) {
              fullTranscript += result.Alternatives[0].Transcript + " ";
            }
          }
        }
      }
    }

    return NextResponse.json({ text: fullTranscript.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "STT failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
