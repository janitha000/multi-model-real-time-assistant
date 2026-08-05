# Multimodal Real-Time Assembly Assistant

Low-latency hardware assembly coach powered by **Gemini Live**. The browser streams mic audio directly to Gemini over WebSocket using an **ephemeral token** minted by a Python FastAPI backend (API key never leaves the server).

## Phase 1 status

Voice loop only: start session → speak → hear Aria → barge-in interrupt. Camera and assembly tools come in later phases.

## Tech stack

| Layer | Stack |
|-------|--------|
| Backend | Python 3.11+, FastAPI, Uvicorn, `google-genai`, Pydantic Settings |
| Frontend | Vite, React 18, TypeScript, `@google/genai` |
| Realtime | Gemini Live (PCM 16 kHz in / 24 kHz out), ephemeral tokens (`v1alpha`) |

## Setup

1. Copy env template and set your key:

```bash
cp .env.example backend/.env
# Edit backend/.env — set GEMINI_API_KEY
```

2. Backend:

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

3. Frontend (new terminal):

```bash
cd frontend
npm install
npm run dev
```

4. Open http://localhost:5173 → **Start session** → allow microphone (Chrome recommended).

## Architecture (Phase 1)

```text
Browser (mic PCM) --WSS + ephemeral token--> Gemini Live
     ^                                         |
     |                                         +--> audio + transcripts
POST /api/session (FastAPI mints token with API key)
```

## API

- `GET /health` — liveness
- `POST /api/session` — returns `{ token, model, api_version, ... }`

## Notes

- If Live connect fails with a model error, update `GEMINI_LIVE_MODEL` in `backend/.env` to a current Live model from [Google’s Live docs](https://ai.google.dev/gemini-api/docs/live-api).
- Safari audio capture can be flaky; use Chrome for demos.
