import { useEffect, useState } from "react";
import { Hymn } from "../shared/types";
import { usePresentationStore } from "../store/presentationStore";
import { getChapterVerses, getVerses } from "../data/bibleAdapter";
import HymnList from "./components/HymnList";
import LivePreview from "./components/LivePreview";
import FooterToolbar from "./components/FooterToolbar";
import AddSongModal from "./components/AddSongModal";
import BiblePanel from "./components/BiblePanel";
import MediaPanel from "./components/MediaPanel";
import BackgroundModal from "./components/BackgroundModal";
import AboutModal from "./components/AboutModal";
import DisplayModal from "./components/DisplayModal";
import VoiceCommandButton from "./components/VoiceCommandButton";
import hymnsData from "../data/hymns.json";
import iconUrl from "../../assets/icon.png";
import { buildBibleItem } from "../engine/presentationEngine";

const libraryHymns: Hymn[] = (hymnsData as { hymns: Hymn[] }).hymns.map((h) => ({
  ...h,
  source: "library" as const,
}));

type SidebarTab = "hymns" | "bible" | "media";

export default function ControlApp() {
  const [projectorOpen, setProjectorOpen] = useState(false);
  const [customSongs, setCustomSongs] = useState<Hymn[]>([]);
  const [showAddSong, setShowAddSong] = useState(false);
  const [showBackground, setShowBackground] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showDisplays, setShowDisplays] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("hymns");
  const loadHymn = usePresentationStore((s) => s.loadHymn);
  const loadItem = usePresentationStore((s) => s.loadItem);
  const item = usePresentationStore((s) => s.item);

  useEffect(() => {
    window.obh?.listCustomSongs().then((songs) => setCustomSongs(songs ?? []));
  }, []);

  useEffect(() => {
    // Restore the last-used background on startup so the operator doesn't
    // have to re-pick it every time the app opens.
    window.obh?.loadBackgroundImage().then((dataUrl) => {
      if (dataUrl) usePresentationStore.getState().setBackground(dataUrl);
    });
  }, []);

  useEffect(() => {
    // Global transport hotkeys — right/left arrows advance slides, the
    // way EasyWorship/ProPresenter operators expect, regardless of which
    // panel has focus (as long as they're not typing in a text field).
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const { next, previous, toggleBlank } = usePresentationStore.getState();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        previous();
      } else if (e.key === "b" || e.key === "B") {
        toggleBlank();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleOpenProjector() {
    await window.obh?.openProjector();
    setProjectorOpen(true);
  }

  async function handleSaveSong(song: Hymn) {
    const updated = await window.obh?.saveCustomSong(song);
    setCustomSongs(updated ?? []);
  }

  async function handleDeleteSong(id: string) {
    const updated = await window.obh?.deleteCustomSong(id);
    setCustomSongs(updated ?? []);
  }

  const displayMode = usePresentationStore((s) => s.displayMode);
  const splitLongVerses = usePresentationStore((s) => s.splitLongVerses);
  const setSplitLongVerses = usePresentationStore((s) => s.setSplitLongVerses);
  const allSongs = [...libraryHymns, ...customSongs];

  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);

  function handleVoiceHymn(number: number) {
    const hymn = allSongs.find((h) => String(h.id) === String(number));
    if (hymn) {
      loadHymn(hymn);
      setVoiceStatus(`Loaded Hymn ${number}`);
    } else {
      setVoiceStatus(`No hymn numbered ${number}`);
    }
  }

  async function handleVoiceBible(book: string, chapter: number, verse: number | null) {
    const verses =
      verse !== null
        ? await getVerses({ book, chapter, startVerse: verse, endVerse: verse })
        : await getChapterVerses(book, chapter);

    if (verses.length === 0) {
      setVoiceStatus(`Couldn't find ${book} ${chapter}${verse !== null ? `:${verse}` : ""}`);
      return;
    }

    const first = verses[0].verse;
    const last = verses[verses.length - 1].verse;
    const bibleItem = buildBibleItem(
      { book, chapter, startVerse: verse ?? first, endVerse: verse ?? last },
      verses,
      displayMode,
      splitLongVerses
    );
    loadItem(bibleItem);
    setVoiceStatus(
      verse !== null
        ? `Loaded ${book} ${chapter}:${verse}`
        : `Loaded ${book} ${chapter} (${verses.length} verses)`
    );
  }

  return (
    <div className="control-shell">
      <header className="control-header">
        <div className="brand-lockup">
          <img className="brand-icon" src={iconUrl} alt="" />
          <div className="brand-text">
            <span className="brand">Only Believe</span>
            <span className="brand-subtitle">Hymns &amp; Bible</span>
          </div>
        </div>
        <div className="header-actions">
          {voiceStatus && <span className="voice-heard">{voiceStatus}</span>}
          <VoiceCommandButton
            onHymnCommand={handleVoiceHymn}
            onBibleCommand={handleVoiceBible}
          />
          <button className="btn" onClick={() => setShowBackground(true)}>
            Background
          </button>
          <button className="btn" onClick={() => setShowDisplays(true)}>
            Displays
          </button>
          <button className="btn" onClick={() => setShowAbout(true)}>
            About
          </button>
          <button className="btn btn-primary" onClick={handleOpenProjector}>
            {projectorOpen ? "Projector Open" : "Open Projector"}
          </button>
        </div>
      </header>

      <div className="control-body">
        <aside className="control-sidebar">
          <div className="sidebar-tabs">
            <button
              className={activeTab === "hymns" ? "tab active" : "tab"}
              onClick={() => setActiveTab("hymns")}
            >
              Hymns
            </button>
            <button
              className={activeTab === "bible" ? "tab active" : "tab"}
              onClick={() => setActiveTab("bible")}
            >
              Bible
            </button>
            <button
              className={activeTab === "media" ? "tab active" : "tab"}
              onClick={() => setActiveTab("media")}
            >
              Media
            </button>
          </div>

          {activeTab === "hymns" ? (
            <>
              <div className="sidebar-toolbar">
                <button
                  className="btn btn-add-song"
                  onClick={() => setShowAddSong(true)}
                >
                  + Add Song
                </button>
              </div>
              <HymnList
                hymns={allSongs}
                onSelect={loadHymn}
                onDelete={handleDeleteSong}
              />
            </>
          ) : activeTab === "bible" ? (
            <BiblePanel />
          ) : (
            <MediaPanel />
          )}
        </aside>

        <main className="control-main">
          <LivePreview item={item} />
        </main>
      </div>

      <FooterToolbar />

      {showAddSong && (
        <AddSongModal onClose={() => setShowAddSong(false)} onSave={handleSaveSong} />
      )}

      {showBackground && (
        <BackgroundModal onClose={() => setShowBackground(false)} />
      )}

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {showDisplays && <DisplayModal onClose={() => setShowDisplays(false)} />}
    </div>
  );
}
