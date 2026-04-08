from __future__ import annotations

import json
import os
from collections.abc import Awaitable, Callable
from typing import AsyncIterator

import httpx

from .provider_config import ProviderRuntimeConfig


class OllamaClient:
    def __init__(self, base_url: str, timeout_seconds: float = 300.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout_seconds

    async def list_models(self) -> list[str]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()

        payload = response.json()
        return [item["name"] for item in payload.get("models", []) if "name" in item]

    async def run_chat(self, model: str, final_prompt: str) -> str:
        request_payload = {
            "model": model,
            "messages": [{"role": "user", "content": final_prompt}],
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url}/api/chat", json=request_payload)
            response.raise_for_status()

        payload = response.json()
        message = payload.get("message") or {}
        return message.get("content", "")

    async def run_chat_stream(
        self,
        model: str,
        final_prompt: str,
        should_abort: Callable[[], Awaitable[bool]] | None = None,
    ) -> AsyncIterator[str]:
        request_payload = {
            "model": model,
            "messages": [{"role": "user", "content": final_prompt}],
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", f"{self.base_url}/api/chat", json=request_payload) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if should_abort and await should_abort():
                        break
                    if not line:
                        continue
                    payload = json.loads(line)
                    if payload.get("done"):
                        break
                    message = payload.get("message") or {}
                    content = message.get("content")
                    if content:
                        yield content

    async def run_chat_stream_messages(
        self,
        model: str,
        messages: list[dict[str, str]],
        should_abort: Callable[[], Awaitable[bool]] | None = None,
    ) -> AsyncIterator[str]:
        request_payload = {
            "model": model,
            "messages": messages,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", f"{self.base_url}/api/chat", json=request_payload) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if should_abort and await should_abort():
                        break
                    if not line:
                        continue
                    payload = json.loads(line)
                    if payload.get("done"):
                        break
                    message = payload.get("message") or {}
                    content = message.get("content")
                    if content:
                        yield content


class OllamaGateway:
    def __init__(self) -> None:
        timeout = float(os.getenv("MODEL_TIMEOUT_SECONDS", "300"))
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.client = OllamaClient(base_url=self.base_url, timeout_seconds=timeout)

    def get_client(self) -> OllamaClient:
        return self.client


class OpenAIClient:
    def __init__(self, config: ProviderRuntimeConfig, timeout_seconds: float = 300.0) -> None:
        self.config = config
        self.base_url = config.base_url.rstrip("/")
        self.timeout = timeout_seconds

    def _headers(self) -> dict[str, str]:
        if not self.config.api_key:
            raise ValueError("OpenAI API key saknas.")
        return {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

    async def list_models(self) -> list[str]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(f"{self.base_url}/models", headers=self._headers())
            response.raise_for_status()

        payload = response.json()
        models = [item["id"] for item in payload.get("data", []) if item.get("id")]
        return sorted(models)

    async def run_chat_stream_messages(
        self,
        model: str,
        messages: list[dict[str, str]],
        should_abort: Callable[[], Awaitable[bool]] | None = None,
    ) -> AsyncIterator[str]:
        request_payload = {
            "model": model,
            "messages": messages,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=request_payload,
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if should_abort and await should_abort():
                        break
                    if not line or not line.startswith("data:"):
                        continue

                    data = line[5:].strip()
                    if data == "[DONE]":
                        break

                    payload = json.loads(data)
                    choices = payload.get("choices") or []
                    if not choices:
                        continue

                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if content:
                        yield content
