from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException


def verify_admin_token(x_admin_token: str | None = Header(default=None)) -> None:
    configured = os.getenv("ADMIN_PANEL_TOKEN")
    if not configured:
        raise HTTPException(
            status_code=503,
            detail="ADMIN_PANEL_TOKEN är inte satt. Admin-API är inaktiverat tills token är konfigurerad.",
        )

    if not x_admin_token or not hmac.compare_digest(x_admin_token, configured):
        raise HTTPException(status_code=401, detail="Ogiltig admin-token")
