type Props = {
  active: boolean;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function SessionControls({ active, busy, onStart, onStop }: Props) {
  return (
    <div className="controls">
      {!active ? (
        <button type="button" className="btn primary" disabled={busy} onClick={onStart}>
          {busy ? "Starting…" : "Start session"}
        </button>
      ) : (
        <button type="button" className="btn danger" disabled={busy} onClick={onStop}>
          {busy ? "Stopping…" : "Stop session"}
        </button>
      )}
    </div>
  );
}
