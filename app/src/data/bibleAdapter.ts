import { BibleReference, BibleVerse } from "../shared/types";

/**
 * This app doesn't own Bible data — it borrows it. Point this at a JSON
 * export from your pgtranscript / Laravel KJV app (or any KJV source) in
 * this flat shape:
 *
 *   [{ "book": "John", "chapter": 3, "verse": 16, "text": "For God so loved..." }, ...]
 *
 * Drop the file at src/data/bible.json and this module will use it.
 * Until then, lookups just return an empty array so the rest of the app
 * still runs — the Bible tab will show "no data loaded" instead of crashing.
 */

let cache: BibleVerse[] | null = null;

async function loadAll(): Promise<BibleVerse[]> {
  if (cache) return cache;
  try {
    // Dynamic import so a missing file doesn't break the build.
    const mod = await import("./bible.json");
    cache = (mod.default ?? mod) as unknown as BibleVerse[];
  } catch {
    cache = [];
  }
  return cache;
}

export async function getVerses(ref: BibleReference): Promise<BibleVerse[]> {
  const all = await loadAll();
  return all.filter(
    (v) =>
      v.book.toLowerCase() === ref.book.toLowerCase() &&
      v.chapter === ref.chapter &&
      v.verse >= ref.startVerse &&
      v.verse <= ref.endVerse
  );
}

/** Every verse in a chapter, in order — used when a reference is typed or
 * spoken without a specific verse (e.g. "Ps 23", "Matthew 7"). */
export async function getChapterVerses(
  book: string,
  chapter: number
): Promise<BibleVerse[]> {
  const all = await loadAll();
  return all
    .filter((v) => v.book.toLowerCase() === book.toLowerCase() && v.chapter === chapter)
    .sort((a, b) => a.verse - b.verse);
}

export async function searchBooks(query: string): Promise<string[]> {
  const all = await loadAll();
  const books = Array.from(new Set(all.map((v) => v.book)));
  return books.filter((b) => b.toLowerCase().includes(query.toLowerCase()));
}

export async function getBooks(): Promise<string[]> {
  const all = await loadAll();
  const seen = new Set<string>();
  const books: string[] = [];
  for (const v of all) {
    if (!seen.has(v.book)) {
      seen.add(v.book);
      books.push(v.book);
    }
  }
  return books;
}

export async function getChapterCount(book: string): Promise<number> {
  const all = await loadAll();
  let max = 0;
  for (const v of all) {
    if (v.book === book && v.chapter > max) max = v.chapter;
  }
  return max;
}

export async function searchVerses(query: string, limit = 30): Promise<BibleVerse[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = await loadAll();
  const results: BibleVerse[] = [];
  for (const v of all) {
    if (v.text.toLowerCase().includes(q)) {
      results.push(v);
      if (results.length >= limit) break;
    }
  }
  return results;
}

export async function hasBibleData(): Promise<boolean> {
  const all = await loadAll();
  return all.length > 0;
}
