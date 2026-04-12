import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile, writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { verifyAdminKey } from "@/lib/admin-auth";
import { DEFAULT_MESSAGES, type InterviewConfig } from "@/lib/interview-config";
import { logger } from "@/lib/logger";

const INTERVIEWS_DIR = path.join(process.cwd(), "data", "interviews");

async function ensureDir() {
  await mkdir(INTERVIEWS_DIR, { recursive: true });
}

// GET: 모든 인터뷰 목록
export async function GET(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  await ensureDir();

  try {
    const files = await readdir(INTERVIEWS_DIR);
    const interviews: InterviewConfig[] = [];

    for (const file of files.filter((f) => f.endsWith(".json"))) {
      try {
        const content = await readFile(path.join(INTERVIEWS_DIR, file), "utf-8");
        interviews.push(JSON.parse(content));
      } catch (error) {
        logger.error("Failed to parse interview file", error);
      }
    }

    interviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ interviews });
  } catch (error) {
    logger.error("Failed to list interviews", error);
    return NextResponse.json({ interviews: [] });
  }
}

// POST: 인터뷰 생성/수정
export async function POST(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  await ensureDir();

  const body = (await req.json()) as Partial<InterviewConfig>;

  const now = new Date().toISOString();
  const id = body.id ?? crypto.randomUUID().slice(0, 8);
  const slug = body.slug ?? id;

  // slug 중복 체크
  const files = await readdir(INTERVIEWS_DIR);
  for (const file of files.filter((f) => f.endsWith(".json"))) {
    const content = await readFile(path.join(INTERVIEWS_DIR, file), "utf-8");
    const existing: InterviewConfig = JSON.parse(content);
    if (existing.slug === slug && existing.id !== id) {
      return NextResponse.json({ error: "이미 사용 중인 슬러그입니다" }, { status: 409 });
    }
  }

  // 기존 인터뷰가 있으면 업데이트
  const existingPath = path.join(INTERVIEWS_DIR, `${id}.json`);
  let existing: Partial<InterviewConfig> = {};
  try {
    const content = await readFile(existingPath, "utf-8");
    existing = JSON.parse(content);
  } catch (error) {
    logger.error("Failed to read existing interview for update", error);
  }

  const interview: InterviewConfig = {
    id,
    slug,
    title: body.title ?? existing.title ?? "",
    description: body.description ?? existing.description ?? "",
    persona: body.persona ?? existing.persona ?? "",
    curriculum: body.curriculum ?? existing.curriculum ?? "",
    firstMessage: body.firstMessage ?? existing.firstMessage ?? "",
    timeLimitMinutes: body.timeLimitMinutes ?? existing.timeLimitMinutes ?? 60,
    warningMinutes: body.warningMinutes ?? existing.warningMinutes ?? [30, 50, 55, 59],
    messages: { ...DEFAULT_MESSAGES, ...existing.messages, ...body.messages },
    active: body.active ?? existing.active ?? true,
    deadline: body.deadline ?? existing.deadline,
    createdAt: existing.createdAt ?? now,
    updatedAt: now,
  };

  await writeFile(existingPath, JSON.stringify(interview, null, 2), "utf-8");

  return NextResponse.json(interview);
}

// DELETE: 인터뷰 삭제
export async function DELETE(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const { id } = (await req.json()) as { id: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await rm(path.join(INTERVIEWS_DIR, `${id}.json`));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error("Failed to delete interview", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
