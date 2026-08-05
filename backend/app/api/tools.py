from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.tools.definitions import TOOL_DEFINITIONS
from app.tools.handlers import invoke_tool

router = APIRouter(prefix="/api/tools", tags=["tools"])


class ToolInvokeRequest(BaseModel):
    name: str = Field(description="Function name declared to Gemini Live")
    args: dict[str, Any] = Field(default_factory=dict)


class ToolInvokeResponse(BaseModel):
    name: str
    result: dict[str, Any]


@router.get("/definitions")
def get_tool_definitions() -> dict[str, Any]:
    return {"tools": [{"function_declarations": TOOL_DEFINITIONS}]}


@router.post("/invoke", response_model=ToolInvokeResponse)
def post_invoke_tool(body: ToolInvokeRequest) -> ToolInvokeResponse:
    if not body.name:
        raise HTTPException(status_code=400, detail="name is required")
    result = invoke_tool(body.name, body.args)
    return ToolInvokeResponse(name=body.name, result=result)
