import { describe, it, expect } from "vitest";
import { MARKERS, stripMarkers } from "../markers";

describe("MARKERS", () => {
  it("has expected marker values", () => {
    expect(MARKERS.INTERVIEW_COMPLETE).toBe("[INTERVIEW_COMPLETE]");
    expect(MARKERS.SHOW_CODE).toBe("[SHOW_CODE]");
    expect(MARKERS.HIDE_CODE).toBe("[HIDE_CODE]");
  });
});

describe("stripMarkers", () => {
  it("removes INTERVIEW_COMPLETE marker", () => {
    expect(stripMarkers("수고했어. [INTERVIEW_COMPLETE]")).toBe("수고했어.");
  });

  it("removes SHOW_CODE marker", () => {
    expect(stripMarkers("코드로 보여줘. [SHOW_CODE]")).toBe("코드로 보여줘.");
  });

  it("removes HIDE_CODE marker", () => {
    expect(stripMarkers("됐어. 다음. [HIDE_CODE]")).toBe("됐어. 다음.");
  });

  it("removes multiple markers", () => {
    expect(stripMarkers("끝 [SHOW_CODE] [INTERVIEW_COMPLETE]")).toBe("끝");
  });

  it("returns unchanged text when no markers", () => {
    expect(stripMarkers("일반 텍스트")).toBe("일반 텍스트");
  });

  it("trims whitespace after removal", () => {
    expect(stripMarkers("  hello [SHOW_CODE]  ")).toBe("hello");
  });
});
