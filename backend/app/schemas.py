from pydantic import BaseModel, Field, model_validator


class RunRequest(BaseModel):
    prompt_id: str | None = Field(default=None, description="Prompt id from prompts.json")
    prompt_text: str | None = Field(default=None, description="Raw prompt text")
    user_input: str = Field(min_length=1, description="User provided text")
    model: str = Field(min_length=1, description="Ollama model name")

    @model_validator(mode="after")
    def validate_prompt_source(self) -> "RunRequest":
        if not self.prompt_id and not self.prompt_text:
            raise ValueError("Either prompt_id or prompt_text must be provided")
        return self


class RunResponse(BaseModel):
    model: str
    prompt_used: str
    response: str


class ModelInfo(BaseModel):
    name: str


class ModelsResponse(BaseModel):
    models: list[ModelInfo]
