import { useEffect } from "react";
import { initProjectorBridge, useProjectorStore } from "../store/projectorStore";
import FitText from "./FitText";

export default function ProjectorApp() {
  useEffect(() => {
    initProjectorBridge();
  }, []);

  const { item, currentSlideIndex, isBlank, isLive, background } = useProjectorStore();
  const slide = item?.slides[currentSlideIndex] ?? null;

  if (isBlank || !isLive || !slide) {
    return <div className="projector-stage projector-stage--blank" />;
  }

  const stageStyle = background
    ? { backgroundImage: `url("${background}")` }
    : undefined;

  return (
    <div className="projector-stage" style={stageStyle}>
      {item && <div className="projector-heading">{item.title}</div>}
      <FitText lines={slide.lines} />
      <div className="projector-label">{slide.label}</div>
    </div>
  );
}
