from __future__ import annotations

from fastapi import APIRouter

from models.schemas import PortalEvent
from models.store import store

router = APIRouter(prefix="/audit", tags=["audit"])

SENSITIVE_PATTERNS = ("otp", "password", "captcha", "pin", "aadhaar_full")


def _redact(event: PortalEvent) -> PortalEvent:
    msg = (event.message or "").lower()
    if any(p in msg for p in SENSITIVE_PATTERNS):
        event.message = "[redacted]"
    return event


@router.post("/events", response_model=dict)
def post_event(event: PortalEvent) -> dict:
    store.add_audit(_redact(event))
    return {"ok": True}


@router.get("/cases/{case_id}", response_model=list[PortalEvent])
def list_case_events(case_id: str) -> list[PortalEvent]:
    return [e for e in store.audit_events if e.case_id == case_id]