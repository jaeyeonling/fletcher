import { NextRequest, NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/admin-auth";
import { getProvider, GENERATION_MODEL } from "@/lib/ai/registry";
import { logger } from "@/lib/logger";

interface ParsedProfile {
  nickname: string;
  summary: string;
}

// POST: 대화로 프로필 다듬기 (LLM)
export async function POST(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const { action, profiles, userMessage } = (await req.json()) as {
    action: "refine";
    profiles?: ParsedProfile[];
    userMessage?: string;
  };

  if (action === "refine") {
    try {
      const provider = getProvider();
      const currentState = JSON.stringify(profiles, null, 2);
      const response = await provider.chat({
        model: GENERATION_MODEL,
        messages: [
          {
            role: "system",
            content: `현재 프로필:\n${currentState}\n\n사용자의 요청을 반영하여 수정된 전체 프로필 목록을 JSON 배열로 출력하세요. JSON만 출력.`,
          },
          { role: "user", content: userMessage ?? "" },
        ],
        temperature: 0.3,
        maxTokens: 4096,
      });

      const cleaned = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const refined: ParsedProfile[] = JSON.parse(cleaned);
      return NextResponse.json({ profiles: refined });
    } catch (error) {
      logger.error("Refine failed", error);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
