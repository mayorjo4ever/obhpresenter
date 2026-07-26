import { useMemo, useState } from "react";
import { Hymn } from "../../shared/types";

interface Props {
  hymns: Hymn[];
  onSelect: (hymn: Hymn) => void;
  onDelete?: (id: string) => void;
}

export default function HymnList({ hymns, onSelect, onDelete }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hymns;
    return hymns.filter((h) => {
      if (h.title.toLowerCase().includes(q)) return true;
      if ((h.scripture ?? "").toLowerCase().includes(q)) return true;
      if (String(h.id).toLowerCase().includes(q)) return true;
      return h.chapters.some((block) =>
        block.verses.some((line) => line.toLowerCase().includes(q))
      );
    });
  }, [hymns, query]);

  return (
    <div className="hymn-list">
      <input
        className="hymn-search"
        placeholder="Search by title, number, or lyrics..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="hymn-list-items">
        {filtered.map((hymn) => (
          <div key={hymn.id} className="hymn-list-row">
            <button className="hymn-list-item" onClick={() => onSelect(hymn)}>
              <span className="hymn-number">
                {hymn.source === "custom" ? "★" : hymn.id}
              </span>
              <span className="hymn-title">{hymn.title}</span>
            </button>
            {hymn.source === "custom" && onDelete && (
              <button
                className="hymn-delete"
                title="Remove song"
                onClick={() => onDelete(String(hymn.id))}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="hymn-list-empty">No songs match "{query}".</p>
        )}
      </div>
    </div>
  );
}
