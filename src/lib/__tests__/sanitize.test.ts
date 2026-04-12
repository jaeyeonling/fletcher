import { describe, it, expect } from "vitest";
import { sanitizeNickname, isValidId, safeJsonParse } from "../sanitize";

describe("sanitizeNickname", () => {
  it("keeps Korean characters", () => {
    expect(sanitizeNickname("네오")).toBe("네오");
  });

  it("keeps alphanumeric", () => {
    expect(sanitizeNickname("neo123")).toBe("neo123");
  });

  it("keeps hyphens and underscores", () => {
    expect(sanitizeNickname("neo-test_1")).toBe("neo-test_1");
  });

  it("keeps parentheses for nickname format", () => {
    expect(sanitizeNickname("네오(김재연)")).toBe("네오(김재연)");
  });

  it("keeps spaces", () => {
    expect(sanitizeNickname("hello world")).toBe("hello world");
  });

  it("removes path traversal", () => {
    expect(sanitizeNickname("../../etc")).toBe("__etc");
  });

  it("replaces slashes", () => {
    expect(sanitizeNickname("a/b\\c")).toBe("a_b_c");
  });
});

describe("isValidId", () => {
  it("accepts normal id", () => {
    expect(isValidId("abc-123")).toBe(true);
  });

  it("rejects path traversal", () => {
    expect(isValidId("../../../etc")).toBe(false);
  });

  it("rejects slashes", () => {
    expect(isValidId("a/b")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidId("")).toBe(false);
  });

  it("rejects very long strings", () => {
    expect(isValidId("a".repeat(201))).toBe(false);
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it("returns null for invalid JSON", () => {
    expect(safeJsonParse("not json")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(safeJsonParse("")).toBeNull();
  });
});
