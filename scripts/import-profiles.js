#!/usr/bin/env node

/**
 * 크루 학습 데이터 → Fletcher 프로필 변환 스크립트
 *
 * 사용법:
 *   node scripts/import-profiles.js <입력파일.json> [--dry-run]
 *
 * 입력: curriculum-skills 형식의 JSON (missions[].crews[] 구조)
 * 출력: data/profiles/{닉네임}.json
 *
 * 옵션:
 *   --dry-run    실제 파일 생성 없이 결과만 출력
 *   --clear      기존 프로필 전부 삭제 후 생성
 */

const fs = require("fs");
const path = require("path");

// ─── 설정 ──────────────────────────────────

const PROFILES_DIR = path.join(__dirname, "..", "data", "profiles");

// ─── 인자 파싱 ─────────────────────────────

const args = process.argv.slice(2);
const inputFile = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const clear = args.includes("--clear");

if (!inputFile) {
  console.error("사용법: node scripts/import-profiles.js <입력파일.json> [--dry-run] [--clear]");
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error("파일을 찾을 수 없습니다:", inputFile);
  process.exit(1);
}

// ─── 파싱 ──────────────────────────────────

console.log("📂 입력:", inputFile);
console.log("📁 출력:", PROFILES_DIR);
console.log("");

const data = JSON.parse(fs.readFileSync(inputFile, "utf8"));

if (!data.missions || !Array.isArray(data.missions)) {
  console.error("missions 배열이 없습니다. curriculum-skills 형식인지 확인해주세요.");
  process.exit(1);
}

// crewId → lmsUserName 매핑 (닉네임이 있는 미션에서 수집)
const idToName = new Map();
for (const m of data.missions) {
  for (const c of m.crews) {
    if (c.lmsUserName && c.lmsUserName !== c.crewId) {
      idToName.set(c.crewId, c.lmsUserName);
    }
  }
}

// 크루별 데이터 합산
const crewMap = new Map();

for (const m of data.missions) {
  for (const c of m.crews) {
    const name = idToName.get(c.crewId) || c.lmsUserName || c.crewId;
    if (!crewMap.has(name)) crewMap.set(name, []);
    const lines = crewMap.get(name);

    lines.push(`## ${m.mission} (사이클 ${m.cycle || "?"})`);
    if (c.prTitle) lines.push(`PR: ${c.prTitle}`);
    if (c.reviewCount) lines.push(`리뷰 ${c.reviewCount}건, 코멘트 ${c.commentCount || 0}건`);

    if (c.prestudy && c.prestudy.length) {
      lines.push("", "### 사전학습");
      for (const p of c.prestudy) {
        lines.push(`Q: ${p.question}`, `A: ${p.answer.slice(0, 500)}`, "");
      }
    }

    if (c.missionReflection && c.missionReflection.length) {
      lines.push("### 미션 회고");
      for (const r of c.missionReflection) {
        lines.push(`Q: ${r.question}`, `A: ${r.answer.slice(0, 500)}`, "");
      }
    }

    if (c.feedback && c.feedback.length) {
      lines.push("### 자기 점검");
      for (const f of c.feedback) {
        lines.push(`Q: ${f.question}`, `A: ${f.answer.slice(0, 500)}`, "");
      }
    }

    if (c.prReviews && c.prReviews.length) {
      lines.push("### 리뷰어 피드백");
      for (const r of c.prReviews) {
        lines.push(`[${r.state}] ${r.reviewer}: ${r.body.slice(0, 300)}`, "");
      }
    }

    if (c.prComments && c.prComments.length) {
      lines.push(`### 코드 리뷰 코멘트 (상위 ${Math.min(c.prComments.length, 10)}건)`);
      for (const co of c.prComments.slice(0, 10)) {
        lines.push(`${co.reviewer} (${co.path || ""}): ${co.body.slice(0, 200)}`, "");
      }
    }

    lines.push("---", "");
  }
}

// ─── 결과 출력 ─────────────────────────────

console.log(`✅ ${crewMap.size}명 크루 파싱 완료`);
console.log("");

// 미션별 참여 통계
const missionStats = {};
for (const m of data.missions) {
  const key = `${m.mission} 사이클${m.cycle}`;
  missionStats[key] = m.crews.length;
}
console.log("📊 미션별 참여:");
for (const [k, v] of Object.entries(missionStats)) {
  console.log(`   ${k}: ${v}명`);
}
console.log("");

// crewId 통합 통계
const mergedCount = idToName.size;
if (mergedCount > 0) {
  console.log(`🔗 ${mergedCount}명의 crewId가 닉네임으로 통합됨`);
  console.log("");
}

if (dryRun) {
  console.log("🏃 dry-run 모드 — 파일 생성 건너뜀");
  console.log("");
  console.log("크루 목록:");
  for (const name of crewMap.keys()) {
    console.log(`   ${name}`);
  }
  process.exit(0);
}

// ─── 파일 생성 ─────────────────────────────

fs.mkdirSync(PROFILES_DIR, { recursive: true });

if (clear) {
  const existing = fs.readdirSync(PROFILES_DIR).filter((f) => f.endsWith(".json"));
  for (const f of existing) fs.unlinkSync(path.join(PROFILES_DIR, f));
  console.log(`🗑️  기존 프로필 ${existing.length}개 삭제`);
}

let created = 0;
let updated = 0;

for (const [name, lines] of crewMap) {
  const sanitized = name.replace(/[^a-zA-Z0-9가-힣_()-]/g, "_");
  const filepath = path.join(PROFILES_DIR, `${sanitized}.json`);
  const isUpdate = fs.existsSync(filepath);

  const profile = {
    nickname: name,
    rawData: lines.join("\n"),
    summary: lines.join("\n"),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filepath, JSON.stringify(profile, null, 2));

  if (isUpdate) updated++;
  else created++;
}

console.log("");
console.log(`📝 결과: ${created}명 생성, ${updated}명 업데이트`);
console.log(`📂 위치: ${PROFILES_DIR}`);
