/**
 * Shared book-name resolution used by both the voice command parser and
 * the typed "jump to reference" box — one alias table so "Mat", "Matt",
 * "Mt", spoken or typed, all resolve the same way.
 *
 * This covers the common abbreviation styles people actually type/say —
 * full name, the standard 3-4 letter abbreviation, and the shortest
 * 2-letter form where one is in common use. It intentionally does not try
 * to enumerate every abbreviation scheme ever published; if you type one
 * that's missing, tell me the exact form and I'll add it.
 */

const BOOK_ALIAS_GROUPS: Array<[string, string[]]> = [
  ["Genesis", ["genesis", "gen", "ge", "gn"]],
  ["Exodus", ["exodus", "exod", "exo", "ex"]],
  ["Leviticus", ["leviticus", "lev", "le", "lv"]],
  ["Numbers", ["numbers", "num", "numb", "nu", "nm"]],
  ["Deuteronomy", ["deuteronomy", "deut", "deu", "dt"]],
  ["Joshua", ["joshua", "josh", "jos", "jsh"]],
  ["Judges", ["judges", "judg", "jdg", "jg", "jdgs"]],
  ["Ruth", ["ruth", "rth", "ru"]],
  ["Samuel", ["samuel", "sam", "sm", "sa"]],
  ["Kings", ["kings", "kgs", "kg", "ki"]],
  ["Chronicles", ["chronicles", "chron", "chr", "ch"]],
  ["Ezra", ["ezra", "ezr", "ez"]],
  ["Nehemiah", ["nehemiah", "neh", "ne"]],
  ["Esther", ["esther", "esth", "est", "es"]],
  ["Job", ["job", "jb"]],
  ["Psalms", ["psalms", "psalm", "pslm", "psm", "pss", "ps"]],
  ["Proverbs", ["proverbs", "prov", "pro", "prv", "pr"]],
  ["Ecclesiastes", ["ecclesiastes", "eccles", "eccle", "eccl", "ecc", "qoh"]],
  [
    "Song of Solomon",
    ["song of solomon", "song of songs", "canticles", "cant", "sos", "song"],
  ],
  ["Isaiah", ["isaiah", "isa", "is"]],
  ["Jeremiah", ["jeremiah", "jer", "je", "jr"]],
  ["Lamentations", ["lamentations", "lam", "la"]],
  ["Ezekiel", ["ezekiel", "ezek", "eze", "ezk"]],
  ["Daniel", ["daniel", "dan", "da", "dn"]],
  ["Hosea", ["hosea", "hos", "ho"]],
  ["Joel", ["joel", "jl"]],
  ["Amos", ["amos", "am"]],
  ["Obadiah", ["obadiah", "obad", "ob"]],
  ["Jonah", ["jonah", "jnh", "jon"]],
  ["Micah", ["micah", "mic", "mc"]],
  ["Nahum", ["nahum", "nah", "na"]],
  ["Habakkuk", ["habakkuk", "hab", "hb"]],
  ["Zephaniah", ["zephaniah", "zeph", "zep", "zp"]],
  ["Haggai", ["haggai", "hag", "hg"]],
  ["Zechariah", ["zechariah", "zech", "zec", "zc"]],
  ["Malachi", ["malachi", "mal", "ml"]],
  ["Matthew", ["matthew", "matt", "mat", "mt"]],
  ["Mark", ["mark", "mrk", "mar", "mk", "mr"]],
  ["Luke", ["luke", "luk", "lk"]],
  ["John", ["john", "jhn", "joh", "jn"]],
  ["Acts", ["acts", "act", "ac"]],
  ["Romans", ["romans", "rom", "ro", "rm"]],
  ["Corinthians", ["corinthians", "cor", "co"]],
  ["Galatians", ["galatians", "gal", "ga"]],
  ["Ephesians", ["ephesians", "ephes", "eph"]],
  ["Philippians", ["philippians", "philip", "phil", "php"]],
  ["Colossians", ["colossians", "colo", "col"]],
  ["Thessalonians", ["thessalonians", "thess", "th"]],
  ["Timothy", ["timothy", "tim"]],
  ["Titus", ["titus", "tit", "ti"]],
  ["Philemon", ["philemon", "philem", "phlm", "phm", "pm"]],
  ["Hebrews", ["hebrews", "heb"]],
  ["James", ["james", "jas", "jm", "jam"]],
  ["Peter", ["peter", "pet", "pt", "pe"]],
  ["Jude", ["jude", "jud", "jd"]],
  ["Revelation", ["revelation", "revelations", "revel", "rev", "re"]],
];

