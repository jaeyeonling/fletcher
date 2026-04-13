import { NextRequest, NextResponse } from "next/server";
import { getProvider, INTERVIEW_MODEL } from "@/lib/ai/registry";
import { buildInterviewerPrompt } from "@/lib/ai/prompts/interviewer";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidId } from "@/lib/sanitize";
import type { LLMMessage } from "@/lib/ai/types";
import db from "@/lib/db";

interface ChatRequestBody {
  nickname: string;
  interviewId?: string;
  persona?: string;
  curriculum?: string;
  conversationHistory: LLMMessage[];
  profileContext?: string;
}

const findInterview = db.prepare("SELECT persona, curriculum FROM interviews WHERE id = ?");
const findProfile = db.prepare("SELECT summary FROM profiles WHERE nickname = ?");
const findProfileByNick = db.prepare("SELECT nickname, summary FROM profiles");

function loadProfileSummary(nickname: string): string | undefined {
  // 1. 정확히 일치
  const exact = findProfile.get(nickname) as { summary: string } | undefined;
  if (exact?.summary) return exact.summary;

  // 2. 닉네임 부분 일치
  const inputLower = nickname.toLowerCase();
  const all = findProfileByNick.all() as { nickname: string; summary: string }[];
  for (const row of all) {
    const parenIndex = row.nickname.indexOf("(");
    const nickOnly = (parenIndex > 0 ? row.nickname.slice(0, parenIndex) : row.nickname).trim().toLowerCase();
    if (nickOnly === inputLower) return row.summary;
  }

  return undefined;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatRequestBody;

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
    const row = findInterview.get(body.interviewId) as { persona: string; curriculum: string } | undefined;
    if (row) {
      persona = row.persona;
      curriculum = row.curriculum;
    }
  }

  const profileContext = body.profileContext ?? loadProfileSummary(body.nickname);

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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
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
