from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlmodel import Session

from app.db import engine
from app.models import PipelineRun, RunStatus
from app.runner.toy_runner import run_toy_pipeline
from app.schemas.pipeline import PipelineSpec
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.run_pipeline.run_toy")
def run_toy(run_id: str) -> dict[str, Any]:
    with Session(engine) as session:
        run = session.get(PipelineRun, run_id)
        if not run:
            return {"ok": False, "error": "Run not found", "runId": run_id}

        run.status = RunStatus.running
        run.started_at = run.started_at or datetime.utcnow()
        session.add(run)
        session.commit()

        try:
            spec = PipelineSpec.model_validate(run.spec)
            metrics = run_toy_pipeline(spec)
            run.metrics = metrics
            run.status = RunStatus.succeeded
            run.finished_at = datetime.utcnow()
            session.add(run)
            session.commit()
            return {"ok": True, "runId": run.id, "status": run.status.value, "metrics": metrics}
        except Exception as e:
            run.status = RunStatus.failed
            run.error = str(e)
            run.finished_at = datetime.utcnow()
            session.add(run)
            session.commit()
            return {"ok": False, "runId": run.id, "status": run.status.value, "error": str(e)}

