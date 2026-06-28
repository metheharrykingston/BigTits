from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone

from models.schemas import AutomationBundle, CaseProfile

BUNDLE_TTL_MINUTES = int(os.getenv("BUNDLE_TTL_MINUTES", "30"))
SIGNING_SECRET = os.getenv("BUNDLE_SIGNING_SECRET", "dev-change-me-in-production")


def _canonical_payload(
    *,
    bundle_id: str,
    case_id: str,
    service_id: str,
    portal_id: str,
    start_url: str,
    allowed_hosts: list[str],
    profile: CaseProfile,
    documents: dict,
    adapter_version: str,
    issued_at: datetime,
    expires_at: datetime,
) -> str:
    body = {
        "bundle_id": bundle_id,
        "case_id": case_id,
        "service_id": service_id,
        "portal_id": portal_id,
        "start_url": start_url,
        "allowed_hosts": sorted(allowed_hosts),
        "profile": profile.model_dump(exclude_none=True),
        "documents": documents,
        "adapter_version": adapter_version,
        "issued_at": issued_at.isoformat(),
        "expires_at": expires_at.isoformat(),
    }
    return json.dumps(body, sort_keys=True, separators=(",", ":"))


def sign_bundle_parts(**kwargs) -> str:
    payload = _canonical_payload(**kwargs)
    digest = hmac.new(
        SIGNING_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return digest


def verify_bundle(bundle: AutomationBundle) -> bool:
    expected = sign_bundle_parts(
        bundle_id=bundle.bundle_id,
        case_id=bundle.case_id,
        service_id=bundle.service_id,
        portal_id=bundle.portal_id,
        start_url=bundle.start_url,
        allowed_hosts=bundle.allowed_hosts,
        profile=bundle.profile,
        documents={
            k: v.model_dump(exclude_none=True) for k, v in bundle.documents.items()
        },
        adapter_version=bundle.adapter_version,
        issued_at=bundle.issued_at,
        expires_at=bundle.expires_at,
    )
    if not hmac.compare_digest(expected, bundle.signature):
        return False
    return bundle.expires_at > datetime.now(timezone.utc)


def bundle_expiry() -> tuple[datetime, datetime]:
    issued = datetime.now(timezone.utc)
    expires = issued + timedelta(minutes=BUNDLE_TTL_MINUTES)
    return issued, expires