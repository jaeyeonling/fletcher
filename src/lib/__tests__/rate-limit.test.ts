import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../rate-limit";

describe("checkRateLimit", () => {
  it("allows first request", () => {
    const result = checkRateLimit("test-1", { maxRequests: 3, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("allows requests within limit", () => {
    const key = "test-2";
    const config = { maxRequests: 3, windowMs: 60_000 };

    checkRateLimit(key, config);
    checkRateLimit(key, config);
    const result = checkRateLimit(key, config);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks requests over limit", () => {
    const key = "test-3";
    const config = { maxRequests: 2, windowMs: 60_000 };

    checkRateLimit(key, config);
    checkRateLimit(key, config);
    const result = checkRateLimit(key, config);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("different keys are independent", () => {
    const config = { maxRequests: 1, windowMs: 60_000 };

    checkRateLimit("key-a", config);
    const result = checkRateLimit("key-b", config);

    expect(result.allowed).toBe(true);
  });
});
