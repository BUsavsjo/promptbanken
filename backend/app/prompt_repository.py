from __future__ import annotations

import json
from pathlib import Path


class PromptRepository:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self.config_path = repo_root / "prompts.json"

    def get_prompt_text(self, prompt_id: str) -> str:
        prompts = self._load_config()
        match = next((prompt for prompt in prompts if prompt.get("id") == prompt_id), None)
        if not match:
            raise KeyError(f"Prompt '{prompt_id}' was not found")

        prompt_file = self.repo_root / match["file"]
        if not prompt_file.exists():
            raise FileNotFoundError(f"Prompt file '{match['file']}' was not found")

        return prompt_file.read_text(encoding="utf-8").strip()

    def _load_config(self) -> list[dict]:
        data = json.loads(self.config_path.read_text(encoding="utf-8"))
        return data.get("prompts", [])
