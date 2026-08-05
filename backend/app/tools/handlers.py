from __future__ import annotations

from typing import Any

from app.services import manuals


def invoke_tool(name: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    if name == "list_manuals":
        return {"manuals": manuals.list_manuals()}

    if name == "get_assembly_step":
        return manuals.get_assembly_step(
            str(args.get("manual_id", "")),
            int(args.get("step_number", 0)),
        )

    if name == "lookup_part":
        return manuals.lookup_part(
            str(args.get("manual_id", "")),
            str(args.get("query", "")),
        )

    if name == "get_checklist":
        completed = args.get("completed_steps") or []
        if not isinstance(completed, list):
            completed = []
        return manuals.get_checklist(
            str(args.get("manual_id", "")),
            [int(n) for n in completed],
        )

    return {"error": f"Unknown tool: {name}"}
