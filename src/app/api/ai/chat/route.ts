import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getProvider, INTERVIEW_MODEL } from "@/lib/ai/registry";
import { buildInterviewerPrompt } from "@/lib/ai/prompts/interviewer";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidId } from "@/lib/sanitize";
import type { LLMMessage } from "@/lib/ai/types";
import type { InterviewConfig } from "@/lib/interview-config";
import { logger } from "@/lib/logger";

interface ChatRequestBody {
  nickname: string;
  interviewId?: string;
  persona?: string;
  curriculum?: string;
  conversationHistory: LLMMessage[];
  profileContext?: string;
}

async function loadInterviewConfig(interviewId: string): Promise<InterviewConfig | null> {
  try {
    const filepath = path.join(process.cwd(), "data", "interviews", `${interviewId}.json`);
    const content = await readFile(filepath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    logger.error("Failed to load interview config", error);
    return null;
  }
}

async function loadProfileSummary(nickname: string): Promise<string | undefined> {
  const { readdir } = await import("fs/promises");
  const { sanitizeNickname } = await import("@/lib/sanitize");
  const profilesDir = path.join(process.cwd(), "data", "profiles");

  // 1. 정확히 일치
  try {
    const sanitized = sanitizeNickname(nickname);
    const content = await readFile(path.join(profilesDir, `${sanitized}.json`), "utf-8");
    const profile = JSON.parse(content);
    return profile.summary || undefined;
  } catch {
    // 정확히 일치하는 파일 없음 — 부분 매칭 시도
  }

  // 2. 닉네임 부분 매칭 — "네오(김재연)"에서 "네오"를 추출하여 비교
  try {
    const files = await readdir(profilesDir);
    const inputLower = nickname.toLowerCase();

    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const content = await readFile(path.join(profilesDir, file), "utf-8");
      const profile = JSON.parse(content);
      const fullName = (profile.nickname ?? "") as string;

      // "닉네임(본명)" 형식에서 닉네임만 추출
      const parenIndex = fullName.indexOf("(");
      const nickOnly = (parenIndex > 0 ? fullName.slice(0, parenIndex) : fullName).trim().toLowerCase();

      if (nickOnly === inputLower) {
        return profile.summary || undefined;
      }
    }
  } catch {
    // 디렉토리 없음
  }

  return undefined;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatRequestBody;

  // 필수 검증
  if (!body.nickname?.trim()) {
    return NextResponse.json({ error: "nickname required" }, { status: 400 });
  }
  if (body.interviewId && !isValidId(body.interviewId)) {
    return NextResponse.json({ error: "Invalid interviewId" }, { status: 400 });
  }

  // 200명 동시, 분당 10회 대화 기준
  const { allowed } = checkRateLimit(`chat:${body.nickname}`, { maxRequests: 10, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let persona = body.persona ?? "";
  let curriculum = body.curriculum ?? "";

  if (body.interviewId) {
    const config = await loadInterviewConfig(body.interviewId);
    if (config) {
      persona = config.persona;
      curriculum = config.curriculum;
    }
  }

  // 크루 프로필 자동 로드
  const profileContext = body.profileContext ?? await loadProfileSummary(body.nickname);

  const provider = getProvider();
  const messages = buildInterviewerPrompt({
    nickname: body.nickname,
    persona,
    curriculum,
    conversationHistory: body.conversationHistory,
    profileContext,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of provider.stream({
          model: INTERVIEW_MODEL,
          messages,
          temperature: 0.7,
        })) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
