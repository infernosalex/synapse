"""LangChain ChatOpenAI factory pre-configured for OpenRouter.

OpenRouter is OpenAI-API-compatible, so we point `langchain-openai`'s `ChatOpenAI` at its base URL and pass the OpenRouter key. The model id is supplied per-request (the user picks a different model per agent), so this module only manages the transport layer.
"""

from __future__ import annotations

from langchain_openai import ChatOpenAI

from app.config import get_settings

# OpenRouter's stable v1 endpoint. Hard-coded rather than read from env because every reachable OpenRouter deployment shares this prefix and pinning it here keeps tests' respx mounts simple.
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def build_chat_model(model: str, *, temperature: float = 0.0) -> ChatOpenAI:
    """Construct a `ChatOpenAI` bound to OpenRouter for the given model id.

    `temperature=0` is the default because every agent in this pipeline expects deterministic, structured output; callers can override per call (e.g. the Scribe summary section may benefit from a small amount of randomness later).
    """
    settings = get_settings()
    return ChatOpenAI(
        model=model,
        api_key=settings.openrouter_api_key,  # type: ignore[arg-type]
        base_url=OPENROUTER_BASE_URL,
        temperature=temperature,
    )
