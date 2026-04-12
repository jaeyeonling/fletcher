import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";

// GET: 닉네임으로 프로필 존재 여부 확인 (public, 인증 불필요)
export async function GET(req: NextRequest) {
  const nickname = req.nextUrl.searchParams.get("nickname");
  if (!nickname) return NextResponse.json({ exists: false });

  const profilesDir = path.join(process.cwd(), "data", "profiles");
  const inputLower = nickname.toLowerCase();

  try {
    const files = await readdir(profilesDir);

    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const content = await readFile(path.join(profilesDir, file), "utf-8");
      const profile = JSON.parse(content);
      const fullName = (profile.nickname ?? "") as string;

      // 정확히 일치
      if (fullName.toLowerCase() === inputLower) {
        return NextResponse.json({ exists: true, matchedName: fullName });
      }

      // 닉네임 부분 일치: "네오(김재연)" → "네오"
      const parenIndex = fullName.indexOf("(");
      const nickOnly = (parenIndex > 0 ? fullName.slice(0, parenIndex) : fullName).trim().toLowerCase();
      if (nickOnly === inputLower) {
        return NextResponse.json({ exists: true, matchedName: fullName });
      }
    }
  } catch {
    // profiles 디렉토리 없음
  }

  return NextResponse.json({ exists: false });
}
