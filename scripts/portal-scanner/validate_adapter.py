#!/usr/bin/env python3
"""Validate adapter JSON against Gov Copilot adapter schema."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ALLOWED_FIELD_TYPES = {"text", "textarea", "date", "tel", "email", "select"}
KNOWN_PROFILE_KEYS = {
    "full_name", "father_name", "dob", "mobile", "email", "aadhaar_last4",
    "address_line1", "address_line2", "district", "state", "pincode",
    "purpose", "annual_income", "vehicle_class",
}
KNOWN_DOCUMENT_KEYS = {
    "identity_proof", "address_proof", "income_proof", "age_proof", "photo", "signature",
}
REQUIRED_TOP = ("portal_id", "service_id", "adapter_version", "start_url", "allowed_hosts", "pause_at", "steps")


def error(msg: str, errors: list[str]) -> None:
    errors.append(msg)


def validate_adapter(data: dict) -> list[str]:
    errors: list[str] = []

    for key in REQUIRED_TOP:
        if key not in data:
            error(f"Missing required key: {key}", errors)

    if not isinstance(data.get("allowed_hosts"), list) or not data["allowed_hosts"]:
        error("allowed_hosts must be a non-empty list", errors)

    steps = data.get("steps")
    if not isinstance(steps, list) or not steps:
        error("steps must be a non-empty list", errors)
        return errors

    seen_step_ids: set[str] = set()
    for i, step in enumerate(steps):
        prefix = f"steps[{i}]"
        sid = step.get("step_id")
        if not sid:
            error(f"{prefix}: missing step_id", errors)
        elif sid in seen_step_ids:
            error(f"{prefix}: duplicate step_id {sid!r}", errors)
        else:
            seen_step_ids.add(sid)

        detect = step.get("detect_by")
        if not isinstance(detect, dict):
            error(f"{prefix}: detect_by must be an object", errors)
        else:
            if not detect.get("text_contains") and not detect.get("url_contains"):
                error(f"{prefix}: detect_by needs text_contains or url_contains", errors)

        fields = step.get("fields", [])
        uploads = step.get("uploads", [])
        if not fields and not uploads:
            error(f"{prefix}: step must have fields or uploads", errors)

        seen_profile: set[str] = set()
        for j, field in enumerate(fields):
            fp = f"{prefix}.fields[{j}]"
            pk = field.get("profile_key")
            if not pk:
                error(f"{fp}: missing profile_key", errors)
            elif pk in seen_profile:
                error(f"{fp}: duplicate profile_key {pk!r}", errors)
            else:
                seen_profile.add(pk)
            if pk and pk not in KNOWN_PROFILE_KEYS:
                error(f"{fp}: unknown profile_key {pk!r} (extend CaseProfile if intentional)", errors)
            variants = field.get("label_variants")
            if not isinstance(variants, list) or not variants:
                error(f"{fp}: label_variants must be non-empty list", errors)
            ftype = field.get("type")
            if ftype not in ALLOWED_FIELD_TYPES:
                error(f"{fp}: invalid type {ftype!r}", errors)

        seen_doc: set[str] = set()
        for j, upload in enumerate(uploads):
            up = f"{prefix}.uploads[{j}]"
            dk = upload.get("document_key")
            if not dk:
                error(f"{up}: missing document_key", errors)
            elif dk in seen_doc:
                error(f"{up}: duplicate document_key {dk!r}", errors)
            else:
                seen_doc.add(dk)
            if dk and dk not in KNOWN_DOCUMENT_KEYS:
                error(f"{up}: unknown document_key {dk!r}", errors)
            variants = upload.get("label_variants")
            if not isinstance(variants, list) or not variants:
                error(f"{up}: label_variants must be non-empty list", errors)

        if uploads and not step.get("next_instruction"):
            error(f"{prefix}: uploads step should have next_instruction", errors)

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Gov Copilot adapter JSON")
    parser.add_argument("adapter", type=Path, help="Path to adapter JSON")
    parser.add_argument("--production", action="store_true", help="Strip _meta before validate")
    args = parser.parse_args()

    data = json.loads(args.adapter.read_text(encoding="utf-8"))
    if args.production:
        data.pop("_meta", None)

    errors = validate_adapter(data)
    print("=" * 60)
    print("ADAPTER VALIDATION")
    print("=" * 60)
    print(f"File: {args.adapter}")
    print(f"Version: {data.get('adapter_version')}")
    print(f"Steps: {len(data.get('steps', []))}")

    if errors:
        print(f"\nFAIL — {len(errors)} issue(s):")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("\nPASS — adapter schema valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())