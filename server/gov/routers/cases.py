from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile

from models.schemas import (
    CaseResponse,
    ConfirmProfileRequest,
    CreateCaseRequest,
    PortalEvent,
    PreparedDocument,
)
from models.store import store
from services.registry import resolve_service
from services.vision import extract_fields_from_image, merge_profile, vision_reachable

router = APIRouter(prefix="/cases", tags=["cases"])


def _to_response(record) -> CaseResponse:
    req = resolve_service(record.intent, record.service_id)
    return CaseResponse(
        case_id=record.case_id,
        service_id=record.service_id,
        portal_id=req.portal_id,
        status=record.status,
        requirements=req,
        profile=record.profile,
        documents=record.documents,
    )


@router.post("", response_model=CaseResponse)
def create_case(body: CreateCaseRequest) -> CaseResponse:
    req = resolve_service(body.intent, body.service_id)
    record = store.create_case(req.service_id, req.portal_id, body.intent)
    record.status = "documents_pending"
    store.add_audit(
        PortalEvent(
            session_id="api",
            case_id=record.case_id,
            event_type="case_created",
            message=f"service={req.service_id}",
            timestamp=datetime.now(timezone.utc),
        )
    )
    return _to_response(record)


@router.get("/{case_id}", response_model=CaseResponse)
def get_case(case_id: str) -> CaseResponse:
    record = store.get_case(case_id)
    if not record:
        raise HTTPException(status_code=404, detail="Case not found")
    return _to_response(record)


@router.post("/{case_id}/documents/{document_key}", response_model=CaseResponse)
async def upload_document(case_id: str, document_key: str, file: UploadFile) -> CaseResponse:
    record = store.get_case(case_id)
    if not record:
        raise HTTPException(status_code=404, detail="Case not found")

    content = await file.read()
    doc = PreparedDocument(
        document_key=document_key,
        filename=file.filename or f"{document_key}.bin",
        url=f"/api/v1/cases/{case_id}/documents/{document_key}/download?token={uuid.uuid4().hex}",
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
    )
    record.documents = [d for d in record.documents if d.document_key != document_key]
    record.documents.append(doc)
    record.document_blobs[document_key] = content
    record.status = "profile_pending"
    record.updated_at = datetime.now(timezone.utc)

    store.add_audit(
        PortalEvent(
            session_id="api",
            case_id=case_id,
            event_type="document_uploaded",
            field_key=document_key,
            message=f"filename={doc.filename}",
            timestamp=datetime.now(timezone.utc),
        )
    )
    return _to_response(record)


@router.post("/{case_id}/documents/{document_key}/extract", response_model=CaseResponse)
def extract_document(case_id: str, document_key: str) -> CaseResponse:
    record = store.get_case(case_id)
    if not record:
        raise HTTPException(status_code=404, detail="Case not found")

    blob = record.document_blobs.get(document_key)
    if not blob:
        raise HTTPException(status_code=400, detail="Document not uploaded")

    doc = next((d for d in record.documents if d.document_key == document_key), None)
    mime = doc.mime_type if doc else "image/jpeg"

    try:
        extracted = extract_fields_from_image(
            blob,
            mime_type=mime,
            document_key=document_key,
        )
        record.profile = merge_profile(record.profile, extracted)
        record.updated_at = datetime.now(timezone.utc)
        store.add_audit(
            PortalEvent(
                session_id="api",
                case_id=case_id,
                event_type="document_extracted",
                field_key=document_key,
                message=f"fields={len([v for v in extracted.values() if v])}",
                timestamp=datetime.now(timezone.utc),
            )
        )
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)[:300]) from error

    return _to_response(record)


@router.post("/{case_id}/extract", response_model=CaseResponse)
def extract_all_documents(case_id: str) -> CaseResponse:
    record = store.get_case(case_id)
    if not record:
        raise HTTPException(status_code=404, detail="Case not found")
    if not record.document_blobs:
        raise HTTPException(status_code=400, detail="No documents to extract")

    if not vision_reachable():
        raise HTTPException(
            status_code=503,
            detail=(
                "Vision model not reachable. Start tunnel: "
                "ssh -N -L 11435:127.0.0.1:11434 runpod-direct"
            ),
        )

    errors: list[str] = []
    for document_key, blob in record.document_blobs.items():
        doc = next((d for d in record.documents if d.document_key == document_key), None)
        mime = doc.mime_type if doc else "image/jpeg"
        try:
            extracted = extract_fields_from_image(
                blob,
                mime_type=mime,
                document_key=document_key,
            )
            record.profile = merge_profile(record.profile, extracted)
            store.add_audit(
                PortalEvent(
                    session_id="api",
                    case_id=case_id,
                    event_type="document_extracted",
                    field_key=document_key,
                    message=f"fields={len([v for v in extracted.values() if v])}",
                    timestamp=datetime.now(timezone.utc),
                )
            )
        except Exception as error:
            errors.append(f"{document_key}: {error}")

    profile_values = record.profile.model_dump(exclude_none=True)
    if errors and not profile_values:
        raise HTTPException(status_code=503, detail="; ".join(errors)[:400])

    record.status = "profile_pending"
    record.updated_at = datetime.now(timezone.utc)
    return _to_response(record)


@router.post("/{case_id}/profile/confirm", response_model=CaseResponse)
def confirm_profile(case_id: str, body: ConfirmProfileRequest) -> CaseResponse:
    record = store.get_case(case_id)
    if not record:
        raise HTTPException(status_code=404, detail="Case not found")

    record.profile = body.profile
    record.status = "confirmed"
    record.updated_at = datetime.now(timezone.utc)

    store.add_audit(
        PortalEvent(
            session_id="api",
            case_id=case_id,
            event_type="profile_confirmed",
            timestamp=datetime.now(timezone.utc),
        )
    )
    return _to_response(record)