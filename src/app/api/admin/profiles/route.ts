import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { verifyAdminKey } from "@/lib/admin-auth";
import { sanitizeNickname } from "@/lib/sanitize";
import { getProvider, GENERATION_MODEL } from "@/lib/ai/registry";
import { logger } from "@/lib/logger";

const PROFILES_DIR = path.join(process.cwd(), "data", "profiles");

async function ensureDir() {
  await mkdir(PROFILES_DIR, { recursive: true });
}

interface Profile {
  nickname: string;
  rawData: string;
  summary: string;
  updatedAt: string;
}

// GET: 모든 프로필 목록 또는 특정 닉네임 프로필
export async function GET(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  await ensureDir();

  const nickname = req.nextUrl.searchParams.get("nickname");

  // 특정 닉네임 프로필
  if (nickname) {
    const sanitized = sanitizeNickname(nickname);
    try {
      const content = await readFile(path.join(PROFILES_DIR, `${sanitized}.json`), "utf-8");
      return NextResponse.json(JSON.parse(content));
    } catch {
      return NextResponse.json({ nickname, rawData: "", summary: "" });
    }
  }

  // 전체 목록
  try {
    const files = await readdir(PROFILES_DIR);
    const profiles: Profile[] = [];
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      try {
        const content = await readFile(path.join(PROFILES_DIR, file), "utf-8");
        profiles.push(JSON.parse(content));
      } catch (error) {
        logger.error("Failed to parse profile", error);
      }
    }
    profiles.sort((a, b) => a.nickname.localeCompare(b.nickname));
    return NextResponse.json({ profiles });
  } catch (error) {
    logger.error("Failed to list profiles", error);
    return NextResponse.json({ profiles: [] });
  }
}

// POST: 프로필 저장 (raw 데이터 → LLM 요약 자동 생성)
export async function POST(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  await ensureDir();

  const body = await req.json();

  // 벌크 저장 모드
  if (body.bulk && Array.isArray(body.profiles)) {
    const saved: string[] = [];
    for (const p of body.profiles as { nickname: string; summary: string }[]) {
      if (!p.nickname?.trim()) continue;
      const sanitized = sanitizeNickname(p.nickname);
      const profile: Profile = {
        nickname: p.nickname.trim(),
        rawData: "",
        summary: p.summary ?? "",
        updatedAt: new Date().toISOString(),
      };
      await writeFile(path.join(PROFILES_DIR, `${sanitized}.json`), JSON.stringify(profile, null, 2), "utf-8");
      saved.push(p.nickname);
    }
    return NextResponse.json({ saved, count: saved.length });
  }

  // 개별 저장 모드
  const { nickname, rawData } = body as { nickname: string; rawData: string };

  if (!nickname?.trim()) {
    return NextResponse.json({ error: "nickname required" }, { status: 400 });
  }

  // LLM으로 비정형 데이터를 요약
  let summary = "";
  if (rawData?.trim()) {
    try {
      const provider = getProvider();
      summary = await provider.chat({
        model: GENERATION_MODEL,
        messages: [
          {
            role: "system",
            content: `당신은 학생 학습 정보를 정리하는 역할입니다.
주어진 비정형 데이터를 읽고, 인터뷰어가 참고할 수 있도록 간결하게 구조화하세요.

정리 형식:
- 완료한 미션/과제
- 강점 (잘하는 부분)
- 약점 (부족한 부분)
- 코치/리뷰어 피드백 요약
- 특이사항

정보가 없는 항목은 생략하세요. 원본 데이터에 없는 내용을 추측하지 마세요.
한국어로 작성하세요. 간결하게.`,
          },
          {
            role: "user",
            content: `다음은 "${nickname}" 학생의 학습 관련 비정형 데이터입니다. 정리해주세요.\n\n${rawData}`,
          },
        ],
        temperature: 0.2,
        maxTokens: 1024,
      });
    } catch (error) {
      logger.error("Failed to summarize profile with LLM", error);
      summary = rawData; // LLM 실패 시 원본 그대로
    }
  }

  const sanitized = sanitizeNickname(nickname);
  const profile: Profile = {
    nickname: nickname.trim(),
    rawData: rawData ?? "",
    summary,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(path.join(PROFILES_DIR, `${sanitized}.json`), JSON.stringify(profile, null, 2), "utf-8");

  return NextResponse.json(profile);
}

// DELETE: 프로필 삭제
export async function DELETE(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const { nickname } = (await req.json()) as { nickname: string };
  if (!nickname) return NextResponse.json({ error: "nickname required" }, { status: 400 });

  const sanitized = sanitizeNickname(nickname);
  try {
    const { rm } = await import("fs/promises");
    await rm(path.join(PROFILES_DIR, `${sanitized}.json`));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error("Failed to delete profile", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
