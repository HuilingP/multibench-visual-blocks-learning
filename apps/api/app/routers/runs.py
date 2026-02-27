from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, desc, select

from app.db import get_session
from app.models import Block, BlockVersion, BlockVersionStatus, PipelineRun, RunStatus
from app.runner.toy_runner import collect_runtime_env, run_toy_pipeline
from app.schemas.pipeline import RunCreateRequest, RunCreateResponse, RunListItem
from app.tasks.celery_app import celery_app


router = APIRouter(prefix="/runs", tags=["runs"])

def _canonicalize_locked_blocks(session: Session, locked_blocks: list) -> dict:
    """
    Validate that lockedBlocks exist and digest matches a published version.
    Return a canonical payload suitable for persistence.
    """
    out = []
    for lb in locked_blocks:
        block = session.exec(select(Block).where(Block.slug == lb.blockId)).first()
        if not block:
            raise ValueError(f"Unknown blockId in lockedBlocks: {lb.blockId}")
        bv = session.exec(
            select(BlockVersion).where(
                BlockVersion.block_id == block.id,
                BlockVersion.version == lb.version,
            )
        ).first()
        if not bv:
            raise ValueError(f"Unknown block version: {lb.blockId}@{lb.version}")
        if bv.digest != lb.digest:
            raise ValueError(f"Digest mismatch for {lb.blockId}@{lb.version}: expected {bv.digest}, got {lb.digest}")
        if bv.status not in (BlockVersionStatus.published, BlockVersionStatus.deprecated):
            raise ValueError(f"Locked block version not published: {lb.blockId}@{lb.version} ({bv.status.value})")

        out.append(
            {
                "blockId": block.slug,
                "version": bv.version,
                "digest": bv.digest,
                "inputSchema": bv.input_schema,
                "outputSchema": bv.output_schema,
                "changelog": bv.changelog,
                "deprecated": bv.status == BlockVersionStatus.deprecated,
                "permissions": bv.permissions,
                "tests": bv.tests,
            }
        )
    return {"lockedBlocks": out}


@router.post("", response_model=RunCreateResponse)
def create_run(req: RunCreateRequest, session: Session = Depends(get_session)) -> RunCreateResponse:
    try:
        locked_blocks = _canonicalize_locked_blocks(session, req.spec.lockedBlocks)
    except Exception as e:
        raise HTTPException(status_code=400, detail={"message": "Invalid lockedBlocks", "error": str(e)})

    run = PipelineRun(
        status=RunStatus.queued if req.spec.runConfig.mode == "async" else RunStatus.running,
        # Ensure JSON-serializable (e.g. datetime -> ISO string) for DB JSON columns.
        spec=req.spec.model_dump(by_alias=True, mode="json"),
        locked_blocks=locked_blocks,
        runtime_env=collect_runtime_env(),
        started_at=datetime.utcnow() if req.spec.runConfig.mode != "async" else None,
    )
    session.add(run)
    session.commit()
    session.refresh(run)

    if req.spec.runConfig.mode == "async":
        celery_app.send_task("app.tasks.run_pipeline.run_toy", args=[run.id])
        return RunCreateResponse(runId=run.id, status=run.status.value, metrics=None)

    try:
        metrics = run_toy_pipeline(req.spec)
        run.metrics = metrics
        run.status = RunStatus.succeeded
        run.finished_at = datetime.utcnow()
        session.add(run)
        session.commit()
        return RunCreateResponse(runId=run.id, status=run.status.value, metrics=metrics)
    except Exception as e:
        run.status = RunStatus.failed
        run.error = str(e)
        run.finished_at = datetime.utcnow()
        session.add(run)
        session.commit()
        raise HTTPException(status_code=400, detail={"message": "Run failed", "error": str(e), "runId": run.id})


@router.get("", response_model=list[RunListItem])
def list_runs(session: Session = Depends(get_session), limit: int = 50) -> list[RunListItem]:
    rows = session.exec(select(PipelineRun).order_by(desc(PipelineRun.created_at)).limit(limit)).all()
    return [
        RunListItem(
            runId=r.id,
            status=r.status.value,
            createdAt=r.created_at,
            finishedAt=r.finished_at,
            metrics=r.metrics or {},
        )
        for r in rows
    ]


@router.get("/{run_id}")
def get_run(run_id: str, session: Session = Depends(get_session)) -> dict:
    run = session.get(PipelineRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "runId": run.id,
        "status": run.status.value,
        "startedAt": run.started_at,
        "finishedAt": run.finished_at,
        "spec": run.spec,
        "lockedBlocks": run.locked_blocks,
        "runtimeEnv": run.runtime_env,
        "metrics": run.metrics,
        "error": run.error,
    }

