from __future__ import annotations

from fastapi import APIRouter

from models.schemas import ResearchRequirementsRequest, ResearchRequirementsResponse
from services.research import research_requirements

router = APIRouter(prefix="/research", tags=["research"])


@router.post("/requirements", response_model=ResearchRequirementsResponse)
def research_requirements_endpoint(body: ResearchRequirementsRequest) -> ResearchRequirementsResponse:
    return research_requirements(body)