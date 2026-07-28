import {
  BibleReference,
  BibleVerse,
  DisplayMode,
  Hymn,
  HymnBlock,
  MediaItem,
  PresentationItem,
  Slide,
  SlideKind,
} from "../shared/types";
import { abbreviateBook } from "../data/bookAbbreviations";

/**
 * Turns raw content (a Hymn or a Bible passage) into an ordered list of
 * Slides ready for display. This is the ONLY place that decides slide
 * order and splitting — nothing upstream or downstream should re-derive it.
 */

let uid = 0;
function nextId(prefix: string) {
  uid += 1;
  return `${prefix}-${uid}`;
}

/**
 * Auto verse/chorus ordering: V1, Chorus, V2, Chorus, V3, Chorus...
 * If a hymn has no chorus, blocks just play in file order.
 * This is the *default* play order — the user can still jump to any
 * slide directly (see PresentationEngine.goTo), this only decides
 * what "next" advances to by default.
 */
function sequenceHymnBlocks(chapters: HymnBlock[]): HymnBlock[] {
  const chorus = chapters.find(
    (c) => String(c.chapter).toUpperCase() === "CHORUS"
  );
  const verses = chapters.filter(
    (c) => String(c.chapter).toUpperCase() !== "CHORUS"
  );

  if (!chorus) return chapters;

  const sequenced: HymnBlock[] = [];
  verses.forEach((verse, i) => {
    sequenced.push(verse);
    // Chorus after every verse, including the first — common hymn convention.
    // (Some hymns repeat chorus only after certain verses; if you spot one
    // that behaves differently, that's a per-hymn override, not an engine change.)
    sequenced.push(chorus);
    void i;
  });
  return sequenced;
}

function blockLabel(block: HymnBlock): string {
  return String(block.chapter).toUpperCase() === "CHORUS"
    ? "Chorus"
    : `Verse ${block.chapter}`;
}

// Screens show at most this many natural "lines" at once before advancing —
// for hymns those are the lyric's own original line breaks; for Bible
// verses (one continuous sentence) they're clauses split at punctuation.
const LINES_PER_SCREEN = 2;

function splitIntoClauses(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[,.;:!?])\s+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** Hymn lyrics already arrive as discrete authored lines — use those as-is.
 * A single block of prose (a Bible verse) has no such structure, so it's
 * broken at punctuation instead, which reads far more naturally than
 * cutting off mid-clause at a fixed word count. */
function naturalLines(lines: string[]): string[] {
  if (lines.length > 1) return lines;
  const clauses = splitIntoClauses(lines[0] ?? "");
  return clauses.length > 0 ? clauses : lines;
}

/**
 * Groups content into screens of ~2 natural lines each, so "Next" walks
 * through a verse clause by clause / line by line before moving on to the
 * next verse/chorus — rather than cramming everything onto one shrunk-down
 * slide, or cutting a fixed word count that ignores where the sentence
 * actually breaks.
 */
function buildChunkedSlides(
  lines: string[],
  label: string,
  kind: SlideKind,
  baseIndex: number,
  split: boolean
): Slide[] {
  if (!split) {
    return [{ id: nextId("slide"), kind, lines, label, index: baseIndex }];
  }

  const units = naturalLines(lines);

  if (units.length <= LINES_PER_SCREEN) {
    return [{ id: nextId("slide"), kind, lines: units, label, index: baseIndex }];
  }

  const chunks: Slide[] = [];
  for (let i = 0; i < units.length; i += LINES_PER_SCREEN) {
    chunks.push({
      id: nextId("slide"),
      kind,
      lines: units.slice(i, i + LINES_PER_SCREEN),
      label,
      index: baseIndex + chunks.length,
    });
  }
  return chunks;
}

