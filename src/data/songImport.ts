import { HymnBlock } from "../shared/types";

/**
 * Turns plain lyrics text into HymnBlock[] so custom/imported songs go
 * through the exact same presentation engine as the shipped hymnal.
 *
 * Convention: a blank line separates blocks. A block whose first line is
 * "chorus" (case-insensitive, brackets optional, e.g. "[Chorus]") is
 * tagged as the chorus instead of getting the next verse number.
 */
export function parseSongText(raw: string): HymnBlock[] {
  const blocks = raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  let verseNum = 0;

  return blocks.map((block) => {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const firstLine = (lines[0] ?? "").replace(/[[\]]/g, "").trim().toLowerCase();

    if (firstLine === "chorus") {
      return { chapter: "CHORUS", verses: lines.slice(1) };
    }

    verseNum += 1;
    return { chapter: verseNum, verses: lines };
  });
}
