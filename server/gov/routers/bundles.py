from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from models.schemas import AutomationBundle, BundleDocument, CaseProfile
from models.store import store
from services.registry import adapter_version_for, load_adapter, resolve_service
from services.signing import bundle_expiry, sign_bundle_parts, verify_bundle

router = APIRouter(prefix="/bundles", tags=["bundles"])


@router.post("/cases/{case_id}", response_model=AutomationBundle)
def create_bundle(case_id: str) -> AutomationBundle:
    record = store.get_case(case_id)
    if not record:
        raise HTTPException(status_code=404, detail="Case not found")
    if record.status != "confirmed":
        raise HTTPException(status_code=400, detail="Case profile must be confirmed first")

    documents = {
        doc.document_key: BundleDocument(
            url=doc.url,
            filename=doc.filename,
            mime_type=doc.mime_type,
        )
        for doc in record.documents
    }

    return _build_bundle(
        case_id=record.case_id,
        service_id=record.service_id,
        portal_id=record.portal_id,
        intent=record.intent,
        profile=record.profile,
        documents=documents,
    )


def _portal_targets(service_id: str, portal_id: str, intent: str) -> tuple[str, list[str], str]:
    req = resolve_service(intent, service_id)
    try:
        adapter_version = adapter_version_for(service_id, portal_id)
        adapter = load_adapter(adapter_version)
        return adapter["start_url"], adapter["allowed_hosts"], adapter_version
    except (ValueError, FileNotFoundError):
        return req.official_url, req.allowed_hosts, f"{portal_id}_browse_v0"


def _build_bundle(
    *,
    case_id: str,
    service_id: str,
    portal_id: str,
    intent: str,
    profile: CaseProfile,
    documents: dict[str, BundleDocument],
) -> AutomationBundle:
    start_url, allowed_hosts, adapter_version = _portal_targets(service_id, portal_id, intent)
    issued_at, expires_at = bundle_expiry()
    bundle_id = f"BND_{uuid.uuid4().hex[:10].upper()}"

    signature = sign_bundle_parts(
        bundle_id=bundle_id,
        case_id=case_id,
        service_id=service_id,
        portal_id=portal_id,
        start_url=start_url,
        allowed_hosts=allowed_hosts,
        profile=profile,
        documents={k: v.model_dump(exclude_none=True) for k, v in documents.items()},
        adapter_version=adapter_version,
        issued_at=issued_at,
        expires_at=expires_at,
    )

    bundle = AutomationBundle(
        bundle_id=bundle_id,
        case_id=case_id,
        service_id=service_id,
        portal_id=portal_id,
        start_url=start_url,
        allowed_hosts=allowed_hosts,
        profile=profile,
        documents=documents,
        adapter_version=adapter_version,
        issued_at=issued_at,
        expires_at=expires_at,
        signature=signature,
    )
    if not verify_bundle(bundle):
        raise HTTPException(status_code=500, detail="Bundle signing failed")
    return bundle


@router.post("/cases/{case_id}/browse", response_model=AutomationBundle)
def create_browse_bundle(case_id: str) -> AutomationBundle:
    """Open official portal only — no profile/documents on our servers."""
    record = store.get_case(case_id)
    if not record:
        raise HTTPException(status_code=404, detail="Case not found")

    return _build_bundle(
        case_id=record.case_id,
        service_id=record.service_id,
        portal_id=record.portal_id,
        intent=record.intent,
        profile=CaseProfile(),
        documents={},
    )


@router.get("/adapters/{adapter_version}")
def get_adapter(adapter_version: str) -> dict:
    try:
        return load_adapter(adapter_version)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/verify", response_model=dict)
def verify_bundle_endpoint(bundle: AutomationBundle) -> dict:
    valid = verify_bundle(bundle)
    expired = bundle.expires_at <= datetime.now(timezone.utc)
    return {"valid": valid, "expired": expired}