export function buildHymnItem(
  hymn: Hymn,
  mode: DisplayMode,
  splitLongVerses = true
): PresentationItem {
  const ordered = sequenceHymnBlocks(hymn.chapters);
  const slides: Slide[] = [];

  ordered.forEach((block) => {
    const label = blockLabel(block);
    const cleanLines = block.verses
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (mode === "verse") {
      slides.push(
        ...buildChunkedSlides(cleanLines, label, "hymn-verse", slides.length, splitLongVerses)
      );
    } else {
      // line mode: one line per slide, still tagged with its block label
      cleanLines.forEach((line) => {
        slides.push({
          id: nextId("slide"),
          kind: "hymn-line",
          lines: [line],
          label,
          index: slides.length,
        });
      });
    }
  });

  const heading =
    typeof hymn.id === "number" ? `Hymn ${hymn.id} — ${hymn.title}` : hymn.title;

  return {
    id: nextId("item"),
    type: "hymn",
    title: heading,
    slides,
  };
}

export function buildBibleItem(
  reference: BibleReference,
  verses: BibleVerse[],
  mode: DisplayMode,
  splitLongVerses = true
): PresentationItem {
  const shortBook = abbreviateBook(reference.book);
  const title = `${shortBook} ${reference.chapter}:${reference.startVerse}${
    reference.endVerse !== reference.startVerse ? `-${reference.endVerse}` : ""
  }`;

  if (mode === "verse") {
    // Bible: each verse is naturally a "unit", but a long verse still gets
    // split into sequential chunks that share its reference label — the
    // person sees the whole verse, screen by screen, before it moves on.
    const slides: Slide[] = [];
    verses.forEach((v) => {
      const label = `${shortBook} ${v.chapter}:${v.verse}`;
      slides.push(
        ...buildChunkedSlides(
          [v.text.trim()],
          label,
          "bible-verse",
          slides.length,
          splitLongVerses
        )
      );
    });
    return { id: nextId("item"), type: "bible", title, slides };
  }

  // line mode: split long verses into individual lines by sentence-ish breaks
  const lineSlides: Slide[] = [];
  verses.forEach((v) => {
    const parts = v.text
      .trim()
      .split(/(?<=[;,])\s+/)
      .filter((p) => p.length > 0);
    (parts.length > 0 ? parts : [v.text]).forEach((part) => {
      lineSlides.push({
        id: nextId("slide"),
        kind: "bible-verse",
        lines: [part.trim()],
        label: `${shortBook} ${v.chapter}:${v.verse}`,
        index: lineSlides.length,
      });
    });
  });

  return { id: nextId("item"), type: "bible", title, slides: lineSlides };
}

export function buildMediaItem(media: MediaItem, loop = true): PresentationItem {
  // A single synthetic slide so the existing cursor/prev-next/live-preview
  // machinery works unchanged — a media item is just an item that always
  // has exactly one "slide" (the image or video itself).
  return {
    id: nextId("item"),
    type: "media",
    title: media.name,
    slides: [
      {
        id: nextId("slide"),
        kind: "blank",
        lines: [],
        label: media.name,
        index: 0,
      },
    ],
    media: { id: media.id, kind: media.kind, loop: media.kind === "video" ? loop : false },
  };
}

/**
 * Small stateful helper the control window uses to drive next/prev/goTo
 * over a PresentationItem. Kept separate from the Zustand store so it's
 * trivially unit-testable without React or Electron.
 */
export class PresentationCursor {
  constructor(
    public item: PresentationItem,
    public index: number = 0
  ) {}

  get slide(): Slide | null {
    return this.item.slides[this.index] ?? null;
  }

  next(): PresentationCursor {
    const i = Math.min(this.index + 1, this.item.slides.length - 1);
    return new PresentationCursor(this.item, i);
  }

  previous(): PresentationCursor {
    const i = Math.max(this.index - 1, 0);
    return new PresentationCursor(this.item, i);
  }

  goTo(index: number): PresentationCursor {
    const i = Math.max(0, Math.min(index, this.item.slides.length - 1));
    return new PresentationCursor(this.item, i);
  }

  get isFirst(): boolean {
    return this.index === 0;
  }

  get isLast(): boolean {
    return this.index === this.item.slides.length - 1;
  }
}
