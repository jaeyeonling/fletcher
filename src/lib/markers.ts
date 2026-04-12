export const MARKERS = {
  INTERVIEW_COMPLETE: "[INTERVIEW_COMPLETE]",
  SHOW_CODE: "[SHOW_CODE]",
  HIDE_CODE: "[HIDE_CODE]",
} as const;

export const ALL_MARKERS = Object.values(MARKERS);

export function stripMarkers(text: string): string {
  let result = text;
  for (const marker of ALL_MARKERS) {
    result = result.replace(marker, "");
  }
  return result.trim();
}
