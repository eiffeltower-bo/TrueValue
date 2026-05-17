from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

from app.settings import settings

logger = logging.getLogger(__name__)


class LLMClient:
    """Thin OpenAI wrapper that always returns parsed JSON, or None on failure.

    The "or None on failure" contract is load-bearing: every AI endpoint
    composes a deterministic baseline with an optional LLM layer. When the
    layer is unavailable (no key, offline mode, network error, malformed
    JSON), callers fall back gracefully instead of 500ing.

    We rely on OpenAI's `response_format={"type": "json_object"}` to force
    valid JSON output, but keep a tolerant extractor as a belt-and-braces
    fallback for older models or unexpected wrappers.
    """

    def __init__(self, api_key: str | None, model: str, offline: bool) -> None:
        self._model = model
        self._offline = offline or not api_key
        self._client: Any = None
        if not self._offline:
            try:
                from openai import OpenAI

                self._client = OpenAI(api_key=api_key)
            except Exception:
                logger.exception("Failed to init OpenAI client; running offline")
                self._offline = True

    @property
    def available(self) -> bool:
        return not self._offline

    def ask_json(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 800,
        temperature: float = 0.2,
    ) -> dict[str, Any] | None:
        if self._offline or self._client is None:
            return None
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                max_tokens=max_tokens,
                temperature=temperature,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
        except Exception:
            logger.exception("OpenAI call failed")
            return None

        text = (response.choices[0].message.content or "").strip()
        return _extract_json(text)


def _extract_json(text: str) -> dict[str, Any] | None:
    """Tolerate code fences and prose around the JSON payload.

    OpenAI's json_object mode normally returns clean JSON, but the
    extractor stays as defence in depth for misconfigured models or
    when the SDK is run without json mode.
    """
    if not text:
        return None
    candidate = text
    if "```" in candidate:
        # ```json ... ``` or ``` ... ```
        parts = candidate.split("```")
        for part in parts:
            stripped = part.strip()
            if stripped.startswith("json"):
                stripped = stripped[4:].strip()
            if stripped.startswith("{"):
                candidate = stripped
                break
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        return json.loads(candidate[start : end + 1])
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON payload: %s", text[:200])
        return None


@lru_cache(maxsize=1)
def get_llm_client() -> LLMClient:
    offline = settings.ai_mode == "offline"
    return LLMClient(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        offline=offline,
    )
