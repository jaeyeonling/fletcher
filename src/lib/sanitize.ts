export function sanitizeNickname(nickname: string): string {
  return nickname
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "_")
    .trim();
}

/** ID 값에 경로 주입 문자가 없는지 검증 */
export function isValidId(id: string): boolean {
  if (!id || id.length > 200) return false;
  return !/[/\\]|\.\./.test(id);
}

/** JSON.parse 안전 래퍼 — 실패 시 null 반환, 내부 정보 비노출 */
export function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
