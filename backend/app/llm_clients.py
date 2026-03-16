from __future__ import annotations

import os
from dataclasses import dataclass

import httpx


class ProviderConfigError(RuntimeError):
    """Raised when a provider is not configured correctly."""


@dataclass(slots=True)
class ProviderError(Exception):
    provider: str
    message: str
    request_id: str | None = None
    upstream_status: int | None = None
    upstream_body_excerpt: str | None = None
    error_type: str | None = None


class OllamaClient:
    def __init__(
        self,
        provider_name: str,
        base_url: str,
        timeout_seconds: float = 60.0,
        api_key: str | None = None,
    ) -> None:
        self.provider_name = provider_name
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout_seconds
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def list_models(self) -> list[str]:
        async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
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

        async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
            response = await client.post(f"{self.base_url}/api/chat", json=request_payload)
            response.raise_for_status()

        payload = response.json()
        message = payload.get("message") or {}
        return message.get("content", "")


class OpenAIClient:
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1", timeout_seconds: float = 60.0) -> None:
        if not api_key:
            raise ProviderConfigError("OPENAI_API_KEY saknas")

        self.base_url = base_url.rstrip("/")
        self.timeout = timeout_seconds
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def list_models(self) -> list[str]:
        async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
            response = await client.get(f"{self.base_url}/models")
            response.raise_for_status()

        payload = response.json()
        models = payload.get("data", [])
        return [item["id"] for item in models if "id" in item]

    async def run_chat(self, model: str, final_prompt: str) -> str:
        request_payload = {
            "model": model,
            "messages": [{"role": "user", "content": final_prompt}],
            "temperature": 0.2,
        }

        async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
            response = await client.post(f"{self.base_url}/chat/completions", json=request_payload)
            response.raise_for_status()

        payload = response.json()
        choices = payload.get("choices", [])
        if not choices:
            return ""

        message = choices[0].get("message") or {}
        return message.get("content", "")


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, OllamaClient | OpenAIClient] = {
            "ollama_local": OllamaClient(
                provider_name="ollama_local",
                base_url=os.getenv("OLLAMA_LOCAL_BASE_URL", "http://localhost:11434"),
                timeout_seconds=float(os.getenv("MODEL_TIMEOUT_SECONDS", "60")),
            )
        }

        ollama_cloud_url = os.getenv("OLLAMA_CLOUD_BASE_URL")
        if ollama_cloud_url:
            self._providers["ollama_cloud"] = OllamaClient(
                provider_name="ollama_cloud",
                base_url=ollama_cloud_url,
                timeout_seconds=float(os.getenv("MODEL_TIMEOUT_SECONDS", "60")),
                api_key=os.getenv("OLLAMA_CLOUD_API_KEY"),
            )

        openai_api_key = os.getenv("OPENAI_API_KEY")
        if openai_api_key:
            self._providers["openai"] = OpenAIClient(
                api_key=openai_api_key,
                base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
                timeout_seconds=float(os.getenv("MODEL_TIMEOUT_SECONDS", "60")),
            )

    def list_provider_names(self) -> list[str]:
        return sorted(self._providers.keys())

    def get(self, provider: str) -> OllamaClient | OpenAIClient:
        client = self._providers.get(provider)
        if not client:
            raise KeyError(f"Okänd provider '{provider}'. Tillgängliga: {', '.join(self.list_provider_names())}")
        return client
