from __future__ import annotations

import re
from datetime import datetime, timezone
from html import unescape
from urllib.parse import quote_plus, urlparse

import httpx

from models.schemas import ResearchRequirementsRequest, ResearchRequirementsResponse, ResearchSource
from services.registry import SERVICE_REGISTRY

USER_AGENT = "Mozilla/5.0 (compatible; BigTitsGovResearch/1.0; +https://github.com/)"
GOV_HOST_HINTS = (".gov.in", ".nic.in", "parivahan.gov.in", "serviceonline.gov.in")


def _is_govish(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return any(hint in host for hint in GOV_HOST_HINTS)


def _check_official_url(url: str, title: str) -> ResearchSource:
    try:
        with httpx.Client(timeout=12.0, follow_redirects=True, headers={"User-Agent": USER_AGENT}) as client:
            res = client.get(url)
            ok = res.status_code < 400
            return ResearchSource(
                title=title,
                url=str(res.url),
                status="checked" if ok else "unreachable",
                snippet=f"HTTP {res.status_code}" if not ok else "Official portal reachable",
            )
    except Exception as exc:
        return ResearchSource(
            title=title,
            url=url,
            status="unreachable",
            snippet=str(exc)[:120],
        )


def _search_duckduckgo(query: str, limit: int = 4) -> list[ResearchSource]:
    url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
    sources: list[ResearchSource] = []
    try:
        with httpx.Client(timeout=15.0, follow_redirects=True, headers={"User-Agent": USER_AGENT}) as client:
            res = client.get(url)
            res.raise_for_status()
            html = res.text
    except Exception:
        return sources

    # DuckDuckGo HTML lite result blocks
    for block in re.findall(
        r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?class="result__snippet"[^>]*>(.*?)</',
        html,
        flags=re.DOTALL,
    ):
        if len(sources) >= limit:
            break
        href, title_raw, snippet_raw = block
        title = re.sub(r"<[^>]+>", "", unescape(title_raw)).strip()
        snippet = re.sub(r"<[^>]+>", "", unescape(snippet_raw)).strip()
        if not title or not href.startswith("http"):
            continue
        if not _is_govish(href):
            continue
        sources.append(
            ResearchSource(
                title=title[:160],
                url=href,
                status="found",
                snippet=snippet[:220] or None,
            )
        )
    return sources


def research_requirements(body: ResearchRequirementsRequest) -> ResearchRequirementsResponse:
    req = SERVICE_REGISTRY[body.service_id]
    state = (body.state or "").strip()
    licence = (body.licence_type or "learner").replace("_", " ")
    query = f"{state} {licence} driving licence documents required India RTO site:gov.in"

    sources: list[ResearchSource] = []
    sources.append(_check_official_url(req.official_url, req.display_name))
    sources.extend(_search_duckduckgo(query))

    # De-dupe by URL
    seen: set[str] = set()
    unique: list[ResearchSource] = []
    for item in sources:
        if item.url in seen:
            continue
        seen.add(item.url)
        unique.append(item)

    checked = sum(1 for s in unique if s.status in {"checked", "found"})
    place = state or "your state"
    message = (
        f"Verified {checked} official source{'s' if checked != 1 else ''} for {place} {licence} licence."
        if checked
        else f"Here is the usual document list for {place} {licence} licence (from {req.display_name})."
    )

    notes = (
        f"RTO rules in {state} can change — double-check on the portal before you upload."
        if state
        else "Confirm exact proofs on the official portal for your state."
    )

    return ResearchRequirementsResponse(
        service_id=body.service_id,
        state=state or None,
        licence_type=body.licence_type,
        message=message,
        sources=unique,
        required_documents=req.required_documents,
        notes=notes,
        researched_at=datetime.now(timezone.utc).isoformat(),
    )