export const BOOK_ALIASES: Record<string, string> = {};
for (const [canonical, aliases] of BOOK_ALIAS_GROUPS) {
  for (const alias of aliases) {
    BOOK_ALIASES[alias] = canonical;
  }
}

const NEEDS_NUMBER_PREFIX = new Set([
  "Samuel",
  "Kings",
  "Chronicles",
  "Corinthians",
  "Thessalonians",
  "Timothy",
  "Peter",
]);

/** Numbered-book prefixes people actually type: digit ("1"), Roman
 * numeral ("i", "ii", "iii"), or a spelled-out ordinal (handled earlier
 * by normalizeOrdinalWords, which turns those into digits first). */
const PREFIX_TO_DIGIT: Record<string, string> = {
  "1": "1",
  "2": "2",
  "3": "3",
  i: "1",
  ii: "2",
  iii: "3",
};

/** Resolves a spoken/typed book fragment ("rev", "1 cor", "ii kings",
 * "song of solomon") to its canonical name as it appears in bible.json
 * ("Revelation", "1 Corinthians", "2 Kings", "Song of Solomon"), or null
 * if unrecognized. */
export function resolveBookName(input: string): string | null {
  const parts = input.trim().split(/\s+/);
  let prefix: string | null = null;
  let rest = input.trim();

  if (parts[0] in PREFIX_TO_DIGIT) {
    prefix = PREFIX_TO_DIGIT[parts[0]];
    rest = parts.slice(1).join(" ");
  }

  const canonical = BOOK_ALIASES[rest];
  if (!canonical) return null;

  if (NEEDS_NUMBER_PREFIX.has(canonical)) {
    return `${prefix ?? "1"} ${canonical}`;
  }
  if (canonical === "John" && prefix) {
    return `${prefix} John`;
  }
  return canonical;
}

export function normalizeOrdinalWords(text: string): string {
  return text
    .replace(/\bfirst\b/g, "1")
    .replace(/\bsecond\b/g, "2")
    .replace(/\bthird\b/g, "3");
}

/** Strips a trailing abbreviation period ("Mat." -> "Mat") without
 * touching a period used as the chapter:verse separator ("3.5"). */
function stripAbbreviationDots(text: string): string {
  return text.replace(/([a-z])\.(?=\s|$)/gi, "$1");
}

export interface ParsedReference {
  book: string;
  chapter: number;
  /** null means "whole chapter" — no specific verse was given */
  verse: number | null;
}

/** Parses a typed reference like "John 14:14", "Mat 5:17", "Gen 3:14",
 * "1 Cor 3:5", "II Kings 4:1", "John 14 14" (space instead of colon), or
 * just a book+chapter with no verse ("Ps 23", "Matthew 7") — the latter
 * means "load the whole chapter". Requires at least book+chapter; used
 * for the live-loading reference box, which should stay quiet until the
 * person has typed something complete and unambiguous. */
export function parseReference(raw: string): ParsedReference | null {
  const text = stripAbbreviationDots(normalizeOrdinalWords(raw.trim().toLowerCase()));
  const match = text.match(
    /^((?:\d\s+|i{1,3}\s+)?[a-z]+(?:\s+of\s+[a-z]+)?)\s+(\d+)(?:\s*[:.\s]\s*(\d+))?$/
  );
  if (!match) return null;

  const book = resolveBookName(match[1]);
  if (!book) return null;

  return {
    book,
    chapter: parseInt(match[2], 10),
    verse: match[3] ? parseInt(match[3], 10) : null,
  };
}
