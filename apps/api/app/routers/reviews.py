from __future__ import annotations

import os
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import (
    Block,
    BlockVersion,
    BlockVersionStatus,
    Review,
    ReviewState,
    ReviewTargetType,
)


router = APIRouter(prefix="/reviews", tags=["reviews"])


def _require_admin(x_admin_key: str | None) -> None:
    admin_key = os.getenv("ADMIN_KEY", "")
    if not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Admin key required")


@router.post("/block_versions/{block_version_id}/submit")
def submit_block_version_for_review(
    block_version_id: str,
    session: Session = Depends(get_session),
    x_admin_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_admin(x_admin_key)
    bv = session.get(BlockVersion, block_version_id)
    if not bv:
        raise HTTPException(status_code=404, detail="Block version not found")
    if bv.status not in (BlockVersionStatus.draft,):
        raise HTTPException(status_code=400, detail=f"Cannot submit from status {bv.status.value}")

    bv.status = BlockVersionStatus.pending_review
    session.add(bv)
    session.commit()

    review = Review(
        target_type=ReviewTargetType.block_version,
        target_id=bv.id,
        state=ReviewState.pending,
        created_at=datetime.utcnow(),
    )
    session.add(review)
    session.commit()
    session.refresh(review)

    return {"reviewId": review.id, "blockVersionId": bv.id, "status": bv.status.value}


@router.post("/{review_id}/approve")
def approve_review(
    review_id: str,
    session: Session = Depends(get_session),
    x_admin_key: str | None = Header(default=None),
    notes: str = "",
) -> dict[str, Any]:
    _require_admin(x_admin_key)
    review = session.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.state != ReviewState.pending:
        raise HTTPException(status_code=400, detail="Review already decided")

    review.state = ReviewState.approved
    review.notes = notes
    review.decided_at = datetime.utcnow()
    session.add(review)

    if review.target_type == ReviewTargetType.block_version:
        bv = session.get(BlockVersion, review.target_id)
        if not bv:
            raise HTTPException(status_code=404, detail="Target block version not found")
        bv.status = BlockVersionStatus.approved
        session.add(bv)

    session.commit()
    return {"reviewId": review.id, "state": review.state.value}


@router.post("/{review_id}/reject")
def reject_review(
    review_id: str,
    session: Session = Depends(get_session),
    x_admin_key: str | None = Header(default=None),
    notes: str = "",
) -> dict[str, Any]:
    _require_admin(x_admin_key)
    review = session.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.state != ReviewState.pending:
        raise HTTPException(status_code=400, detail="Review already decided")

    review.state = ReviewState.rejected
    review.notes = notes
    review.decided_at = datetime.utcnow()
    session.add(review)

    if review.target_type == ReviewTargetType.block_version:
        bv = session.get(BlockVersion, review.target_id)
        if bv:
            bv.status = BlockVersionStatus.draft
            session.add(bv)

    session.commit()
    return {"reviewId": review.id, "state": review.state.value}


@router.post("/block_versions/{block_version_id}/publish")
def publish_block_version(
    block_version_id: str,
    session: Session = Depends(get_session),
    x_admin_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_admin(x_admin_key)
    bv = session.get(BlockVersion, block_version_id)
    if not bv:
        raise HTTPException(status_code=404, detail="Block version not found")
    if bv.status != BlockVersionStatus.approved:
        raise HTTPException(status_code=400, detail=f"Cannot publish from status {bv.status.value}")
    bv.status = BlockVersionStatus.published
    bv.published_at = datetime.utcnow()
    session.add(bv)
    session.commit()
    return {"blockVersionId": bv.id, "status": bv.status.value, "publishedAt": bv.published_at}


@router.post("/block_versions/{block_version_id}/deprecate")
def deprecate_block_version(
    block_version_id: str,
    session: Session = Depends(get_session),
    x_admin_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_admin(x_admin_key)
    bv = session.get(BlockVersion, block_version_id)
    if not bv:
        raise HTTPException(status_code=404, detail="Block version not found")
    bv.status = BlockVersionStatus.deprecated
    session.add(bv)
    session.commit()
    return {"blockVersionId": bv.id, "status": bv.status.value}

