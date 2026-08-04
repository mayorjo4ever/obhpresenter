import { useEffect, useState } from "react";
import { BackgroundGalleryState } from "../../shared/types";
import { usePresentationStore } from "../../store/presentationStore";

interface Props {
  onClose: () => void;
}

const EMPTY: BackgroundGalleryState = { images: [], activePath: null };

export default function BackgroundModal({ onClose }: Props) {
  const [gallery, setGallery] = useState<BackgroundGalleryState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const setBackground = usePresentationStore((s) => s.setBackground);

  useEffect(() => {
    window.obh?.listBackgroundGallery().then((state) => {
      setGallery(state ?? EMPTY);
      setLoading(false);
    });
  }, []);

  async function handleAdd() {
    const state = await window.obh?.addBackgroundImages();
    if (state) setGallery(state);
  }

  async function handleUse(imagePath: string) {
    const dataUrl = await window.obh?.setActiveBackground(imagePath);
    setGallery((g) => ({ ...g, activePath: imagePath }));
    setBackground(dataUrl ?? null);
  }

  async function handleNone() {
    const state = await window.obh?.clearActiveBackground();
    if (state) setGallery(state);
    setBackground(null);
  }

  async function handleRemove(imagePath: string) {
    const wasActive = gallery.activePath === imagePath;
    const state = await window.obh?.removeBackgroundImage(imagePath);
    if (state) setGallery(state);
    if (wasActive) setBackground(null);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Background gallery</h3>
        <p className="modal-hint">
          Pick which image the projector shows behind live text, or add more to
          build up a gallery for different occasions.
        </p>

        {loading ? (
          <p className="modal-hint">Loading…</p>
        ) : (
          <div className="background-grid">
            <button
              className={
                gallery.activePath === null
                  ? "background-thumb-none active"
                  : "background-thumb-none"
              }
              onClick={handleNone}
            >
              None
              {gallery.activePath === null && (
                <span className="background-thumb-badge">In use</span>
              )}
            </button>

            {gallery.images.map((img) => (
              <div
                key={img.path}
                className={
                  img.path === gallery.activePath
                    ? "background-thumb active"
                    : "background-thumb"
                }
              >
                <button
                  className="background-thumb-select"
                  onClick={() => handleUse(img.path)}
                  title="Use as projector background"
                >
                  <img src={img.thumbnail} alt="" />
                </button>
                {img.path === gallery.activePath && (
                  <span className="background-thumb-badge">In use</span>
                )}
                <button
                  className="background-thumb-remove"
                  onClick={() => handleRemove(img.path)}
                  title="Remove from gallery"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleAdd}>
            + Add images
          </button>
          <div className="modal-actions-right">
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
