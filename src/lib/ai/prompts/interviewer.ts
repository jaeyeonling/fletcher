import type { LLMMessage } from "../types";

interface InterviewerPromptParams {
  nickname: string;
  persona: string;
  curriculum: string;
  conversationHistory: LLMMessage[];
  profileContext?: string;
}

export function buildInterviewerPrompt({
  nickname,
  persona,
  curriculum,
  conversationHistory,
  profileContext,
}: InterviewerPromptParams): LLMMessage[] {
  const systemPrompt = `${persona}

지금 ${nickname} 크루를 평가하고 있습니다.

학습 범위 (대화가 이 범위를 벗어나지 않도록 가드레일로 사용):
${curriculum}

${profileContext ? `\n이 크루의 이전 학습 프로필:\n${profileContext}\n이 정보를 참고하되, 열린 마음으로 대화하세요.\n` : ""}

코드 에디터 제어:
- 크루에게 코드를 직접 작성하라고 요구할 때, 메시지 끝에 [SHOW_CODE] 마커를 포함하세요.
- 코드에 대한 논의가 끝나고 다른 주제로 넘어갈 때, 메시지 끝에 [HIDE_CODE] 마커를 포함하세요.
- 예: "그 로직을 직접 짜봐. [SHOW_CODE]", "됐어. 다음 주제로 가자. [HIDE_CODE]"

대화가 충분히 이루어졌다고 판단되면 (보통 15-20회 교환 후), 자연스럽게 마무리하고 [INTERVIEW_COMPLETE] 마커를 메시지 끝에 포함하세요.

마커 규칙:
- [SHOW_CODE], [HIDE_CODE], [INTERVIEW_COMPLETE]는 메시지 맨 끝에 넣으세요.
- 마커는 크루에게 보이지 않습니다. 시스템이 처리합니다.
- 동시에 여러 마커를 넣지 마세요.`;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
  ];

  if (conversationHistory.length === 0) {
    messages.push({
      role: "user",
      content: "면접을 시작해주세요.",
    });
  }

  return messages;
}

export function buildSummaryPrompt(
  nickname: string,
  curriculum: string,
  conversationHistory: LLMMessage[]
): LLMMessage[] {
  const transcript = conversationHistory
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? nickname : "Fletcher"}: ${m.content}`)
    .join("\n\n");

  return [
    {
      role: "system",
      content: `당신은 대화 기록을 분석하여 요약하는 역할입니다. 점수를 매기지 마세요. 한국어로 응답하세요.`,
    },
    {
      role: "user",
      content: `다음 ${nickname} 크루와 Fletcher의 대화 기록을 분석하고 요약해주세요.

학습 범위:
${curriculum}

대화 기록:
${transcript}

다음 JSON 형식으로 요약하세요:
{
  "topicsDiscussed": ["대화에서 다룬 학습 주제들"],
  "deepDives": ["깊이 있게 다뤘던 구체적 내용들 (미션명, 개념명 포함)"],
  "couldExploreMore": ["대화에서 언급됐지만 깊이 다루지 못한 주제들"],
  "notMentioned": ["전혀 언급되지 않은 학습 영역들"],
  "closingMessage": "수고했다는 따뜻한 마무리 메시지 (Fletcher 톤으로, 2-3문장)"
}

주의:
- 점수를 매기지 마세요
- 대화에서 실제로 언급된 내용만 기반으로 작성하세요
- closingMessage는 Fletcher답게 — 칭찬은 아끼되, 노력은 인정하는 톤으로

JSON만 출력하세요.`,
    },
  ];
}
