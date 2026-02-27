from __future__ import annotations

import hashlib
import os
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Block, BlockVersion, BlockVersionStatus


router = APIRouter(prefix="/blocks", tags=["blocks"])


def _require_admin(x_admin_key: str | None, admin_key: str) -> None:
    if not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Admin key required")


@router.get("")
def list_blocks(session: Session = Depends(get_session)) -> list[dict]:
    blocks = session.exec(select(Block).order_by(Block.category, Block.slug)).all()
    versions = session.exec(select(BlockVersion).where(BlockVersion.status == BlockVersionStatus.published)).all()
    latest_by_block: dict[str, BlockVersion] = {}
    for v in versions:
        prev = latest_by_block.get(v.block_id)
        if not prev or v.version > prev.version:
            latest_by_block[v.block_id] = v

    out: list[dict] = []
    for b in blocks:
        v = latest_by_block.get(b.id)
        out.append(
            {
                "blockId": b.slug,
                "category": b.category.value,
                "displayName": b.display_name,
                "description": b.description,
                "latestPublished": (
                    None
                    if not v
                    else {
                        "version": v.version,
                        "digest": v.digest,
                        "inputSchema": v.input_schema,
                        "outputSchema": v.output_schema,
                        "changelog": v.changelog,
                        "deprecated": v.status == BlockVersionStatus.deprecated,
                    }
                ),
            }
        )
    return out


@router.get("/{block_id}/versions")
def list_block_versions(block_id: str, session: Session = Depends(get_session)) -> list[dict]:
    block = session.exec(select(Block).where(Block.slug == block_id)).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    versions = session.exec(select(BlockVersion).where(BlockVersion.block_id == block.id).order_by(BlockVersion.created_at)).all()
    return [
        {
            "id": v.id,
            "version": v.version,
            "status": v.status.value,
            "digest": v.digest,
            "inputSchema": v.input_schema,
            "outputSchema": v.output_schema,
            "changelog": v.changelog,
            "publishedAt": v.published_at,
        }
        for v in versions
    ]


@router.post("/{block_id}/versions")
def create_draft_version(
    block_id: str,
    payload: dict,
    session: Session = Depends(get_session),
    x_admin_key: str | None = Header(default=None),
) -> dict:
    _require_admin(x_admin_key, os.getenv("ADMIN_KEY", ""))
    block = session.exec(select(Block).where(Block.slug == block_id)).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    version = payload.get("version")
    input_schema = payload.get("inputSchema") or {}
    output_schema = payload.get("outputSchema") or {}
    changelog = payload.get("changelog") or ""
    permissions = payload.get("permissions") or {"network": False, "filesystem": False, "gpu": False}
    tests = payload.get("tests") or {"smoke": True}

    if not version or not isinstance(version, str):
        raise HTTPException(status_code=400, detail="version is required")

    digest = hashlib.sha256(repr({"slug": block.slug, "version": version, "in": input_schema, "out": output_schema}).encode("utf-8")).hexdigest()[:16]
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
    )
    session.add(bv)
    session.commit()
    session.refresh(bv)
    return {"id": bv.id, "blockId": block.slug, "version": bv.version, "status": bv.status.value, "digest": bv.digest}

