from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, desc, select

from app.db import get_session
from app.models import (
    Block,
    BlockCategory,
    BlockVersion,
    BlockVersionStatus,
    Paper,
    PaperCandidate,
    PaperCandidateStatus,
)


router = APIRouter(tags=["papers"])


def _require_admin(x_admin_key: str | None) -> None:
    admin_key = os.getenv("ADMIN_KEY", "")
    if not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Admin key required")

def _slugify(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    out = []
    for ch in s:
        if ch.isalnum() or ch in "._-":
            out.append(ch.lower())
        elif ch.isspace():
            out.append("_")
    return "".join(out).strip("._-")


def _digest_for(block_slug: str, version: str, input_schema: dict, output_schema: dict) -> str:
    h = hashlib.sha256()
    h.update(repr({"slug": block_slug, "version": version, "in": input_schema, "out": output_schema}).encode("utf-8"))
    return h.hexdigest()[:16]


def _parse_proposed_blocks(candidate: PaperCandidate) -> dict[str, Any]:
    if isinstance(candidate.proposed_blocks, dict) and candidate.proposed_blocks.get("candidates"):
        return candidate.proposed_blocks
    if candidate.llm_output:
        try:
            obj = json.loads(candidate.llm_output)
            if isinstance(obj, dict) and obj.get("candidates"):
                return obj
        except Exception:
            pass
    return {"candidates": []}


@router.get("/papers")
def list_papers(session: Session = Depends(get_session), limit: int = 50) -> list[dict]:
    rows = session.exec(select(Paper).order_by(desc(Paper.created_at)).limit(limit)).all()
    return [
        {
            "id": p.id,
            "source": p.source.value,
            "arxivId": p.arxiv_id,
            "url": p.url,
            "title": p.title,
            "authors": p.authors,
            "categories": p.categories,
            "publishedAt": p.published_at,
            "createdAt": p.created_at,
        }
        for p in rows
    ]


@router.get("/paper_candidates")
def list_candidates(session: Session = Depends(get_session), status: str = "pending_review", limit: int = 50) -> list[dict]:
    try:
        st = PaperCandidateStatus(status)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid status")
    rows = session.exec(select(PaperCandidate).where(PaperCandidate.status == st).order_by(desc(PaperCandidate.created_at)).limit(limit)).all()

    paper_ids = list({c.paper_id for c in rows})
    papers = session.exec(select(Paper).where(Paper.id.in_(paper_ids))).all() if paper_ids else []
    paper_by_id = {p.id: p for p in papers}
    return [
        {
            "id": c.id,
            "paperId": c.paper_id,
            "paper": (
                None
                if c.paper_id not in paper_by_id
                else {"arxivId": paper_by_id[c.paper_id].arxiv_id, "title": paper_by_id[c.paper_id].title, "url": paper_by_id[c.paper_id].url}
            ),
            "status": c.status.value,
            "proposedBlocks": c.proposed_blocks,
            "llmPrompt": c.llm_prompt,
            "llmOutput": c.llm_output,
            "createdAt": c.created_at,
        }
        for c in rows
    ]


@router.get("/paper_candidates/{candidate_id}")
def get_candidate(candidate_id: str, session: Session = Depends(get_session)) -> dict:
    c = session.get(PaperCandidate, candidate_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidate not found")
    paper = session.get(Paper, c.paper_id)
    return {
        "id": c.id,
        "paperId": c.paper_id,
        "paper": None if not paper else {"arxivId": paper.arxiv_id, "title": paper.title, "url": paper.url, "categories": paper.categories},
        "status": c.status.value,
        "proposedBlocks": c.proposed_blocks,
        "llmPrompt": c.llm_prompt,
        "llmOutput": c.llm_output,
        "createdAt": c.created_at,
    }


@router.patch("/paper_candidates/{candidate_id}")
def update_candidate(
    candidate_id: str,
    payload: dict,
    session: Session = Depends(get_session),
    x_admin_key: str | None = Header(default=None),
) -> dict:
    _require_admin(x_admin_key)
    c = session.get(PaperCandidate, candidate_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if "llmOutput" in payload:
        c.llm_output = payload.get("llmOutput") or ""
    if "proposedBlocks" in payload:
        pb = payload.get("proposedBlocks") or {}
        if not isinstance(pb, dict):
            raise HTTPException(status_code=400, detail="proposedBlocks must be an object")
        c.proposed_blocks = pb

    session.add(c)
    session.commit()
    return {"id": c.id, "status": c.status.value}


@router.post("/paper_candidates/{candidate_id}/propose_stub")
def propose_stub(
    candidate_id: str,
    session: Session = Depends(get_session),
    x_admin_key: str | None = Header(default=None),
) -> dict:
    """
    MVP-only helper: generate a deterministic proposal JSON without calling an external LLM.
    This exists to demonstrate the human-in-the-loop flow end-to-end.
    """
    _require_admin(x_admin_key)
    c = session.get(PaperCandidate, candidate_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidate not found")
    paper = session.get(Paper, c.paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    base = _slugify((paper.arxiv_id or "paper").replace("/", "_"))
    proposed = {
        "candidates": [
            {
                "blockId": f"fusions.{base}.late_concat",
                "category": "fusions",
                "displayName": "Late Concat (Candidate)",
                "description": f"Candidate fusion inspired by paper {paper.arxiv_id}.",
                "version": "0.1.0",
                "inputs": [{"name": "embedA", "portType": "tensor.embed"}, {"name": "embedV", "portType": "tensor.embed"}],
                "outputs": [{"name": "fused", "portType": "tensor.fused"}],
                "configSchema": {"type": "object", "properties": {}, "additionalProperties": false},
                "permissions": {"network": False, "filesystem": False, "gpu": False},
                "tests": {"smoke": True},
                "changelog": "Auto-generated stub proposal (MVP).",
            }
        ]
    }
    c.proposed_blocks = proposed
    c.llm_output = json.dumps(proposed, ensure_ascii=False, indent=2)
    session.add(c)
    session.commit()
    return {"id": c.id, "status": c.status.value, "proposedBlocks": proposed}


@router.post("/paper_candidates/{candidate_id}/materialize_blocks")
def materialize_blocks(
    candidate_id: str,
    session: Session = Depends(get_session),
    x_admin_key: str | None = Header(default=None),
) -> dict:
    _require_admin(x_admin_key)
    c = session.get(PaperCandidate, candidate_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if c.status != PaperCandidateStatus.approved:
        raise HTTPException(status_code=400, detail=f"Candidate must be approved to materialize (current={c.status.value})")

    paper = session.get(Paper, c.paper_id)
    proposed = _parse_proposed_blocks(c)
    items = proposed.get("candidates") or []
    if not isinstance(items, list) or len(items) == 0:
        raise HTTPException(status_code=400, detail="No candidates found in proposedBlocks/llmOutput")

    created: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    for it in items:
        if not isinstance(it, dict):
            continue
        raw_block_id = str(it.get("blockId") or "").strip()
        block_id = _slugify(raw_block_id)
        if not block_id:
            raise HTTPException(status_code=400, detail="Each candidate must include blockId")

        raw_cat = str(it.get("category") or "").strip()
        try:
            cat = BlockCategory(raw_cat)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid category for {block_id}: {raw_cat}")

        display_name = str(it.get("displayName") or block_id)
        description = str(it.get("description") or "")
        version = str(it.get("version") or "0.1.0")
        changelog = str(it.get("changelog") or "")
        if paper and not changelog:
            changelog = f"Generated from paper {paper.arxiv_id}."

        inputs = it.get("inputs") or []
        outputs = it.get("outputs") or []
        config_schema = it.get("configSchema") or {"type": "object", "properties": {}, "additionalProperties": True}

        permissions = it.get("permissions") or {"network": False, "filesystem": False, "gpu": False}
        tests = it.get("tests") or {"smoke": True}

        # Ensure block exists; if collision, reuse existing block.
        block = session.exec(select(Block).where(Block.slug == block_id)).first()
        if not block:
            block = Block(
                slug=block_id,
                category=cat,
                display_name=display_name,
                description=description,
                created_at=datetime.utcnow(),
            )
            session.add(block)
            session.commit()
            session.refresh(block)

        # Avoid creating duplicate versions
        exists = session.exec(select(BlockVersion).where(BlockVersion.block_id == block.id, BlockVersion.version == version)).first()
        if exists:
            skipped.append({"blockId": block.slug, "version": version, "reason": "version exists", "blockVersionId": exists.id})
            continue

        input_schema = config_schema
        output_schema = {"ports": {"inputs": inputs, "outputs": outputs}}
        digest = _digest_for(block.slug, version, input_schema, output_schema)

        bv = BlockVersion(
            block_id=block.id,
            version=version,
            status=BlockVersionStatus.draft,
            digest=digest,
            input_schema=input_schema,
            output_schema=output_schema,
            changelog=changelog,
            permissions=permissions,
            tests=tests,
            created_at=datetime.utcnow(),
            published_at=None,
        )
        session.add(bv)
        session.commit()
        session.refresh(bv)
        created.append({"blockId": block.slug, "version": bv.version, "status": bv.status.value, "digest": bv.digest, "blockVersionId": bv.id})

    return {"candidateId": c.id, "created": created, "skipped": skipped}


@router.post("/paper_candidates/{candidate_id}/approve")
def approve_candidate(candidate_id: str, session: Session = Depends(get_session), x_admin_key: str | None = Header(default=None)) -> dict:
    _require_admin(x_admin_key)
    c = session.get(PaperCandidate, candidate_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidate not found")
    c.status = PaperCandidateStatus.approved
    session.add(c)
    session.commit()
    return {"id": c.id, "status": c.status.value, "decidedAt": datetime.utcnow()}


@router.post("/paper_candidates/{candidate_id}/reject")
def reject_candidate(candidate_id: str, session: Session = Depends(get_session), x_admin_key: str | None = Header(default=None)) -> dict:
    _require_admin(x_admin_key)
    c = session.get(PaperCandidate, candidate_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidate not found")
    c.status = PaperCandidateStatus.rejected
    session.add(c)
    session.commit()
    return {"id": c.id, "status": c.status.value, "decidedAt": datetime.utcnow()}

