from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.services.tokens import create_live_ephemeral_token

router = APIRouter(prefix="/api", tags=["session"])


class SessionResponse(BaseModel):
    token: str = Field(description="Ephemeral auth token for Gemini Live")
    model: str
    api_version: str = "v1alpha"
    expire_time: str | None = None
    new_session_expire_time: str | None = None


@router.post("/session", response_model=SessionResponse)
def create_session(settings: Settings = Depends(get_settings)) -> SessionResponse:
    try:
        payload = create_live_ephemeral_token(settings)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 — surface Gemini errors to the client
        raise HTTPException(
            status_code=502,
            detail=f"Failed to create ephemeral token: {exc}",
        ) from exc

    return SessionResponse(**payload)
