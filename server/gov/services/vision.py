from __future__ import annotations

import base64
import json
import os
import re
from typing import Any

import httpx

from models.schemas import CaseProfile

VISION_BASE_URL = os.getenv("OLLAMA_VISION_BASE_URL", "http://127.0.0.1:11435").rstrip("/")
VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "qwen2.5vl:7b")
VISION_TIMEOUT = float(os.getenv("OLLAMA_VISION_TIMEOUT", "180"))

EXTRACT_PROMPT = """You are a document field extractor for Indian government forms.
Read the uploaded document image and extract ONLY fields that are clearly visible.
Return strict JSON with these keys (use null if not visible — do not guess):
{
  "full_name": string|null,
  "father_name": string|null,
  "dob": string|null,
  "mobile": string|null,
  "email": string|null,
  "aadhaar_last4": string|null,
  "address_line1": string|null,
  "district": string|null,
  "state": string|null,
  "pincode": string|null,
  "purpose": string|null,
  "annual_income": string|null,
  "document_type": string|null
}
Rules:
- Never return full Aadhaar number; only last 4 digits in aadhaar_last4 if visible.
- Dates as YYYY-MM-DD when possible.
- If unsure, use null.
- Output JSON only, no markdown."""


def vision_reachable() -> bool:
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{VISION_BASE_URL}/api/tags")
            return response.status_code == 200
    except Exception:
        return False


def _parse_json_from_text(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    return {}


def _sanitize_extracted(data: dict[str, Any]) -> dict[str, str | None]:
    allowed = set(CaseProfile.model_fields.keys())
    out: dict[str, str | None] = {}
    for key, value in data.items():
        if key not in allowed or value is None:
            continue
        text = str(value).strip()
        if not text:
            continue
        if key == "aadhaar_last4":
            digits = re.sub(r"\D", "", text)
            out[key] = digits[-4:] if digits else None
        else:
            out[key] = text
    return out


def extract_fields_from_image(
    image_bytes: bytes,
    *,
    mime_type: str = "image/jpeg",
    document_key: str = "document",
) -> dict[str, str | None]:
    if mime_type == "application/pdf":
        raise RuntimeError("PDF extraction not in MVP — upload a photo (JPG/PNG) of the document")

    if not vision_reachable():
        raise RuntimeError(
            f"Vision model not reachable at {VISION_BASE_URL}. "
            "Start RunPod tunnel: ssh -N -L 11435:127.0.0.1:11434 runpod-direct"
        )

    b64 = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "model": VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": f"{EXTRACT_PROMPT}\nDocument slot: {document_key}",
                "images": [b64],
            }
        ],
        "stream": False,
        "format": "json",
    }

    with httpx.Client(timeout=VISION_TIMEOUT) as client:
        response = client.post(f"{VISION_BASE_URL}/api/chat", json=payload)
        response.raise_for_status()
        body = response.json()

    message = body.get("message", {})
    content = message.get("content", "") if isinstance(message, dict) else ""
    parsed = _parse_json_from_text(content)
    return _sanitize_extracted(parsed)


def merge_profile(base: CaseProfile, extracted: dict[str, str | None]) -> CaseProfile:
    current = base.model_dump()
    for key, value in extracted.items():
        if value and not current.get(key):
            current[key] = value
    return CaseProfile(**current)