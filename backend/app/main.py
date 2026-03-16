from __future__ import annotations

from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .ollama_client import OllamaClient
from .prompt_repository import PromptRepository
from .schemas import ModelInfo, ModelsResponse, RunRequest, RunResponse

app = FastAPI(title="Promptbanken Ollama Gateway", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

repo_root = Path(__file__).resolve().parents[2]
prompt_repository = PromptRepository(repo_root=repo_root)
ollama_client = OllamaClient()


def build_final_prompt(prompt_text: str, user_input: str) -> str:
    return (
        "System/Instruktion:\n"
        f"{prompt_text.strip()}\n\n"
        "Användarens indata:\n"
        f"{user_input.strip()}"
    )


@app.get("/api/models", response_model=ModelsResponse)
async def get_models() -> ModelsResponse:
    try:
        models = await ollama_client.list_models()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Kunde inte nå Ollama: {exc}") from exc

    return ModelsResponse(models=[ModelInfo(name=model) for model in models])


@app.post("/api/run", response_model=RunResponse)
async def run_prompt(request: RunRequest) -> RunResponse:
    try:
        prompt_text = request.prompt_text or prompt_repository.get_prompt_text(request.prompt_id or "")
    except (KeyError, FileNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    final_prompt = build_final_prompt(prompt_text=prompt_text, user_input=request.user_input)

    try:
        answer = await ollama_client.run_chat(model=request.model, final_prompt=final_prompt)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Kunde inte köra modell via Ollama: {exc}") from exc

    return RunResponse(model=request.model, prompt_used=final_prompt, response=answer)
