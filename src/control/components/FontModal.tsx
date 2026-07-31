import { PROJECTOR_FONTS, PROJECTOR_TEXT_COLORS } from "../../shared/types";
import { usePresentationStore } from "../../store/presentationStore";

interface Props {
  onClose: () => void;
}

export default function FontModal({ onClose }: Props) {
  const fontFamily = usePresentationStore((s) => s.fontFamily);
  const setFontFamily = usePresentationStore((s) => s.setFontFamily);
  const fontColor = usePresentationStore((s) => s.fontColor);
  const setFontColor = usePresentationStore((s) => s.setFontColor);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Projector font</h3>
        <p className="modal-hint">
          Choose the font and text color the projector uses for hymn and
          Bible text. Applies immediately, even while live — handy for
          switching to a darker color on a light background image.
        </p>

        <div className="font-grid">
          {PROJECTOR_FONTS.map((font) => (
            <button
              key={font}
              className={font === fontFamily ? "font-tile active" : "font-tile"}
              style={{ fontFamily: font }}
              onClick={() => setFontFamily(font)}
            >
              <span className="font-tile-sample">Aa</span>
              <span className="font-tile-name">{font}</span>
              {font === fontFamily && (
                <span className="font-tile-badge">In use</span>
              )}
            </button>
          ))}
        </div>

        <h4 className="modal-subheading">Text color</h4>
        <div className="color-swatch-row">
          {PROJECTOR_TEXT_COLORS.map((c) => (
            <button
              key={c.value}
              className={
                c.value.toLowerCase() === fontColor.toLowerCase()
                  ? "color-swatch active"
                  : "color-swatch"
              }
              style={{ backgroundColor: c.value }}
              title={c.name}
              onClick={() => setFontColor(c.value)}
            />
          ))}
          <label className="color-swatch-custom" title="Custom color">
            <input
              type="color"
              value={fontColor}
              onChange={(e) => setFontColor(e.target.value)}
            />
          </label>
        </div>

        <div className="modal-actions">
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
