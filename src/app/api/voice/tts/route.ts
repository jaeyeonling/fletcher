import { NextRequest, NextResponse } from "next/server";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { checkRateLimit } from "@/lib/rate-limit";

const polly = new PollyClient({
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

export async function POST(req: NextRequest) {
  // 200명 동시, 50% 음성, 분당 10회: 글로벌 분당 1000회
  const { allowed } = checkRateLimit("tts:global", { maxRequests: 1000, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { text } = (await req.json()) as { text: string };

  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  // 긴 텍스트는 잘라서 처리 (Polly 제한: 3000자)
  const truncated = text.slice(0, 3000);

  try {
    const command = new SynthesizeSpeechCommand({
      Text: truncated,
      OutputFormat: "mp3",
      VoiceId: "Seoyeon", // Korean female voice
      Engine: "neural",
      LanguageCode: "ko-KR",
    });

    const response = await polly.send(command);

    if (!response.AudioStream) {
      throw new Error("No audio stream returned");
    }

    const audioBytes = await response.AudioStream.transformToByteArray();
    const buffer = Buffer.from(audioBytes);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
