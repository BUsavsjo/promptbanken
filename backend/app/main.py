from __future__ import annotations

import logging
import uuid
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .llm_clients import ProviderRegistry
from .prompt_repository import PromptRepository
from .schemas import (
    ModelInfo,
    ModelsResponse,
    ProviderInfo,
    ProvidersResponse,
    RunRequest,
    RunResponse,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("promptbanken.gateway")

app = FastAPI(title="Promptbanken LLM Gateway", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

repo_root = Path(__file__).resolve().parents[2]
prompt_repository = PromptRepository(repo_root=repo_root)
provider_registry = ProviderRegistry()


def build_final_prompt(prompt_text: str, user_input: str) -> str:
    return (
        "System/Instruktion:\n"
        f"{prompt_text.strip()}\n\n"
        "Användarens indata:\n"
        f"{user_input.strip()}"
    )


def _http_error_to_detail(provider: str, exc: httpx.HTTPError, request_id: str) -> dict[str, str | int | None]:
    request_url = str(exc.request.url) if exc.request else "unknown"
    request_method = exc.request.method if exc.request else "UNKNOWN"
    status_code: int | None = None
    body_excerpt: str | None = None

    if isinstance(exc, httpx.HTTPStatusError):
        status_code = exc.response.status_code
        body_excerpt = exc.response.text[:500]

    logger.error(
        "Provider request failed request_id=%s provider=%s method=%s url=%s status=%s error=%r body_excerpt=%r",
        request_id,
        provider,
        request_method,
        request_url,
        status_code,
        exc,
        body_excerpt,
    )

    return {
        "message": f"Kunde inte köra modell via provider '{provider}'.",
        "provider": provider,
        "request_id": request_id,
        "upstream_status": status_code,
        "upstream_body_excerpt": body_excerpt,
        "error_type": exc.__class__.__name__,
    }


@app.get("/api/providers", response_model=ProvidersResponse)
async def get_providers() -> ProvidersResponse:
    providers = provider_registry.list_provider_names()
    return ProvidersResponse(providers=[ProviderInfo(name=name) for name in providers])


@app.get("/api/models", response_model=ModelsResponse)
async def get_models(provider: str = Query(default="ollama_local")) -> ModelsResponse:
    request_id = str(uuid.uuid4())

    try:
        models = await provider_registry.get(provider).list_models()
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=_http_error_to_detail(provider, exc, request_id)) from exc

    return ModelsResponse(models=[ModelInfo(name=model) for model in models])


@app.post("/api/run", response_model=RunResponse)
async def run_prompt(request: RunRequest) -> RunResponse:
    request_id = str(uuid.uuid4())

    try:
        prompt_text = request.prompt_text or prompt_repository.get_prompt_text(request.prompt_id or "")
    except (KeyError, FileNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    final_prompt = build_final_prompt(prompt_text=prompt_text, user_input=request.user_input)
    provider = request.provider

    try:
        answer = await provider_registry.get(provider).run_chat(model=request.model, final_prompt=final_prompt)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=_http_error_to_detail(provider, exc, request_id)) from exc

    logger.info(
        "Prompt run success request_id=%s provider=%s model=%s prompt_id=%s",
        request_id,
        provider,
        request.model,
        request.prompt_id,
    )
    return RunResponse(model=request.model, provider=provider, prompt_used=final_prompt, response=answer)
