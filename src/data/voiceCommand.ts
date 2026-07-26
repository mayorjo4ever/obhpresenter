/**
 * Best-effort parser for spoken commands like:
 *   "hymn 42" / "open hymn number 42"
 *   "John 3 16" / "go to John chapter 3 verse 16" / "John 3:16"
 *   "First Corinthians 13" / "1 Corinthians 13 4"
 *
 * The Web Speech API generally renders spoken numbers as digits already
 * ("forty two" -> "42"), so this parser leans on that rather than trying
 * to spell out every number word — the one systematic gap is ordinal book
 * prefixes ("First Corinthians"), which get normalized explicitly below.
 *
 * Book-name resolution is shared with the typed reference box — see
 * bibleReference.ts.
 */

import { normalizeOrdinalWords, resolveBookName } from "./bibleReference";

export interface VoiceHymnResult {
  type: "hymn";
  number: number;
}

export interface VoiceBibleResult {
  type: "bible";
  book: string;
  chapter: number;
  verse: number | null;
}

export type VoiceParseResult = VoiceHymnResult | VoiceBibleResult | null;

export function parseVoiceCommand(raw: string): VoiceParseResult {
  let text = normalizeOrdinalWords(raw.trim().toLowerCase());

  const hymnMatch = text.match(/hymn(?:\s+number)?\s+(\d+)/);
  if (hymnMatch) {
    return { type: "hymn", number: parseInt(hymnMatch[1], 10) };
  }

  text = text.replace(/^(open|go to|show|read|turn to|play)\s+/, "");

  const bibleMatch = text.match(
    /^((?:\d\s+|i{1,3}\s+)?[a-z]+(?:\s+of\s+[a-z]+)?)\s+(?:chapter\s+)?(\d+)(?:\s*(?:verse|:)?\s*(\d+))?$/
  );
  if (bibleMatch) {
    const book = resolveBookName(bibleMatch[1]);
    if (book) {
      return {
        type: "bible",
        book,
        chapter: parseInt(bibleMatch[2], 10),
        verse: bibleMatch[3] ? parseInt(bibleMatch[3], 10) : null,
      };
    }
  }

  return null;
}
