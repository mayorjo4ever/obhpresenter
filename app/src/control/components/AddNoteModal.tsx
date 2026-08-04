import { useState } from "react";
import { NoteItem } from "../../shared/types";

const QUICK_LABELS = ["Topic", "Announcement", "News", "Welcome"];

interface Props {
  onClose: () => void;
  onSave: (note: { id?: string; title: string; body: string }) => void;
  initial?: NoteItem;
}

export default function AddNoteModal({ onClose, onSave, initial }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!body.trim()) {
      setError("Type the text you want to project first.");
      return;
    }
    onSave({ id: initial?.id, title: title.trim(), body: body.trim() });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? "Edit note" : "Add a note"}</h3>

        <div className="note-quick-labels">
          {QUICK_LABELS.map((label) => (
            <button
              key={label}
              className="btn btn-chip"
              onClick={() => setTitle(label)}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          className="modal-input"
          placeholder="Heading (optional) — e.g. Topic, Announcement, News"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="modal-textarea"
          placeholder={
            "The text to project — e.g. \"The Greatest Battle Ever Fought\".\n\nLong text auto-splits across screens the same way long hymn verses do."
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
        />

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <div className="modal-actions-right">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Save note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
