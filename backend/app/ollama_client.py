from __future__ import annotations

import httpx


class OllamaClient:
    def __init__(self, base_url: str = "http://localhost:11434", timeout_seconds: float = 60.0) -> None:
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
            "messages": [
                {
                    "role": "user",
                    "content": final_prompt,
                }
            ],
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url}/api/chat", json=request_payload)
            response.raise_for_status()

        payload = response.json()
        message = payload.get("message") or {}
        return message.get("content", "")
