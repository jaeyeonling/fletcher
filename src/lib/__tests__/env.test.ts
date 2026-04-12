import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateEnv } from "../env";

describe("validateEnv", () => {
  beforeEach(() => {
    vi.stubEnv("AWS_REGION", "ap-northeast-2");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "test");
    vi.stubEnv("ADMIN_KEY", "test");
  });

  it("passes with all required vars set", () => {
    expect(() => validateEnv()).not.toThrow();
  });

  it("throws when AWS_REGION is missing", () => {
    vi.stubEnv("AWS_REGION", "");
    expect(() => validateEnv()).toThrow("AWS_REGION");
  });

  it("returns warning when AWS_ACCESS_KEY_ID not set", () => {
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    const { warnings } = validateEnv();
    expect(warnings.some((w) => w.includes("AWS_ACCESS_KEY_ID"))).toBe(true);
  });

  it("returns warning when ADMIN_KEY not set", () => {
    vi.stubEnv("ADMIN_KEY", "");
    const { warnings } = validateEnv();
    expect(warnings.some((w) => w.includes("ADMIN_KEY"))).toBe(true);
  });

  it("returns no warnings when everything is set", () => {
    const { warnings } = validateEnv();
    expect(warnings).toHaveLength(0);
  });
});
