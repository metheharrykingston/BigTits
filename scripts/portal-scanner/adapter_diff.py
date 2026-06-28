#!/usr/bin/env python3
"""Diff a draft adapter against the signed adapter in services/api/adapters/."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ADAPTERS_DIR = ROOT.parent.parent / "server" / "gov" / "adapters"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def field_keys(step: dict) -> set[str]:
    return {f["profile_key"] for f in step.get("fields", [])}


def upload_keys(step: dict) -> set[str]:
    return {u["document_key"] for u in step.get("uploads", [])}


def step_ids(adapter: dict) -> set[str]:
    return {s["step_id"] for s in adapter.get("steps", [])}


def diff_adapters(draft: dict, existing: dict) -> int:
    issues = 0
    print("=" * 60)
    print("ADAPTER DIFF")
    print("=" * 60)
    print(f"Draft:    {draft.get('adapter_version')} ({len(draft.get('steps', []))} steps)")
    print(f"Existing: {existing.get('adapter_version')} ({len(existing.get('steps', []))} steps)")
    print()

    for key in ("portal_id", "service_id", "start_url"):
        d, e = draft.get(key), existing.get(key)
        if d != e:
            print(f"[!] {key}: draft={d!r} existing={e!r}")
            issues += 1

    draft_steps = {s["step_id"]: s for s in draft.get("steps", [])}
    existing_steps = {s["step_id"]: s for s in existing.get("steps", [])}

    added_steps = step_ids(draft) - step_ids(existing)
    removed_steps = step_ids(existing) - step_ids(draft)
    if added_steps:
        print(f"[+] New steps in draft: {sorted(added_steps)}")
    if removed_steps:
        print(f"[-] Missing steps in draft: {sorted(removed_steps)}")
        issues += len(removed_steps)

    for sid in sorted(step_ids(draft) & step_ids(existing)):
        ds, es = draft_steps[sid], existing_steps[sid]
        df, ef = field_keys(ds), field_keys(es)
        du, eu = upload_keys(ds), upload_keys(es)

        new_fields = df - ef
        missing_fields = ef - df
        new_uploads = du - eu
        missing_uploads = eu - du

        if new_fields:
            print(f"[+] {sid} new profile_keys: {sorted(new_fields)}")
        if missing_fields:
            print(f"[-] {sid} missing profile_keys: {sorted(missing_fields)}")
            issues += len(missing_fields)
        if new_uploads:
            print(f"[+] {sid} new document_keys: {sorted(new_uploads)}")
        if missing_uploads:
            print(f"[-] {sid} missing document_keys: {sorted(missing_uploads)}")
            issues += len(missing_uploads)

    draft_pause = set(draft.get("pause_at", []))
    existing_pause = set(existing.get("pause_at", []))
    if draft_pause != existing_pause:
        print(f"[~] pause_at differs")
        print(f"    only in draft: {sorted(draft_pause - existing_pause)}")
        print(f"    only in existing: {sorted(existing_pause - draft_pause)}")

    meta = draft.get("_meta", {})
    if meta.get("unmapped_fields"):
        print(f"\n[?] Unmapped fields ({len(meta['unmapped_fields'])}):")
        for label in meta["unmapped_fields"][:15]:
            print(f"    - {label}")
        if len(meta["unmapped_fields"]) > 15:
            print(f"    ... and {len(meta['unmapped_fields']) - 15} more")

    print()
    print(f"DIFF_ISSUES={issues}")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Diff draft adapter vs production adapter")
    parser.add_argument("--draft", required=True, type=Path, help="Path to draft_adapter.json")
    parser.add_argument(
        "--existing",
        type=Path,
        help="Path to existing adapter (default: services/api/adapters/<adapter_version>.json)",
    )
    args = parser.parse_args()

    draft = load_json(args.draft)
    draft.pop("_meta", None)

    existing_path = args.existing
    if not existing_path:
        version = draft.get("adapter_version")
        if not version:
            print("ERROR: draft missing adapter_version; pass --existing", file=sys.stderr)
            return 2
        existing_path = ADAPTERS_DIR / f"{version}.json"

    if not existing_path.is_file():
        print(f"No existing adapter at {existing_path} — draft is net-new.")
        print(f"Steps: {[s['step_id'] for s in draft.get('steps', [])]}")
        return 0

    existing = load_json(existing_path)
    return 1 if diff_adapters(draft, existing) else 0


if __name__ == "__main__":
    raise SystemExit(main())