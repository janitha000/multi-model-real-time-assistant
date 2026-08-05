import type { TranscriptEntry } from "../live/client";

type Props = {
  entries: TranscriptEntry[];
};

export function Transcript({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="transcript empty">
        <p>Transcripts appear here once you start talking.</p>
      </div>
    );
  }

  return (
    <div className="transcript">
      {entries.map((entry) => (
        <div key={entry.id} className={`bubble ${entry.role}`}>
          <span className="role">{entry.role === "user" ? "You" : "Aria"}</span>
          <p>{entry.text}</p>
        </div>
      ))}
    </div>
  );
}
