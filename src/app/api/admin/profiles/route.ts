import { NextRequest, NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/admin-auth";
import { getProvider, GENERATION_MODEL } from "@/lib/ai/registry";
import { logger } from "@/lib/logger";
import db from "@/lib/db";

const listAll = db.prepare("SELECT * FROM profiles ORDER BY nickname");
const findByNickname = db.prepare("SELECT * FROM profiles WHERE nickname = ?");
const upsert = db.prepare(`
  INSERT INTO profiles (nickname, raw_data, summary, updated_at)
  VALUES (?, ?, ?, datetime('now'))
  ON CONFLICT(nickname) DO UPDATE SET
    raw_data = excluded.raw_data,
    summary = excluded.summary,
    updated_at = datetime('now')
`);
const deleteStmt = db.prepare("DELETE FROM profiles WHERE nickname = ?");

// GET: 프로필 목록 또는 특정 닉네임
export async function GET(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const nickname = req.nextUrl.searchParams.get("nickname");

  if (nickname) {
    const row = findByNickname.get(nickname) as Record<string, unknown> | undefined;
    return NextResponse.json(row ?? { nickname, rawData: "", summary: "" });
  }

  const rows = listAll.all() as Record<string, unknown>[];
  const profiles = rows.map((r) => ({
    nickname: r.nickname,
    rawData: r.raw_data,
    summary: r.summary,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json({ profiles });
}

// POST: 개별 또는 벌크 저장
export async function POST(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const body = await req.json();

  // 벌크 저장
  if (body.bulk && Array.isArray(body.profiles)) {
    const insertMany = db.transaction((profiles: { nickname: string; summary: string }[]) => {
      for (const p of profiles) {
        if (p.nickname?.trim()) {
          upsert.run(p.nickname.trim(), "", p.summary ?? "");
        }
      }
      return profiles.length;
    });

    const count = insertMany(body.profiles);
    return NextResponse.json({ saved: count, count });
  }

  // 개별 저장
  const { nickname, rawData } = body as { nickname: string; rawData: string };
  if (!nickname?.trim()) {
    return NextResponse.json({ error: "nickname required" }, { status: 400 });
  }

  let summary = "";
  if (rawData?.trim()) {
    try {
      const provider = getProvider();
      summary = await provider.chat({
        model: GENERATION_MODEL,
        messages: [
          {
            role: "system",
            content: `학생 학습 정보를 정리하세요. 간결하게.
형식: 완료 미션, 강점, 약점, 리뷰어 피드백, 특이사항. 없는 항목은 생략. 추측 금지. 한국어.`,
          },
          { role: "user", content: `"${nickname}" 학생 데이터:\n\n${rawData}` },
        ],
        temperature: 0.2,
        maxTokens: 1024,
      });
    } catch (error) {
      logger.error("Failed to summarize profile", error);
      summary = rawData;
    }
  }

  upsert.run(nickname.trim(), rawData ?? "", summary);

  return NextResponse.json({ nickname: nickname.trim(), rawData: rawData ?? "", summary });
}

// DELETE
export async function DELETE(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const { nickname } = (await req.json()) as { nickname: string };
  if (!nickname) return NextResponse.json({ error: "nickname required" }, { status: 400 });

  const result = deleteStmt.run(nickname);
  return NextResponse.json({ deleted: result.changes > 0 });
}
