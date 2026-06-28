from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ServiceId = Literal["income_certificate", "learner_licence"]
PortalId = Literal["edistrict_delhi", "sarathi_parivahan"]
CaseStatus = Literal["draft", "documents_pending", "profile_pending", "confirmed", "completed"]


class ConditionalDocument(BaseModel):
    when: str
    documents: list[str]


class ServiceRequirement(BaseModel):
    service_id: ServiceId
    portal_id: PortalId
    display_name: str
    official_url: str
    allowed_hosts: list[str]
    required_fields: list[str]
    required_documents: list[str]
    conditional_documents: list[ConditionalDocument] = Field(default_factory=list)
    sensitive_steps: list[str]
    clarifying_questions: list[str]


class CaseProfile(BaseModel):
    full_name: str | None = None
    father_name: str | None = None
    dob: str | None = None
    mobile: str | None = None
    email: str | None = None
    aadhaar_last4: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    district: str | None = None
    state: str | None = None
    pincode: str | None = None
    purpose: str | None = None
    annual_income: str | None = None

    model_config = {"extra": "allow"}


class PreparedDocument(BaseModel):
    document_key: str
    filename: str
    url: str
    mime_type: str
    size_bytes: int


class BundleDocument(BaseModel):
    url: str
    filename: str
    mime_type: str | None = None


class CreateCaseRequest(BaseModel):
    intent: str
    service_id: ServiceId | None = None
    answers: dict[str, str] = Field(default_factory=dict)


class ConfirmProfileRequest(BaseModel):
    profile: CaseProfile


class CaseResponse(BaseModel):
    case_id: str
    service_id: ServiceId
    portal_id: PortalId
    status: CaseStatus
    requirements: ServiceRequirement
    profile: CaseProfile
    documents: list[PreparedDocument]


class AutomationBundle(BaseModel):
    bundle_id: str
    case_id: str
    service_id: ServiceId
    portal_id: PortalId
    start_url: str
    allowed_hosts: list[str]
    profile: CaseProfile
    documents: dict[str, BundleDocument]
    adapter_version: str
    issued_at: datetime
    expires_at: datetime
    signature: str


class PortalEvent(BaseModel):
    session_id: str
    case_id: str
    event_type: str
    step_id: str | None = None
    field_key: str | None = None
    message: str | None = None
    timestamp: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class ServiceListItem(BaseModel):
    service_id: ServiceId
    display_name: str
    portal_id: PortalId
    clarifying_questions: list[str]


class ResearchRequirementsRequest(BaseModel):
    service_id: ServiceId
    state: str | None = None
    licence_type: str | None = None
    intent: str | None = None


class ResearchSource(BaseModel):
    title: str
    url: str
    status: Literal["checked", "found", "unreachable"] = "found"
    snippet: str | None = None


class ResearchRequirementsResponse(BaseModel):
    service_id: ServiceId
    state: str | None = None
    licence_type: str | None = None
    message: str
    sources: list[ResearchSource]
    required_documents: list[str]
    notes: str | None = None
    researched_at: str