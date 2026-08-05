from __future__ import annotations

from datetime import datetime, timedelta, timezone

from google import genai

from app.config import Settings
from app.prompts.assembly_coach import ASSEMBLY_COACH_SYSTEM_INSTRUCTION
from app.tools.definitions import live_tools_config


def create_live_ephemeral_token(settings: Settings) -> dict:
    """Mint a short-lived token for browser → Gemini Live (client-to-server)."""
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    now = datetime.now(tz=timezone.utc)
    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options={"api_version": "v1alpha"},
    )

    model = settings.gemini_live_model
    tools = live_tools_config()
    live_config = {
        "response_modalities": ["AUDIO"],
        "system_instruction": ASSEMBLY_COACH_SYSTEM_INSTRUCTION,
        "input_audio_transcription": {},
        "output_audio_transcription": {},
        "context_window_compression": {
            "sliding_window": {},
        },
        "tools": tools,
    }

    token = client.auth_tokens.create(
        config={
            "uses": 1,
            "expire_time": now + timedelta(minutes=30),
            "new_session_expire_time": now + timedelta(minutes=2),
            "live_connect_constraints": {
                "model": model,
                "config": live_config,
            },
        }
    )

    token_name = getattr(token, "name", None)
    if not token_name:
        raise RuntimeError("Gemini did not return an ephemeral token name")

    return {
        "token": token_name,
        "model": model,
        "api_version": "v1alpha",
        "expire_time": (now + timedelta(minutes=30)).isoformat(),
        "new_session_expire_time": (now + timedelta(minutes=2)).isoformat(),
        "tools": tools,
    }
