"""
LLM Client

Lightweight OpenAI wrapper. Per-request client keyed by API key.
"""

import logging

from openai import OpenAI

logger = logging.getLogger(__name__)


class LLMClient:
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)

    def chat(self, messages, model="gpt-4o-mini", temperature=0.1):
        try:
            res = self.client.chat.completions.create(
                model=model, messages=messages, temperature=temperature
            )
            return res.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return None


_cache: dict[str, LLMClient] = {}


def get_llm_client(api_key: str | None = None) -> LLMClient | None:
    if not api_key:
        return None
    if api_key not in _cache:
        _cache[api_key] = LLMClient(api_key)
    return _cache[api_key]
