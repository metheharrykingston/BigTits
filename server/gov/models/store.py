from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime

from .schemas import CaseProfile, CaseStatus, PortalEvent, PreparedDocument, ServiceId


@dataclass
class CaseRecord:
    case_id: str
    service_id: ServiceId
    portal_id: str
    status: CaseStatus
    intent: str
    profile: CaseProfile = field(default_factory=CaseProfile)
    documents: list[PreparedDocument] = field(default_factory=list)
    document_blobs: dict[str, bytes] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


class InMemoryStore:
    def __init__(self) -> None:
        self.cases: dict[str, CaseRecord] = {}
        self.audit_events: list[PortalEvent] = []

    def create_case(self, service_id: ServiceId, portal_id: str, intent: str) -> CaseRecord:
        case_id = f"CASE_{uuid.uuid4().hex[:8].upper()}"
        record = CaseRecord(
            case_id=case_id,
            service_id=service_id,
            portal_id=portal_id,
            status="draft",
            intent=intent,
        )
        self.cases[case_id] = record
        return record

    def get_case(self, case_id: str) -> CaseRecord | None:
        return self.cases.get(case_id)

    def add_audit(self, event: PortalEvent) -> None:
        self.audit_events.append(event)


store = InMemoryStore()