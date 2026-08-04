import { useEffect, useState } from "react";
import {
  getBooks,
  getChapterCount,
  getChapterVerses,
  getVerses,
  hasBibleData,
  searchVerses,
} from "../../data/bibleAdapter";
import { parseReference } from "../../data/bibleReference";
import { BibleVerse } from "../../shared/types";
import { abbreviateBook } from "../../data/bookAbbreviations";
import { buildBibleItem } from "../../engine/presentationEngine";
import { usePresentationStore } from "../../store/presentationStore";

export default function BiblePanel() {
  const [ready, setReady] = useState(false);
  const [books, setBooks] = useState<string[]>([]);
  const [book, setBook] = useState("");
  const [chapterCount, setChapterCount] = useState(1);
  const [chapter, setChapter] = useState(1);
  const [startVerse, setStartVerse] = useState(1);
  const [endVerse, setEndVerse] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [refQuery, setRefQuery] = useState("");
  const [refStatus, setRefStatus] = useState<string | null>(null);

  const [textQuery, setTextQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BibleVerse[]>([]);
  const [searchStatus, setSearchStatus] = useState<
    "idle" | "searching" | "done"
  >("idle");

  const displayMode = usePresentationStore((s) => s.displayMode);
  const splitLongVerses = usePresentationStore((s) => s.splitLongVerses);
  const loadItem = usePresentationStore((s) => s.loadItem);

  useEffect(() => {
    hasBibleData().then(async (has) => {
      setReady(has);
      if (!has) return;
      const b = await getBooks();
      setBooks(b);
      if (b.length > 0) setBook(b[0]);
    });
  }, []);

  useEffect(() => {
    if (!book) return;
    getChapterCount(book).then((count) => {
      setChapterCount(count);
      setChapter(1);
      setStartVerse(1);
      setEndVerse(1);
    });
  }, [book]);

  // Live-loads as the operator types a reference like "John 14:14",
  // "Rev 3:14", or just "Ps 23" / "Matthew 7" (whole chapter, no verse) —
  // stays quiet until the text is a complete, unambiguous reference, so
  // it doesn't fire on every half-typed keystroke.
  useEffect(() => {
    const parsed = parseReference(refQuery);
    if (!parsed) {
      setRefStatus(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const verses =
        parsed.verse !== null
          ? await getVerses({
              book: parsed.book,
              chapter: parsed.chapter,
              startVerse: parsed.verse,
              endVerse: parsed.verse,
            })
          : await getChapterVerses(parsed.book, parsed.chapter);

      if (cancelled) return;

      const refLabel = `${abbreviateBook(parsed.book)} ${parsed.chapter}${
        parsed.verse !== null ? `:${parsed.verse}` : ""
      }`;

      if (verses.length === 0) {
        setRefStatus(`No verses found for ${refLabel}`);
        return;
      }

      const first = verses[0].verse;
      const last = verses[verses.length - 1].verse;
      setBook(parsed.book);
      setChapter(parsed.chapter);
      setStartVerse(parsed.verse ?? first);
      setEndVerse(parsed.verse ?? last);

      const item = buildBibleItem(
        {
          book: parsed.book,
          chapter: parsed.chapter,
          startVerse: parsed.verse ?? first,
          endVerse: parsed.verse ?? last,
        },
        verses,
        displayMode,
        splitLongVerses
      );
      loadItem(item);
      setRefStatus(
        parsed.verse !== null
          ? `Loaded ${refLabel}`
          : `Loaded ${refLabel} (${verses.length} verses)`
      );
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refQuery]);

  useEffect(() => {
    const q = textQuery.trim();
    if (q.length < 3) {
      setSearchResults([]);
      setSearchStatus("idle");
      return;
    }
    setSearchStatus("searching");
    let cancelled = false;
    const timer = setTimeout(() => {
      searchVerses(q, 30).then((results) => {
        if (cancelled) return;
        setSearchResults(results);
        setSearchStatus("done");
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [textQuery]);

  async function handleLoad() {
    setError(null);
    const verses = await getVerses({ book, chapter, startVerse, endVerse });
    if (verses.length === 0) {
      setError("No verses found for that reference — check the verse numbers.");
      return;
    }
    const item = buildBibleItem(
      { book, chapter, startVerse, endVerse },
      verses,
      displayMode,
      splitLongVerses
    );
    loadItem(item);
  }

  function handleResultClick(v: BibleVerse) {
    setBook(v.book);
    setChapter(v.chapter);
    setStartVerse(v.verse);
    setEndVerse(v.verse);
    const item = buildBibleItem(
      { book: v.book, chapter: v.chapter, startVerse: v.verse, endVerse: v.verse },
      [v],
      displayMode,
      splitLongVerses
    );
    loadItem(item);
  }

  if (!ready) {
    return (
      <div className="bible-panel bible-panel-empty">
        <p>No Bible data loaded yet.</p>
        <p className="bible-panel-hint">
          Drop a KJV export at <code>src/data/bible.json</code> and rebuild the app.
        </p>
      </div>
    );
  }

  return (
    <div className="bible-panel">
      <label className="bible-field">
        <span>Jump to reference</span>
        <input
          type="text"
          placeholder="e.g. John 14:14"
          value={refQuery}
          onChange={(e) => setRefQuery(e.target.value)}
        />
      </label>
      {refStatus && (
        <p
          className={
            refStatus.startsWith("No verse") ? "modal-error" : "bible-ref-status"
          }
        >
          {refStatus}
        </p>
      )}

      <div className="bible-divider">or search by text</div>

      <label className="bible-field">
        <input
          type="text"
          placeholder="e.g. God so loved the world"
          value={textQuery}
          onChange={(e) => setTextQuery(e.target.value)}
        />
      </label>

      {searchStatus === "searching" && (
        <p className="bible-ref-status">Searching…</p>
      )}
      {searchStatus === "done" && searchResults.length === 0 && (
        <p className="modal-error">
          No verses found for &quot;{textQuery.trim()}&quot;
        </p>
      )}
      {searchResults.length > 0 && (
        <div className="bible-search-results">
          {searchResults.map((v) => (
            <button
              key={`${v.book}-${v.chapter}-${v.verse}`}
              className="bible-search-result"
              onClick={() => handleResultClick(v)}
            >
              <span className="bible-search-ref">
                {abbreviateBook(v.book)} {v.chapter}:{v.verse}
              </span>
              <span className="bible-search-snippet">{v.text}</span>
            </button>
          ))}
        </div>
      )}

      <div className="bible-divider">or browse by reference</div>

      <label className="bible-field">
        <span>Book</span>
        <select value={book} onChange={(e) => setBook(e.target.value)}>
          {books.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>

      <label className="bible-field">
        <span>Chapter</span>
        <select
          value={chapter}
          onChange={(e) => setChapter(Number(e.target.value))}
        >
          {Array.from({ length: chapterCount }, (_, i) => i + 1).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <div className="bible-verse-range">
        <label className="bible-field">
          <span>From verse</span>
          <input
            type="number"
            min={1}
            value={startVerse}
            onChange={(e) => setStartVerse(Number(e.target.value))}
          />
        </label>
        <label className="bible-field">
          <span>To verse</span>
          <input
            type="number"
            min={1}
            value={endVerse}
            onChange={(e) => setEndVerse(Number(e.target.value))}
          />
        </label>
      </div>

      {error && <p className="modal-error">{error}</p>}

      <button className="btn btn-primary bible-load-btn" onClick={handleLoad}>
        Load into preview
      </button>
    </div>
  );
}
