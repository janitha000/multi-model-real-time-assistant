# Multimodal Real-Time Assembly Assistant

Low-latency hardware assembly coach powered by **Gemini Live**. The browser streams mic audio (and optional camera stills) directly to Gemini over WebSocket using an **ephemeral token** minted by a Python FastAPI backend (API key never leaves the server).

## Current status — Phase 2 (Vision)

- Voice loop: start session → speak → hear Aria → barge-in interrupt
- Vision: camera preview, **Look** (on-demand JPEG), optional continuous **~1 FPS**
- Assembly manuals / tools: Phase 3

## Tech stack

| Layer | Stack |
|-------|--------|
| Backend | Python 3.11+, FastAPI, Uvicorn, `google-genai`, Pydantic Settings |
| Frontend | Vite, React 18, TypeScript, `@google/genai` |
| Realtime | Gemini Live (PCM 16 kHz in / 24 kHz out + JPEG frames), ephemeral tokens (`v1alpha`) |

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

4. Open http://localhost:5173 → **Start session** → allow **microphone + camera** (Chrome recommended).

5. Point the camera at your workbench → tap **Look**, or enable **Continuous (~1 FPS)**. Ask Aria what she sees.

## Architecture (Phase 2)

```text
Browser (mic PCM + JPEG frames) --WSS + ephemeral token--> Gemini Live
     ^                                                      |
     |                                                      +--> audio + transcripts
POST /api/session (FastAPI mints token with API key)
```

Frames are downscaled (max edge 768) JPEG stills — not continuous video understanding.

## API

- `GET /health` — liveness
- `POST /api/session` — returns `{ token, model, api_version, ... }`

## Notes

- If Live connect fails with a model error, update `GEMINI_LIVE_MODEL` in `backend/.env` to a current Live model from [Google’s Live docs](https://ai.google.dev/gemini-api/docs/live-api).
- Prefer Chrome for demos; keep continuous FPS off unless you need it (cost).
