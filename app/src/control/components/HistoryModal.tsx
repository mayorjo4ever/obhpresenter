import { useEffect, useState } from "react";
import { LogEntry } from "../../shared/types";

interface Props {
  onClose: () => void;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryModal({ onClose }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  useEffect(() => {
    window.obh?.listLog().then((list) => {
      setEntries((list ?? []).slice().reverse()); // newest first
      setLoading(false);
    });
  }, []);

  async function handleExport() {
    setExportMsg(null);
    const result = await window.obh?.exportLog();
    if (result?.saved) {
      setExportMsg(`Saved to ${result.filePath}`);
    } else if (result && !result.saved) {
      setExportMsg(null); // cancelled — no message needed
    }
  }

  async function handleClear() {
    const ok = window.confirm(
      "Clear the entire service log? This can't be undone."
    );
    if (!ok) return;
    const cleared = await window.obh?.clearLog();
    setEntries(cleared ?? []);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Service history</h3>
        <p className="modal-hint">
          Every hymn, Bible passage, note, and media item you've gone live
          with, most recent first.
        </p>

        {loading ? (
          <p className="modal-hint">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="hymn-list-empty">Nothing logged yet.</p>
        ) : (
          <div className="log-list">
            {entries.map((e) => (
              <div key={e.id} className="log-row">
                <span className="log-time">{formatTimestamp(e.timestamp)}</span>
                <span className={`log-type log-type--${e.type}`}>{e.type}</span>
                <span className="log-title">{e.title}</span>
              </div>
            ))}
          </div>
        )}

        {exportMsg && <p className="modal-hint">{exportMsg}</p>}

        <div className="modal-actions">
          <button className="btn" onClick={handleClear}>
            Clear log
          </button>
          <div className="modal-actions-right">
            <button className="btn" onClick={handleExport}>
              Export as .txt
            </button>
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
