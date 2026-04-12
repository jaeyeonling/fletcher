import { describe, it, expect } from "vitest";
import {
  DEFAULT_PERSONA,
  DEFAULT_CURRICULUM,
  DEFAULT_FIRST_MESSAGE,
  DEFAULT_MESSAGES,
} from "../interview-config";

describe("DEFAULT_PERSONA", () => {
  it("contains Fletcher identity", () => {
    expect(DEFAULT_PERSONA).toContain("Fletcher");
  });

  it("contains Socratic questioning strategy", () => {
    expect(DEFAULT_PERSONA).toContain("소크라테스");
  });

  it("contains depth-over-breadth principle", () => {
    expect(DEFAULT_PERSONA).toContain("바닥까지");
  });

  it("contains do-not-repeat rule for unknown topics", () => {
    expect(DEFAULT_PERSONA).toContain("모르겠다");
  });
});

describe("DEFAULT_CURRICULUM", () => {
  it("has numbered items", () => {
    const lines = DEFAULT_CURRICULUM.split("\n").filter((l) => /^\d+\./.test(l.trim()));
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });
});

describe("DEFAULT_FIRST_MESSAGE", () => {
  it("contains nickname placeholder", () => {
    expect(DEFAULT_FIRST_MESSAGE).toContain("{nickname}");
  });

  it("contains curriculum placeholder", () => {
    expect(DEFAULT_FIRST_MESSAGE).toContain("{curriculum_formatted}");
  });

  it("contains call to action", () => {
    expect(DEFAULT_FIRST_MESSAGE).toContain("증명");
  });
});

describe("DEFAULT_MESSAGES", () => {
  it("has all required message keys", () => {
    expect(DEFAULT_MESSAGES).toHaveProperty("timeWarning");
    expect(DEFAULT_MESSAGES).toHaveProperty("timeUp");
    expect(DEFAULT_MESSAGES).toHaveProperty("lastMessagePlaceholder");
    expect(DEFAULT_MESSAGES).toHaveProperty("afterLastMessage");
    expect(DEFAULT_MESSAGES).toHaveProperty("completed");
    expect(DEFAULT_MESSAGES).toHaveProperty("timeExpiredPlaceholder");
  });

  it("timeWarning contains minutes placeholder", () => {
    expect(DEFAULT_MESSAGES.timeWarning).toContain("{minutes}");
  });
});
