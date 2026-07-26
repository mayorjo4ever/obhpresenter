import { useLayoutEffect, useRef, useState } from "react";

const MAX_FONT = 84;
const MIN_FONT = 22;
const STEP = 2;

/**
 * Renders slide lines at the largest font size that still fits within the
 * container on both axes. Re-measures whenever the lines change (new
 * slide) or the window resizes. This is what stops long hymn verses from
 * overflowing off the projected screen.
 */
export default function FitText({ lines }: { lines: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(MAX_FONT);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    function fit() {
      let size = MAX_FONT;
      content!.style.fontSize = `${size}px`;
      while (
        size > MIN_FONT &&
        (content!.scrollHeight > container!.clientHeight ||
          content!.scrollWidth > container!.clientWidth)
      ) {
        size -= STEP;
        content!.style.fontSize = `${size}px`;
      }
      setFontSize(size);
    }

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [lines]);

  return (
    <div ref={containerRef} className="projector-fit-container">
      <div ref={contentRef} className="projector-fit-content" style={{ fontSize }}>
        {lines.map((line, i) => (
          <p className="projector-line" key={i}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
