// 범용 JSON 파서 — 구조에 의존하지 않고 "사람" 단위로 데이터를 그룹핑

const NAME_FIELD_HINTS = [
  "name", "username", "nickname", "crewid", "lmsusername",
  "userid", "student", "member", "crew",
];

const SKIP_FIELDS = new Set([
  "crewid", "prurl", "prcreatedat", "prclosedat", "domainfiles",
  "testfiles", "markdownfiles", "codepatterns", "inreplytoid",
  "createdat", "line", "path", "ref",
]);

function isNameField(key: string): boolean {
  const lower = key.toLowerCase();
  return NAME_FIELD_HINTS.some((hint) => lower.includes(hint));
}

function flattenToReadable(obj: unknown, depth = 0): string {
  if (depth > 5) return "";
  if (obj === null || obj === undefined) return "";
  if (typeof obj === "string") {
    const trimmed = obj.trim();
    return trimmed.length > 800 ? trimmed.slice(0, 800) + "..." : trimmed;
  }
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => flattenToReadable(item, depth + 1)).filter(Boolean).join("\n\n");
  }

  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    const parts: string[] = [];

    for (const [key, val] of entries) {
      if (SKIP_FIELDS.has(key.toLowerCase())) continue;
      const lowerKey = key.toLowerCase();

      if (lowerKey === "question" && typeof val === "string") {
        const answer = (obj as Record<string, unknown>)["answer"];
        if (typeof answer === "string") {
          parts.push(`Q: ${val.slice(0, 200)}\nA: ${answer.slice(0, 500)}`);
          continue;
        }
      }
      if (lowerKey === "answer") continue;

      if (lowerKey === "body" && typeof val === "string") {
        const reviewer = (obj as Record<string, unknown>)["reviewer"];
        const state = (obj as Record<string, unknown>)["state"];
        const prefix = [reviewer, state].filter(Boolean).join(" ");
        parts.push(prefix ? `${prefix}: ${(val as string).slice(0, 300)}` : (val as string).slice(0, 300));
        continue;
      }
      if (lowerKey === "reviewer" || lowerKey === "state") continue;

      const text = flattenToReadable(val, depth + 1);
      if (!text) continue;

      const header = key.replace(/([A-Z])/g, " $1").trim();
      if (typeof val === "object") {
        parts.push(`### ${header}\n${text}`);
      } else {
        parts.push(`**${header}**: ${text}`);
      }
    }

    return parts.join("\n\n");
  }

  return "";
}

export interface ParsedProfile {
  nickname: string;
  summary: string;
}

export function parseJsonToProfiles(data: unknown): ParsedProfile[] {
  const result = new Map<string, string[]>();

  function traverse(node: unknown, context: string) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const item of node) traverse(item, context);
      return;
    }

    const obj = node as Record<string, unknown>;
    const keys = Object.keys(obj);

    const nameFields = keys
      .filter((k) => isNameField(k) && typeof obj[k] === "string" && (obj[k] as string).trim())
      .sort((a, b) => {
        const aHas = a.toLowerCase().includes("name");
        const bHas = b.toLowerCase().includes("name");
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return 0;
      });

    if (nameFields.length > 0) {
      const personName = (obj[nameFields[0]] as string).trim();
      if (!result.has(personName)) result.set(personName, []);
      const contextLine = context ? `[${context}]` : "";
      const text = flattenToReadable(obj);
      if (text.length > 10) {
        result.get(personName)!.push(`${contextLine}\n${text}`);
      }
      return;
    }

    for (const key of keys) {
      const val = obj[key];
      const newContext = context ? `${context} > ${key}` : key;
      if (Array.isArray(val)) {
        for (const item of val) traverse(item, newContext);
      } else if (val && typeof val === "object") {
        traverse(val, newContext);
      }
    }
  }

  traverse(data, "");

  return Array.from(result.entries()).map(([name, entries]) => ({
    nickname: name,
    summary: entries.join("\n\n---\n\n"),
  }));
}
