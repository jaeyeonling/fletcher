import { NextRequest, NextResponse } from "next/server";
import { getProvider, EVALUATION_MODEL } from "@/lib/ai/registry";
import { buildSummaryPrompt } from "@/lib/ai/prompts/interviewer";
import type { LLMMessage, SessionSummary } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  const { nickname, curriculum, conversationHistory } = (await req.json()) as {
    nickname: string;
    curriculum: string;
    conversationHistory: LLMMessage[];
  };

  const provider = getProvider();
  const messages = buildSummaryPrompt(nickname, curriculum, conversationHistory);

  try {
    const response = await provider.chat({
      model: EVALUATION_MODEL,
      messages,
      temperature: 0.3,
      maxTokens: 4096,
    });

    const cleaned = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const summary: SessionSummary = JSON.parse(cleaned);
    return NextResponse.json(summary);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Summary failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
