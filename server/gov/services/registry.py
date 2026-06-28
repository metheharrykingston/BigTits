from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from models.schemas import PortalId, ServiceId, ServiceRequirement

ADAPTERS_DIR = Path(__file__).resolve().parent.parent / "adapters"


SERVICE_REGISTRY: dict[ServiceId, ServiceRequirement] = {
    "income_certificate": ServiceRequirement(
        service_id="income_certificate",
        portal_id="edistrict_delhi",
        display_name="Income Certificate (e-District Delhi)",
        official_url="https://edistrict.delhigovt.nic.in/",
        allowed_hosts=[
            "edistrict.delhigovt.nic.in",
            "serviceonline.gov.in",
        ],
        required_fields=[
            "full_name",
            "father_name",
            "dob",
            "mobile",
            "email",
            "address_line1",
            "district",
            "state",
            "pincode",
            "purpose",
            "annual_income",
        ],
        required_documents=[
            "identity_proof",
            "address_proof",
            "income_proof",
            "photo",
        ],
        conditional_documents=[],
        sensitive_steps=[
            "otp",
            "captcha",
            "declaration",
            "payment",
            "final submit",
            "aadhaar authentication",
        ],
        clarifying_questions=[
            "Which state e-District portal do you need?",
            "Is this for school admission, loan, or other purpose?",
        ],
    ),
    "learner_licence": ServiceRequirement(
        service_id="learner_licence",
        portal_id="sarathi_parivahan",
        display_name="Learner Driving Licence (Sarathi Parivahan)",
        official_url="https://sarathi.parivahan.gov.in/",
        allowed_hosts=[
            "sarathi.parivahan.gov.in",
            "parivahan.gov.in",
        ],
        required_fields=[
            "full_name",
            "father_name",
            "dob",
            "mobile",
            "address_line1",
            "district",
            "state",
            "pincode",
            "vehicle_class",
        ],
        required_documents=[
            "age_proof",
            "address_proof",
            "photo",
            "signature",
        ],
        conditional_documents=[],
        sensitive_steps=[
            "otp",
            "captcha",
            "learner test",
            "payment",
            "biometric",
            "final submit",
        ],
        clarifying_questions=[
            "Do you need a learner licence or permanent driving licence?",
            "Which vehicle class do you want?",
        ],
    ),
}


INTENT_KEYWORDS: dict[ServiceId, list[str]] = {
    "income_certificate": [
        "income certificate",
        "income proof certificate",
        "aadhar income",
        "e-district income",
    ],
    "learner_licence": [
        "learner licence",
        "learner license",
        "driving licence",
        "driving license",
        "dl application",
    ],
}


def resolve_service(intent: str, service_id: ServiceId | None = None) -> ServiceRequirement:
    if service_id:
        return SERVICE_REGISTRY[service_id]
    text = intent.lower().strip()
    for sid, keywords in INTENT_KEYWORDS.items():
        if any(k in text for k in keywords):
            return SERVICE_REGISTRY[sid]
    return SERVICE_REGISTRY["income_certificate"]


@lru_cache
def load_adapter(adapter_version: str) -> dict:
    path = ADAPTERS_DIR / f"{adapter_version}.json"
    if not path.is_file():
        raise FileNotFoundError(f"Adapter not found: {adapter_version}")
    return json.loads(path.read_text(encoding="utf-8"))


def adapter_version_for(service_id: ServiceId, portal_id: PortalId) -> str:
    if service_id == "income_certificate" and portal_id == "edistrict_delhi":
        return "edistrict_income_certificate_v1"
    raise ValueError(f"No adapter for {service_id}/{portal_id}")