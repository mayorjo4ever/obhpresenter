import { useRef, useState } from "react";
import { parseVoiceCommand } from "../../data/voiceCommand";

interface Props {
  onHymnCommand: (number: number) => void;
  onBibleCommand: (book: string, chapter: number, verse: number | null) => void;
}

/**
 * Uses Chromium's built-in speech recognition (available in Electron since
 * it ships Chromium). Note: this talks to a network speech service, so it
 * needs an internet connection — it won't work fully offline.
 */
export default function VoiceCommandButton({ onHymnCommand, onBibleCommand }: Props) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(
    () => typeof window !== "undefined" && "webkitSpeechRecognition" in window
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  function start() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript as string;
      const result = parseVoiceCommand(transcript);
      if (result?.type === "hymn") {
        onHymnCommand(result.number);
      } else if (result?.type === "bible") {
        onBibleCommand(result.book, result.chapter, result.verse);
      }
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  if (!supported) return null;

  return (
    <button
      className={listening ? "btn btn-voice listening" : "btn btn-voice"}
      onClick={listening ? stop : start}
      title='Say "hymn 42" or "John 3 16"'
    >
      {listening ? "● Listening…" : "🎤 Voice"}
    </button>
  );
}
