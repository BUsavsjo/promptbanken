from pydantic import BaseModel, Field, model_validator


class RunRequest(BaseModel):
    prompt_id: str | None = Field(default=None, description="Prompt id from prompts.json")
    prompt_text: str | None = Field(default=None, description="Raw prompt text")
    user_input: str = Field(min_length=1, description="User provided text")
    model: str = Field(min_length=1, description="Model name")
    provider: str = Field(default="ollama_local", description="LLM provider name")

    @model_validator(mode="after")
    def validate_prompt_source(self) -> "RunRequest":
        if not self.prompt_id and not self.prompt_text:
            raise ValueError("Either prompt_id or prompt_text must be provided")
        return self


class RunResponse(BaseModel):
    model: str
    provider: str
    prompt_used: str
    response: str


class ModelInfo(BaseModel):
    name: str


class ModelsResponse(BaseModel):
    models: list[ModelInfo]


class ProviderInfo(BaseModel):
    name: str


class ProvidersResponse(BaseModel):
    providers: list[ProviderInfo]


class AdminProviderInfo(BaseModel):
    name: str
    enabled: bool
    configured: bool
    masked_key: str | None = None
    base_url: str


class AdminProvidersResponse(BaseModel):
    providers: list[AdminProviderInfo]


class UpdateOpenAIConfigRequest(BaseModel):
    enabled: bool | None = None
    api_key: str | None = Field(default=None, min_length=1)
    base_url: str | None = Field(default=None, min_length=1)


class AdminProviderTestResponse(BaseModel):
    ok: bool
    provider: str
    detail: str
