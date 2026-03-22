from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path
from typing import AsyncIterator

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .admin_security import verify_admin_token
from .llm_clients import OllamaGateway, OpenAIClient
from .prompt_repository import PromptRepository
from .provider_config import ProviderConfigService
from .schemas import (
    AdminProvidersResponse,
    ChatStreamRequest,
    ModelInfo,
    ModelsResponse,
    OpenAIConfigUpdateRequest,
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

app = FastAPI(title="Promptbanken Community LLM Gateway", version="0.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

repo_root = Path(__file__).resolve().parents[2]
prompt_repository = PromptRepository(repo_root=repo_root)
provider_config_service = ProviderConfigService(repo_root / "backend" / "data" / "providers.sqlite3")
ollama_gateway = OllamaGateway()


def build_final_prompt(prompt_text: str, user_input: str) -> str:
    return (
        "System/Instruktion:\n"
        f"{prompt_text.strip()}\n\n"
        "Anvandarens indata:\n"
        f"{user_input.strip()}"
    )


def _build_http_error_detail(exc: httpx.HTTPError, request_id: str, provider_name: str) -> dict[str, str | int | None]:
    request_url = str(exc.request.url) if exc.request else "unknown"
    request_method = exc.request.method if exc.request else "UNKNOWN"
    status_code: int | None = None
    body_excerpt: str | None = None

    if isinstance(exc, httpx.HTTPStatusError):
        status_code = exc.response.status_code
        body_excerpt = exc.response.text[:500]

    logger.error(
        "%s request failed request_id=%s method=%s url=%s status=%s error=%r body_excerpt=%r",
        provider_name,
        request_id,
        request_method,
        request_url,
        status_code,
        exc,
        body_excerpt,
    )

    return {
        "message": f"Kunde inte kora modell via {provider_name}.",
        "request_id": request_id,
        "upstream_status": status_code,
        "upstream_body_excerpt": body_excerpt,
        "error_type": exc.__class__.__name__,
    }


def _get_openai_client() -> OpenAIClient:
    config = provider_config_service.get_openai_runtime_config()
    if not config.enabled:
        raise HTTPException(status_code=503, detail="OpenAI ar inte aktiverat i backend.")
    if not config.api_key:
        raise HTTPException(status_code=503, detail="OpenAI API-nyckel saknas i backend-konfigurationen.")
    timeout = float(os.getenv("MODEL_TIMEOUT_SECONDS", "300"))
    return OpenAIClient(config=config, timeout_seconds=timeout)


@app.get("/api/providers", response_model=ProvidersResponse)
async def get_providers() -> ProvidersResponse:
    providers = [ProviderInfo(name="ollama")]
    openai = provider_config_service.get_openai_runtime_config()
    if openai.enabled and openai.api_key:
        providers.append(ProviderInfo(name="openai"))
    return ProvidersResponse(providers=providers)


@app.get("/api/models", response_model=ModelsResponse)
async def get_models() -> ModelsResponse:
    request_id = str(uuid.uuid4())

    try:
        models = await ollama_gateway.get_client().list_models()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=_build_http_error_detail(exc, request_id, "Ollama")) from exc

    return ModelsResponse(models=[ModelInfo(name=model) for model in models])


@app.get("/api/openai/models", response_model=ModelsResponse)
async def get_openai_models() -> ModelsResponse:
    request_id = str(uuid.uuid4())

    try:
        models = await _get_openai_client().list_models()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=_build_http_error_detail(exc, request_id, "OpenAI")) from exc

    return ModelsResponse(models=[ModelInfo(name=model) for model in models])


@app.post("/api/run", response_model=RunResponse)
async def run_prompt(request: RunRequest) -> RunResponse:
    request_id = str(uuid.uuid4())

    try:
        prompt_text = request.prompt_text or prompt_repository.get_prompt_text(request.prompt_id or "")
    except (KeyError, FileNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    final_prompt = build_final_prompt(prompt_text=prompt_text, user_input=request.user_input)

    try:
        answer = await ollama_gateway.get_client().run_chat(model=request.model, final_prompt=final_prompt)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=_build_http_error_detail(exc, request_id, "Ollama")) from exc

    logger.info("Prompt run success request_id=%s model=%s prompt_id=%s", request_id, request.model, request.prompt_id)
    return RunResponse(model=request.model, provider="ollama", prompt_used=final_prompt, response=answer)


