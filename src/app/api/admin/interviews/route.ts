import { NextRequest, NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/admin-auth";
import { DEFAULT_MESSAGES, type InterviewConfig } from "@/lib/interview-config";
import db from "@/lib/db";
import { logger } from "@/lib/logger";

const listAll = db.prepare("SELECT * FROM interviews ORDER BY created_at DESC");
const findBySlug = db.prepare("SELECT * FROM interviews WHERE slug = ? AND id != ?");
const findById = db.prepare("SELECT * FROM interviews WHERE id = ?");

const upsert = db.prepare(`
  INSERT INTO interviews (id, slug, title, description, persona, curriculum, first_message, time_limit_minutes, warning_minutes, messages, active, deadline, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    slug=excluded.slug, title=excluded.title, description=excluded.description,
    persona=excluded.persona, curriculum=excluded.curriculum, first_message=excluded.first_message,
    time_limit_minutes=excluded.time_limit_minutes, warning_minutes=excluded.warning_minutes,
    messages=excluded.messages, active=excluded.active, deadline=excluded.deadline,
    updated_at=excluded.updated_at
`);

const deleteStmt = db.prepare("DELETE FROM interviews WHERE id = ?");

function rowToConfig(row: Record<string, unknown>): InterviewConfig {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    persona: (row.persona as string) ?? "",
    curriculum: (row.curriculum as string) ?? "",
    firstMessage: (row.first_message as string) ?? "",
    timeLimitMinutes: (row.time_limit_minutes as number) ?? 60,
    warningMinutes: JSON.parse((row.warning_minutes as string) ?? "[30,50,55,59]"),
    messages: { ...DEFAULT_MESSAGES, ...JSON.parse((row.messages as string) ?? "{}") },
    active: !!(row.active),
    deadline: (row.deadline as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// GET
export async function GET(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const rows = listAll.all() as Record<string, unknown>[];
  return NextResponse.json({ interviews: rows.map(rowToConfig) });
}

// POST
export async function POST(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const body = (await req.json()) as Partial<InterviewConfig>;
  const now = new Date().toISOString();
  const id = body.id ?? crypto.randomUUID().slice(0, 8);
  const slug = body.slug ?? id;

  // slug 중복 체크
  const existing = findBySlug.get(slug, id) as Record<string, unknown> | undefined;
  if (existing) {
    return NextResponse.json({ error: "이미 사용 중인 슬러그입니다" }, { status: 409 });
  }

  // 기존 데이터
  const prev = findById.get(id) as Record<string, unknown> | undefined;
  const prevConfig = prev ? rowToConfig(prev) : null;

  const interview: InterviewConfig = {
    id,
    slug,
    title: body.title ?? prevConfig?.title ?? "",
    description: body.description ?? prevConfig?.description ?? "",
    persona: body.persona ?? prevConfig?.persona ?? "",
    curriculum: body.curriculum ?? prevConfig?.curriculum ?? "",
    firstMessage: body.firstMessage ?? prevConfig?.firstMessage ?? "",
    timeLimitMinutes: body.timeLimitMinutes ?? prevConfig?.timeLimitMinutes ?? 60,
    warningMinutes: body.warningMinutes ?? prevConfig?.warningMinutes ?? [30, 50, 55, 59],
    messages: { ...DEFAULT_MESSAGES, ...prevConfig?.messages, ...body.messages },
    active: body.active ?? prevConfig?.active ?? true,
    deadline: body.deadline ?? prevConfig?.deadline,
    createdAt: prevConfig?.createdAt ?? now,
    updatedAt: now,
  };

  try {
    upsert.run(
      interview.id, interview.slug, interview.title, interview.description,
      interview.persona, interview.curriculum, interview.firstMessage,
      interview.timeLimitMinutes, JSON.stringify(interview.warningMinutes),
      JSON.stringify(interview.messages), interview.active ? 1 : 0,
      interview.deadline ?? null, interview.createdAt, interview.updatedAt,
    );
    return NextResponse.json(interview);
  } catch (error) {
    logger.error("Failed to save interview", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}

// DELETE
export async function DELETE(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const { id } = (await req.json()) as { id: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const result = deleteStmt.run(id);
  return NextResponse.json({ deleted: result.changes > 0 });
}
