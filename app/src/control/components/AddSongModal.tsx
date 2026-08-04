import { useState } from "react";
import { Hymn } from "../../shared/types";
import { parseSongText } from "../../data/songImport";

interface RawSongShape {
  title?: string;
  scripture?: string;
  chapters?: Hymn["chapters"];
}

interface Props {
  onClose: () => void;
  onSave: (song: Hymn) => void;
}

function makeId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function AddSongModal({ onClose, onSave }: Props) {
  const [title, setTitle] = useState("");
  const [scripture, setScripture] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleImportFile() {
    setError(null);
    const result = await window.obh?.importSongFile();
    if (!result) return;

    if (result.filename.toLowerCase().endsWith(".json")) {
      try {
        const parsed = JSON.parse(result.content);
        const items: RawSongShape[] = Array.isArray(parsed) ? parsed : [parsed];
        for (const raw of items) {
          if (!raw.title || !raw.chapters) {
            throw new Error("Missing title or chapters");
          }
          onSave({
            id: makeId(),
            title: raw.title,
            scripture: raw.scripture,
            chapters: raw.chapters,
            source: "custom",
          });
        }
        onClose();
      } catch {
        setError(
          'That JSON file isn\'t in the expected shape: {"title": "...", "chapters": [...]}'
        );
      }
      return;
    }

    // Plain text: prefill the form so the operator can review before saving,
    // rather than guessing and saving something wrong.
    setTitle((prev) => prev || result.filename.replace(/\.[^.]+$/, ""));
    setLyrics(result.content);
  }

  function handleSave() {
    if (!title.trim()) {
      setError("Give the song a title first.");
      return;
    }
    if (!lyrics.trim()) {
      setError("Paste or import the lyrics first.");
      return;
    }
    onSave({
      id: makeId(),
      title: title.trim(),
      scripture: scripture.trim() || undefined,
      chapters: parseSongText(lyrics),
      source: "custom",
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add a special song</h3>

        <input
          className="modal-input"
          placeholder="Song title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="modal-input"
          placeholder="Scripture reference (optional)"
          value={scripture}
          onChange={(e) => setScripture(e.target.value)}
        />
        <textarea
          className="modal-textarea"
          placeholder={
            'Paste lyrics here.\n\nSeparate verses with a blank line.\nStart a block with "Chorus" on its own line to mark the chorus.'
          }
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          rows={10}
        />

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button className="btn" onClick={handleImportFile}>
            Import from file
          </button>
          <div className="modal-actions-right">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Save song
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
