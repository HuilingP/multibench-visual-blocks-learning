from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.db import create_db_and_tables, engine, seed_demo_paper_candidate, seed_registry
from app.routers.blocks import router as blocks_router
from app.routers.explain import router as explain_router
from app.routers.papers import router as papers_router
from app.routers.reviews import router as reviews_router
from app.routers.runs import router as runs_router


app = FastAPI(title="MultiBench MVP API", version="0.1.0")

def _parse_web_origins() -> list[str]:
    """
    Dev-friendly CORS:
    - WEB_ORIGINS: comma-separated list, e.g. "http://127.0.0.1:3000,http://localhost:3000"
    - WEB_ORIGIN: legacy single origin
    """
    raw = os.getenv("WEB_ORIGINS")
    if raw:
        origins = [s.strip() for s in raw.split(",") if s.strip()]
        if origins:
            return origins
    legacy = os.getenv("WEB_ORIGIN", "http://localhost:3000")
    # Always allow both localhost and 127.0.0.1 for local dev previews.
    base = [legacy, "http://127.0.0.1:3000", "http://localhost:3000"]
    uniq: list[str] = []
    for o in base:
        if o not in uniq:
            uniq.append(o)
    return uniq


web_origins = _parse_web_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=web_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()
    with Session(engine) as session:
        seed_registry(session)
        seed_demo_paper_candidate(session)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


app.include_router(blocks_router)
app.include_router(runs_router)
app.include_router(explain_router)
app.include_router(papers_router)
app.include_router(reviews_router)

