export type SessionPayload = {
  token: string;
  model: string;
  api_version: string;
  expire_time?: string;
  new_session_expire_time?: string;
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

export async function createSession(): Promise<SessionPayload> {
  const res = await fetch(`${apiBase}/api/session`, { method: "POST" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Session create failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<SessionPayload>;
}
