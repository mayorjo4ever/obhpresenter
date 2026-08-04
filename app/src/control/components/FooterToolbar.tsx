import { usePresentationStore } from "../../store/presentationStore";

export default function FooterToolbar() {
  const previous = usePresentationStore((s) => s.previous);
  const next = usePresentationStore((s) => s.next);
  const toggleBlank = usePresentationStore((s) => s.toggleBlank);
  const goLive = usePresentationStore((s) => s.goLive);
  const stopLive = usePresentationStore((s) => s.stopLive);
  const isBlank = usePresentationStore((s) => s.isBlank);
  const isLive = usePresentationStore((s) => s.isLive);
  const item = usePresentationStore((s) => s.item);
  const cursor = usePresentationStore((s) => s.cursor);
  const splitLongVerses = usePresentationStore((s) => s.splitLongVerses);
  const setSplitLongVerses = usePresentationStore((s) => s.setSplitLongVerses);

  const disabled = !item;

  return (
    <footer className="footer-toolbar">
      <div className="transport">
        <button disabled={disabled || cursor?.isFirst} onClick={previous}>
          ◀ Prev
        </button>
        <span className="slide-position">
          {cursor ? `${cursor.index + 1} / ${item?.slides.length ?? 0}` : "—"}
        </span>
        <button disabled={disabled || cursor?.isLast} onClick={next}>
          Next ▶
        </button>
      </div>

      <div className="split-toggle" title="Applies to content loaded from now on">
        <span className="split-toggle-label">Long verses</span>
        <button
          className={!splitLongVerses ? "split-option active" : "split-option"}
          onClick={() => setSplitLongVerses(false)}
        >
          Full text
        </button>
        <button
          className={splitLongVerses ? "split-option active" : "split-option"}
          onClick={() => setSplitLongVerses(true)}
        >
          Split screens
        </button>
      </div>

      <div className="live-controls">
        <button
          className={isBlank ? "btn-active" : ""}
          disabled={disabled}
          onClick={toggleBlank}
        >
          Blank (B)
        </button>
        <button
          className={isLive ? "btn-live active" : "btn-live"}
          disabled={disabled}
          onClick={isLive ? stopLive : goLive}
        >
          {isLive ? "● LIVE" : "Go Live"}
        </button>
      </div>
    </footer>
  );
}
