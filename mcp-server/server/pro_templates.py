from __future__ import annotations

import hashlib
import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


class ProTemplatesNotConfigured(Exception):
    """Raised when SUPABASE_URL/SUPABASE_ANON_KEY/PROMPTBANKEN_MCP_KEY are missing."""


@dataclass(frozen=True)
class ProTemplatesClient:
    supabase_url: str
    supabase_anon_key: str
    mcp_key: str

    @classmethod
    def from_env(cls) -> "ProTemplatesClient":
        supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        supabase_anon_key = os.getenv("SUPABASE_ANON_KEY", "")
        mcp_key = os.getenv("PROMPTBANKEN_MCP_KEY", "")

        if not supabase_url or not supabase_anon_key or not mcp_key:
            raise ProTemplatesNotConfigured(
                "SUPABASE_URL, SUPABASE_ANON_KEY och PROMPTBANKEN_MCP_KEY måste vara satta "
                "som miljövariabler för att hämta Promptbanken Pro-mallar. Skapa en MCP-nyckel "
                "under admin.html och lägg in den i din MCP-klients konfiguration."
            )

        return cls(supabase_url=supabase_url, supabase_anon_key=supabase_anon_key, mcp_key=mcp_key)

    def _key_hash(self) -> str:
        return hashlib.sha256(self.mcp_key.encode("utf-8")).hexdigest()

    def _call_rpc(self, function_name: str) -> list[dict[str, Any]]:
        url = f"{self.supabase_url}/rest/v1/rpc/{function_name}"
        body = json.dumps({"p_key_hash": self._key_hash()}).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "apikey": self.supabase_anon_key,
                "Authorization": f"Bearer {self.supabase_anon_key}",
            },
        )

        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Kunde inte anropa {function_name} ({exc.code}): {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Kunde inte nå Supabase: {exc.reason}") from exc

    def list_templates(self) -> list[dict[str, Any]]:
        return self._call_rpc("get_pro_templates_for_mcp_key")

    def list_workspace_prompts(self) -> list[dict[str, Any]]:
        """Egna/team-delade prompts. Endast den första/primära MCP-nyckeln
        för ett team-workspace ser workspacets privata (ägarens) prompts --
        ytterligare nycklar ser bara workspace-delade prompts. Se
        migration 20260704110000_team_mcp_key_scope.sql."""
        return self._call_rpc("get_workspace_prompts_for_key")
