import { useCallback, useEffect, useRef, useState } from "react";
import { createSession } from "./api/session";
import {
  CameraPreview,
  type CameraPreviewHandle,
} from "./components/CameraPreview";
import { SessionControls } from "./components/SessionControls";
import { StatusBar } from "./components/StatusBar";
import { StepPanel } from "./components/StepPanel";
import { Transcript } from "./components/Transcript";
import { LiveVoiceClient, type TranscriptEntry } from "./live/client";
import { emptyStepPanel, type StepPanelState } from "./live/toolsBridge";
import {
  captureJpegFromVideo,
  startCameraStream,
  startFrameLoop,
  type CameraStream,
} from "./vision/frames";

const CONTINUOUS_INTERVAL_MS = 1000;

export default function App() {
  const clientRef = useRef<LiveVoiceClient | null>(null);
  const cameraRef = useRef<CameraPreviewHandle>(null);
  const cameraStreamRef = useRef<CameraStream | null>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);

  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [continuous, setContinuous] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [sendingFrame, setSendingFrame] = useState(false);
  const [stepPanel, setStepPanel] = useState<StepPanelState>(emptyStepPanel);

  const upsertTranscript = useCallback((entry: TranscriptEntry) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx === -1) return [...prev, entry];
      const next = prev.slice();
      next[idx] = entry;
      return next;
    });
  }, []);

  const stopCamera = useCallback(() => {
    stopLoopRef.current?.();
    stopLoopRef.current = null;
    cameraStreamRef.current?.stop();
    cameraStreamRef.current = null;
    setCameraStream(null);
    setContinuous(false);
  }, []);

  useEffect(() => {
    return () => {
      void clientRef.current?.stop();
      stopCamera();
    };
  }, [stopCamera]);

  const sendLookFrame = useCallback(async (): Promise<boolean> => {
    const video = cameraRef.current?.getVideo();
    const client = clientRef.current;
    if (!video || !client) return false;

    setSendingFrame(true);
    try {
      const frame = await captureJpegFromVideo(video);
      if (!frame) {
        setError("Could not capture a camera frame yet — wait for the preview.");
        return false;
      }
      const ok = client.sendVideoFrame(frame);
      if (ok) {
        setLastSentAt(Date.now());
        setError(null);
      }
      return ok;
    } finally {
      setSendingFrame(false);
    }
  }, []);

  useEffect(() => {
    stopLoopRef.current?.();
    stopLoopRef.current = null;
    if (!active || !continuous || !cameraStream) return;

    stopLoopRef.current = startFrameLoop(CONTINUOUS_INTERVAL_MS, async () => {
      await sendLookFrame();
    });

    return () => {
      stopLoopRef.current?.();
      stopLoopRef.current = null;
    };
  }, [active, continuous, cameraStream, sendLookFrame]);

  const onStart = async () => {
    setBusy(true);
    setError(null);
    setEntries([]);
    setLastSentAt(null);
    setStepPanel(emptyStepPanel());
    try {
      const cam = await startCameraStream();
      cameraStreamRef.current = cam;
      setCameraStream(cam.stream);

      const payload = await createSession();
      const client = new LiveVoiceClient({
        onStatus: setStatus,
        onError: setError,
        onTranscript: upsertTranscript,
        onStepPanel: setStepPanel,
      });
      clientRef.current = client;
      await client.start(payload);
      setActive(true);
    } catch (err) {
      stopCamera();
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
      stopCamera();
      await clientRef.current?.stop();
      clientRef.current = null;
      setActive(false);
      setStatus("Idle");
      setLastSentAt(null);
      setStepPanel(emptyStepPanel());
    } finally {
      setBusy(false);
    }
  };

  const onLook = () => {
    void sendLookFrame().then((ok) => {
      if (ok && !continuous) {
        clientRef.current?.nudgeAfterLook();
      }
    });
  };

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">Phase 3 · Voice + Vision + Tools</p>
        <h1>Assembly Assistant</h1>
        <p className="lede">
          Guided assembly with live voice, workbench stills, and kit manuals
          loaded through Gemini tools — try the Desk Lamp Mini kit.
        </p>
      </header>

      <main className="panel">
        <SessionControls
          active={active}
          busy={busy}
          onStart={() => void onStart()}
          onStop={() => void onStop()}
        />
        <div className="workspace">
          <CameraPreview
            ref={cameraRef}
            stream={cameraStream}
            lastSentAt={lastSentAt}
            continuous={continuous}
            onContinuousChange={setContinuous}
            onLook={onLook}
            lookDisabled={!active || busy || sendingFrame}
          />
          <StepPanel state={stepPanel} />
        </div>
        <StatusBar status={status} error={error} />
        <Transcript entries={entries} />
      </main>
    </div>
  );
}
