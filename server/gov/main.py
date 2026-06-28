from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv(Path(__file__).resolve().parent / ".env")
from fastapi.middleware.cors import CORSMiddleware

from routers import audit, bundles, cases, research, services
from services.vision import VISION_BASE_URL, VISION_MODEL, vision_reachable

app = FastAPI(
    title="Gov Copilot API",
    description="Government portal copilot — cases, bundles, adapters, audit",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(services.router, prefix="/api/v1")
app.include_router(cases.router, prefix="/api/v1")
app.include_router(bundles.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(research.router, prefix="/api/v1")


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "gov-copilot-api",
        "vision": {
            "base_url": VISION_BASE_URL,
            "model": VISION_MODEL,
            "reachable": vision_reachable(),
        },
    }