import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";
import type { InterviewConfig } from "@/lib/interview-config";
import { logger } from "@/lib/logger";

// GET: slug로 인터뷰 조회 (public, 인증 불필요)
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "data", "interviews");

  try {
    const files = await readdir(dir);
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const content = await readFile(path.join(dir, file), "utf-8");
      const interview: InterviewConfig = JSON.parse(content);
      if (interview.slug === slug && interview.active) {
        // 마감 기한 체크
        if (interview.deadline && new Date(interview.deadline).getTime() < Date.now()) {
          return NextResponse.json({ error: "이 인터뷰는 마감되었습니다.", expired: true }, { status: 410 });
        }

        return NextResponse.json({
          id: interview.id,
          slug: interview.slug,
          title: interview.title,
          description: interview.description,
          curriculum: interview.curriculum,
          firstMessage: interview.firstMessage,
          timeLimitMinutes: interview.timeLimitMinutes,
          messages: interview.messages,
          warningMinutes: interview.warningMinutes,
          deadline: interview.deadline,
        });
      }
    }
  } catch (error) {
    logger.error("Failed to look up interview by slug", error);
  }

  return NextResponse.json({ error: "Interview not found" }, { status: 404 });
}
