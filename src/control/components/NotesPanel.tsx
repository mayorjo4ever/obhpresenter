import { useEffect, useState } from "react";
import { NoteItem, NoteLibraryState } from "../../shared/types";
import { usePresentationStore } from "../../store/presentationStore";
import AddNoteModal from "./AddNoteModal";

const EMPTY: NoteLibraryState = { items: [] };

export default function NotesPanel() {
  const [library, setLibrary] = useState<NoteLibraryState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<NoteItem | undefined>(undefined);
  const loadNote = usePresentationStore((s) => s.loadNote);

  useEffect(() => {
    window.obh?.listNotes().then((state) => {
      setLibrary(state ?? EMPTY);
      setLoading(false);
    });
  }, []);

  async function handleSave(note: { id?: string; title: string; body: string }) {
    const state = await window.obh?.saveNote(note);
    if (state) setLibrary(state);
  }

  async function handleRemove(id: string) {
    const state = await window.obh?.removeNote(id);
    if (state) setLibrary(state);
  }

  return (
    <div className="notes-panel">
      <div className="sidebar-toolbar">
        <button
          className="btn btn-add-song"
          onClick={() => {
            setEditing(undefined);
            setShowAdd(true);
          }}
        >
          + Add Note
        </button>
      </div>

      {loading ? (
        <p className="modal-hint">Loading…</p>
      ) : library.items.length === 0 ? (
        <p className="hymn-list-empty">
          No notes yet — add a Topic, Announcement, or News slide to project.
        </p>
      ) : (
        <div className="note-list">
          {library.items.map((note) => (
            <div key={note.id} className="note-list-row">
              <button
                className="note-list-item"
                onClick={() => loadNote(note)}
                title="Load this note"
              >
                <span className="note-list-title">{note.title || "Note"}</span>
                <span className="note-list-body">{note.body}</span>
              </button>
              <button
                className="note-list-edit"
                onClick={() => {
                  setEditing(note);
                  setShowAdd(true);
                }}
                title="Edit"
              >
                ✎
              </button>
              <button
                className="hymn-delete"
                onClick={() => handleRemove(note.id)}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddNoteModal
          initial={editing}
          onClose={() => setShowAdd(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
