from __future__ import annotations

from fastapi import APIRouter

from models.schemas import ServiceListItem
from services.registry import SERVICE_REGISTRY

router = APIRouter(prefix="/services", tags=["services"])


@router.get("", response_model=list[ServiceListItem])
def list_services() -> list[ServiceListItem]:
    return [
        ServiceListItem(
            service_id=item.service_id,
            display_name=item.display_name,
            portal_id=item.portal_id,
            clarifying_questions=item.clarifying_questions,
        )
        for item in SERVICE_REGISTRY.values()
    ]