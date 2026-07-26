import { PresentationItem } from "../../shared/types";
import { usePresentationStore } from "../../store/presentationStore";

interface Props {
  item: PresentationItem | null;
}

export default function LivePreview({ item }: Props) {
  const cursorIndex = usePresentationStore((s) => s.cursor?.index ?? -1);
  const goTo = usePresentationStore((s) => s.goTo);

  if (!item) {
    return (
      <div className="live-preview empty">
        <p>Select a hymn to load it here.</p>
      </div>
    );
  }

  return (
    <div className="live-preview">
      <h2 className="live-preview-title">{item.title}</h2>
      <div className="slide-grid">
        {item.slides.map((slide, i) => (
          <button
            key={slide.id}
            className={`slide-thumb${i === cursorIndex ? " active" : ""}`}
            onClick={() => goTo(i)}
          >
            <span className="slide-label">{slide.label}</span>
            {slide.lines.map((line, li) => (
              <span className="slide-line" key={li}>
                {line}
              </span>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}
