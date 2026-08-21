from __future__ import annotations

from typing import Any


def get_step(steps_json: dict[str, Any], step_id: str) -> dict[str, Any] | None:
    if not steps_json:
        return None
    nodes = steps_json.get("nodes") or steps_json
    if isinstance(nodes, dict) and step_id in nodes:
        node = nodes[step_id]
        return node if isinstance(node, dict) else {"goal": str(node)}
    return None


def resolve_next_step(
    steps_json: dict[str, Any],
    current: str,
    proposed: str | None,
) -> str:
    if not proposed:
        return current
    nodes = steps_json.get("nodes") or steps_json
    if isinstance(nodes, dict) and proposed in nodes:
        step = nodes.get(current) if isinstance(nodes.get(current), dict) else {}
        allowed = (step or {}).get("allowed_next") if isinstance(step, dict) else None
        if allowed and proposed not in allowed:
            return current
        return proposed
    return current


def initial_step(steps_json: dict[str, Any]) -> str:
    if not steps_json:
        return "start"
    if "initial" in steps_json:
        return str(steps_json["initial"])
    nodes = steps_json.get("nodes") or steps_json
    if isinstance(nodes, dict):
        if "start" in nodes:
            return "start"
        return next(iter(nodes.keys()))
    return "start"
