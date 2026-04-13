import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const findAll = db.prepare("SELECT nickname FROM profiles");

export async function GET(req: NextRequest) {
  const nickname = req.nextUrl.searchParams.get("nickname");
  if (!nickname) return NextResponse.json({ exists: false });

  const inputLower = nickname.toLowerCase();
  const rows = findAll.all() as { nickname: string }[];

  for (const row of rows) {
    if (row.nickname.toLowerCase() === inputLower) {
      return NextResponse.json({ exists: true, matchedName: row.nickname });
    }

    const parenIndex = row.nickname.indexOf("(");
    const nickOnly = (parenIndex > 0 ? row.nickname.slice(0, parenIndex) : row.nickname).trim().toLowerCase();
    if (nickOnly === inputLower) {
      return NextResponse.json({ exists: true, matchedName: row.nickname });
    }
  }

  return NextResponse.json({ exists: false });
}
