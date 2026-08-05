import { useCallback, useEffect, useRef, useState } from "react";
import { createSession } from "./api/session";
import { SessionControls } from "./components/SessionControls";
import { StatusBar } from "./components/StatusBar";
import { Transcript } from "./components/Transcript";
import { LiveVoiceClient, type TranscriptEntry } from "./live/client";

export default function App() {
  const clientRef = useRef<LiveVoiceClient | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);

  const upsertTranscript = useCallback((entry: TranscriptEntry) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx === -1) return [...prev, entry];
      const next = prev.slice();
      next[idx] = entry;
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      void clientRef.current?.stop();
    };
  }, []);

  const onStart = async () => {
    setBusy(true);
    setError(null);
    setEntries([]);
    try {
      const payload = await createSession();
      const client = new LiveVoiceClient({
        onStatus: setStatus,
        onError: setError,
        onTranscript: upsertTranscript,
      });
      clientRef.current = client;
      await client.start(payload);
      setActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setStatus("Idle");
      setActive(false);
    } finally {
      setBusy(false);
    }
  };

  const onStop = async () => {
    setBusy(true);
    try {
      await clientRef.current?.stop();
      clientRef.current = null;
      setActive(false);
      setStatus("Idle");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">Phase 1 · Gemini Live</p>
        <h1>Assembly Assistant</h1>
        <p className="lede">
          Low-latency voice coaching for hardware assembly. Your mic streams
          straight to Gemini Live; the API key stays on the server.
        </p>
      </header>

      <main className="panel">
        <SessionControls
          active={active}
          busy={busy}
          onStart={() => void onStart()}
          onStop={() => void onStop()}
        />
        <StatusBar status={status} error={error} />
        <Transcript entries={entries} />
      </main>
    </div>
  );
}