@app.post("/api/chat/stream")
async def run_chat_stream(request: ChatStreamRequest, http_request: Request) -> StreamingResponse:
    request_id = str(uuid.uuid4())

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for chunk in ollama_gateway.get_client().run_chat_stream_messages(
                model=request.model,
                messages=[{"role": message.role, "content": message.content} for message in request.messages],
                should_abort=http_request.is_disconnected,
            ):
                yield chunk
            logger.info("Chat stream finished request_id=%s model=%s", request_id, request.model)
        except httpx.HTTPError as exc:
            error_detail = _build_http_error_detail(exc, request_id, "Ollama")
            logger.error("Chat stream failed detail=%s", error_detail)
            raise HTTPException(status_code=502, detail=error_detail) from exc

    return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")


@app.post("/api/openai/chat/stream")
async def run_openai_chat_stream(request: ChatStreamRequest, http_request: Request) -> StreamingResponse:
    request_id = str(uuid.uuid4())

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for chunk in _get_openai_client().run_chat_stream_messages(
                model=request.model,
                messages=[{"role": message.role, "content": message.content} for message in request.messages],
                should_abort=http_request.is_disconnected,
            ):
                yield chunk
            logger.info("OpenAI chat stream finished request_id=%s model=%s", request_id, request.model)
        except httpx.HTTPError as exc:
            error_detail = _build_http_error_detail(exc, request_id, "OpenAI")
            logger.error("OpenAI chat stream failed detail=%s", error_detail)
            raise HTTPException(status_code=502, detail=error_detail) from exc

    return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")


@app.post("/api/run/stream")
async def run_prompt_stream(request: RunRequest, http_request: Request) -> StreamingResponse:
    request_id = str(uuid.uuid4())

    try:
        prompt_text = request.prompt_text or prompt_repository.get_prompt_text(request.prompt_id or "")
    except (KeyError, FileNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    final_prompt = build_final_prompt(prompt_text=prompt_text, user_input=request.user_input)

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for chunk in ollama_gateway.get_client().run_chat_stream(
                model=request.model,
                final_prompt=final_prompt,
                should_abort=http_request.is_disconnected,
            ):
                yield chunk
            logger.info("Prompt stream finished request_id=%s model=%s prompt_id=%s", request_id, request.model, request.prompt_id)
        except httpx.HTTPError as exc:
            error_detail = _build_http_error_detail(exc, request_id, "Ollama")
            logger.error("Prompt stream failed detail=%s", error_detail)
            raise HTTPException(status_code=502, detail=error_detail) from exc

    return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")


@app.get("/api/admin/providers", response_model=AdminProvidersResponse, dependencies=[Depends(verify_admin_token)])
async def get_admin_providers() -> AdminProvidersResponse:
    return AdminProvidersResponse(providers=provider_config_service.list_provider_status())


@app.patch("/api/admin/providers/openai", response_model=AdminProvidersResponse, dependencies=[Depends(verify_admin_token)])
async def update_admin_openai_config(request: OpenAIConfigUpdateRequest) -> AdminProvidersResponse:
    provider_config_service.update_openai_config(
        enabled=request.enabled,
        api_key=request.api_key.strip() if request.api_key else None,
        base_url=request.base_url.strip() if request.base_url else None,
    )
    return AdminProvidersResponse(providers=provider_config_service.list_provider_status())


@app.post("/api/admin/providers/openai/test", dependencies=[Depends(verify_admin_token)])
async def test_admin_openai_config() -> dict[str, str | bool]:
    try:
        await _get_openai_client().list_models()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=_build_http_error_detail(exc, str(uuid.uuid4()), "OpenAI")) from exc

    return {"ok": True, "detail": "OpenAI-anslutningen fungerar."}
