from __future__ import annotations

import json
import logging
from typing import Any

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from agent_shared.schemas import LLMReply
from app.config import get_settings

logger = logging.getLogger(__name__)

REPLY_SCHEMA_HINT = """
Respond ONLY with valid JSON object:
{
  "text": "message to send to the lead in their language",
  "next_step": "step_id or null to stay",
  "needs_human": false,
  "converted": false,
  "closed": false
}
"""


def build_messages(
    system_prompt: str,
    step: dict[str, Any] | None,
    history: list[dict[str, str]],
    lead_fields: dict[str, Any],
    current_step: str,
) -> tuple[str, list[dict[str, str]]]:
    step_instr = ""
    if step:
        step_instr = f"\nCurrent step id: {current_step}\nStep goal: {step.get('goal') or step.get('description') or ''}\n"
        if step.get("instructions"):
            step_instr += f"Instructions: {step['instructions']}\n"
        if step.get("allowed_next"):
            step_instr += f"Allowed next steps: {step['allowed_next']}\n"

    system = (
        f"{system_prompt.strip()}\n"
        f"{step_instr}\n"
        f"Lead custom fields: {json.dumps(lead_fields, ensure_ascii=False)}\n"
        f"{REPLY_SCHEMA_HINT}"
    )
    return system, history


async def call_llm(
    *,
    model: str,
    temperature: float,
    system: str,
    history: list[dict[str, str]],
) -> tuple[LLMReply, int]:
    settings = get_settings()
    provider = settings.default_llm_provider
    model_name = model or settings.default_llm_model

    if model_name.startswith("claude") or provider == "anthropic":
        return await _call_anthropic(model_name, temperature, system, history)
    return await _call_openai(model_name, temperature, system, history)


async def _call_openai(
    model: str, temperature: float, system: str, history: list[dict[str, str]]
) -> tuple[LLMReply, int]:
    settings = get_settings()
    if not settings.openai_api_key:
        # Dev fallback without API key
        text = history[-1]["content"] if history else "Здравствуйте!"
        reply = LLMReply(text=f"[dev] Получил: {text[:200]}", next_step=None, needs_human=False)
        return reply, 0

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    messages = [{"role": "system", "content": system}]
    for m in history:
        messages.append({"role": m["role"], "content": m["content"]})

    resp = await client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=messages,
        response_format={"type": "json_object"},
    )
    content = resp.choices[0].message.content or "{}"
    tokens = int(resp.usage.total_tokens) if resp.usage else 0
    return _parse_reply(content), tokens


async def _call_anthropic(
    model: str, temperature: float, system: str, history: list[dict[str, str]]
) -> tuple[LLMReply, int]:
    settings = get_settings()
    if not settings.anthropic_api_key:
        reply = LLMReply(text="[dev] Привет! Чем могу помочь?", next_step=None)
        return reply, 0

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    messages = [{"role": m["role"], "content": m["content"]} for m in history if m["role"] in ("user", "assistant")]
    if not messages:
        messages = [{"role": "user", "content": "Начни диалог по сценарию."}]

    resp = await client.messages.create(
        model=model if model.startswith("claude") else "claude-3-5-haiku-latest",
        max_tokens=1024,
        temperature=temperature,
        system=system,
        messages=messages,
    )
    content = ""
    for block in resp.content:
        if hasattr(block, "text"):
            content += block.text
    tokens = int(resp.usage.input_tokens + resp.usage.output_tokens) if resp.usage else 0
    return _parse_reply(content), tokens


def _parse_reply(content: str) -> LLMReply:
    try:
        # extract JSON if wrapped in markdown
        text = content.strip()
        if "```" in text:
            start = text.find("{")
            end = text.rfind("}") + 1
            text = text[start:end]
        data = json.loads(text)
        return LLMReply.model_validate(data)
    except Exception:
        logger.exception("Failed to parse LLM reply")
        return LLMReply(text=content[:2000], next_step=None, needs_human=False)
