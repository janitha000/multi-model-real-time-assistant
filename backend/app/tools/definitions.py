"""Gemini Live function declarations for assembly manuals."""

from __future__ import annotations

from typing import Any

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "list_manuals",
        "description": (
            "List available assembly kits/manuals. "
            "Invocation Condition: Call at the start of a session or when the user asks "
            "what kits are available / which kit to assemble."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {},
        },
    },
    {
        "name": "get_assembly_step",
        "description": (
            "Get detailed instructions for a specific assembly step, including parts and tips. "
            "Invocation Condition: Call whenever guiding the user through a numbered step, "
            "or when they ask what to do next / for step N of a known manual_id."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "manual_id": {
                    "type": "STRING",
                    "description": "Kit id from list_manuals, e.g. desk_lamp_mini",
                },
                "step_number": {
                    "type": "INTEGER",
                    "description": "1-based step number",
                },
            },
            "required": ["manual_id", "step_number"],
        },
    },
    {
        "name": "lookup_part",
        "description": (
            "Look up a part by id or name within a kit. "
            "Invocation Condition: Call when the user asks what a part is, where it is used, "
            "or holds up an unlabeled piece."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "manual_id": {
                    "type": "STRING",
                    "description": "Kit id from list_manuals",
                },
                "query": {
                    "type": "STRING",
                    "description": "Part id or free-text name, e.g. STEM-01 or shade ring",
                },
            },
            "required": ["manual_id", "query"],
        },
    },
    {
        "name": "get_checklist",
        "description": (
            "Return a progress checklist for a kit. "
            "Invocation Condition: Call when the user asks how far along they are, "
            "what is left, or wants a status summary. Pass completed_steps if known."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "manual_id": {
                    "type": "STRING",
                    "description": "Kit id from list_manuals",
                },
                "completed_steps": {
                    "type": "ARRAY",
                    "description": "Optional list of completed step numbers",
                    "items": {"type": "INTEGER"},
                },
            },
            "required": ["manual_id"],
        },
    },
]


def live_tools_config() -> list[dict[str, Any]]:
    """Shape expected by Gemini Live `tools` connect config."""
    return [{"function_declarations": TOOL_DEFINITIONS}]
