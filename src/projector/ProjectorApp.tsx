import { useEffect } from "react";
import { initProjectorBridge, useProjectorStore } from "../store/projectorStore";
import FitText from "./FitText";

/** Local Electron windows resolve media through the obh-media:// custom
 * protocol (streamed straight off disk); a remote wireless browser client
 * has no knowledge of that scheme, so it hits the wireless server's own
 * /media/ route instead — same id, different origin. */
function mediaUrl(id: string): string {
  return typeof window !== "undefined" && window.obh
    ? `obh-media://${id}`
    : `/media/${id}`;
}

export default function ProjectorApp() {
  useEffect(() => {
    initProjectorBridge();
  }, []);

  const { item, currentSlideIndex, isBlank, isLive, background } = useProjectorStore();
  const slide = item?.slides[currentSlideIndex] ?? null;

  if (isBlank || !isLive || !slide) {
    return <div className="projector-stage projector-stage--blank" />;
  }

  if (item?.type === "media" && item.media) {
    const src = mediaUrl(item.media.id);
    const isElectron = typeof window !== "undefined" && !!window.obh;
    return (
      <div className="projector-stage projector-stage--media">
        {item.media.kind === "video" ? (
          <video
            key={src}
            src={src}
            className="projector-media"
            autoPlay
            loop={item.media.loop}
            // A remote wireless browser never receives a user gesture on
            // this page, so it stays muted to guarantee autoplay still
            // works there. The real local projector plays with sound.
            muted={!isElectron}
            playsInline
          />
        ) : (
          <img key={src} src={src} className="projector-media" alt="" />
        )}
      </div>
    );
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
