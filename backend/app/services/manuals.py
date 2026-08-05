from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

MANUALS_ROOT = Path(__file__).resolve().parents[2] / "data" / "manuals"


@lru_cache
def _load_all() -> dict[str, dict[str, Any]]:
    manuals: dict[str, dict[str, Any]] = {}
    if not MANUALS_ROOT.exists():
        return manuals
    for path in MANUALS_ROOT.glob("*/manifest.json"):
        with path.open(encoding="utf-8") as fh:
            data = json.load(fh)
        manual_id = str(data["id"])
        manuals[manual_id] = data
    return manuals


def list_manuals() -> list[dict[str, Any]]:
    return [
        {
            "id": m["id"],
            "name": m["name"],
            "description": m.get("description", ""),
            "estimated_minutes": m.get("estimated_minutes"),
            "step_count": len(m.get("steps", [])),
            "part_count": len(m.get("parts", [])),
        }
        for m in _load_all().values()
    ]


def get_manual(manual_id: str) -> dict[str, Any] | None:
    return _load_all().get(manual_id)


def get_assembly_step(manual_id: str, step_number: int) -> dict[str, Any]:
    manual = get_manual(manual_id)
    if not manual:
        return {"error": f"Unknown manual_id: {manual_id}", "available": list(_load_all())}

    steps = manual.get("steps", [])
    match = next((s for s in steps if int(s["number"]) == int(step_number)), None)
    if not match:
        return {
            "error": f"Step {step_number} not found",
            "valid_steps": [s["number"] for s in steps],
        }

    part_ids = set(match.get("parts", []))
    parts = [p for p in manual.get("parts", []) if p["id"] in part_ids]
    return {
        "manual_id": manual_id,
        "manual_name": manual["name"],
        "step": match,
        "parts": parts,
        "total_steps": len(steps),
        "safety": manual.get("safety", []),
    }


def lookup_part(manual_id: str, query: str) -> dict[str, Any]:
    manual = get_manual(manual_id)
    if not manual:
        return {"error": f"Unknown manual_id: {manual_id}", "available": list(_load_all())}

    q = query.strip().lower()
    hits = []
    for part in manual.get("parts", []):
        hay = f"{part.get('id', '')} {part.get('name', '')} {part.get('description', '')}".lower()
        if q in hay:
            hits.append(part)

    if not hits:
        return {
            "manual_id": manual_id,
            "query": query,
            "matches": [],
            "hint": "No part matched. Try an id like STEM-01 or a name like 'shade'.",
        }
    return {"manual_id": manual_id, "query": query, "matches": hits}


def get_checklist(
    manual_id: str,
    completed_steps: list[int] | None = None,
) -> dict[str, Any]:
    manual = get_manual(manual_id)
    if not manual:
        return {"error": f"Unknown manual_id: {manual_id}", "available": list(_load_all())}

    done = {int(n) for n in (completed_steps or [])}
    steps = manual.get("steps", [])
    items = []
    for step in steps:
        num = int(step["number"])
        items.append(
            {
                "number": num,
                "title": step["title"],
                "status": "done" if num in done else "remaining",
            }
        )

    remaining = [i for i in items if i["status"] == "remaining"]
    next_step = remaining[0]["number"] if remaining else None
    return {
        "manual_id": manual_id,
        "manual_name": manual["name"],
        "checklist": items,
        "completed_count": len(done),
        "remaining_count": len(remaining),
        "next_step": next_step,
        "all_done": next_step is None,
    }
