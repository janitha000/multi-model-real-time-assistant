type Props = {
  status: string;
  error: string | null;
};

export function StatusBar({ status, error }: Props) {
  return (
    <div className="status-bar" role="status">
      <span className="status-label">Status</span>
      <span className="status-value">{status}</span>
      {error ? <p className="status-error">{error}</p> : null}
    </div>
  );
}
