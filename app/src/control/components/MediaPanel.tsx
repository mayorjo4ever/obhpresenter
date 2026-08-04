import { useEffect, useState } from "react";
import { MediaItem, MediaLibraryState } from "../../shared/types";
import { usePresentationStore } from "../../store/presentationStore";

const EMPTY: MediaLibraryState = { items: [] };

/** Same origin convention as ProjectorApp — the control window is itself
 * a local Electron renderer, so it always uses the obh-media:// protocol. */
function mediaUrl(id: string): string {
  return `obh-media://${id}`;
}

export default function MediaPanel() {
  const [library, setLibrary] = useState<MediaLibraryState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loop, setLoop] = useState(true);
  const loadMedia = usePresentationStore((s) => s.loadMedia);
  const currentItem = usePresentationStore((s) => s.item);

  useEffect(() => {
    window.obh?.listMedia().then((state) => {
      setLibrary(state ?? EMPTY);
      setLoading(false);
    });
  }, []);

  async function handleAdd() {
    const state = await window.obh?.addMedia();
    if (state) setLibrary(state);
  }

  async function handleRemove(id: string) {
    const state = await window.obh?.removeMedia(id);
    if (state) setLibrary(state);
  }

  function handleSelect(item: MediaItem) {
    loadMedia(item, loop);
  }

  return (
    <div className="media-panel">
      <div className="sidebar-toolbar">
        <button className="btn btn-add-song" onClick={handleAdd}>
          + Add Media
        </button>
      </div>

      <label className="media-loop-toggle">
        <input
          type="checkbox"
          checked={loop}
          onChange={(e) => setLoop(e.target.checked)}
        />
        Loop videos
      </label>

      {loading ? (
        <p className="modal-hint">Loading…</p>
      ) : library.items.length === 0 ? (
        <p className="hymn-list-empty">
          No media yet — add an image or video to project it full-screen.
        </p>
      ) : (
        <div className="media-grid">
          {library.items.map((item) => {
            const isActive =
              currentItem?.type === "media" && currentItem.media?.id === item.id;
            return (
              <div
                key={item.id}
                className={isActive ? "media-tile active" : "media-tile"}
              >
                <button
                  className="media-tile-select"
                  onClick={() => handleSelect(item)}
                  title="Load this media"
                >
                  {item.kind === "image" ? (
                    <img src={mediaUrl(item.id)} alt="" />
                  ) : (
                    <div className="media-tile-video">
                      <span className="media-tile-video-icon">▶</span>
                    </div>
                  )}
                  <span className="media-tile-name">{item.name}</span>
                  <span className="media-tile-kind">{item.kind}</span>
                </button>
                <button
                  className="media-tile-remove"
                  onClick={() => handleRemove(item.id)}
                  title="Remove from library"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
