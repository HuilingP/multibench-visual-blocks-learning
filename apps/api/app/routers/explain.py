from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.runner.explain_runner import explain_toy_pipeline
from app.schemas.explain import ExplainRequest, ExplainResponse


router = APIRouter(prefix="/explain", tags=["explain"])


@router.post("", response_model=ExplainResponse)
def explain(req: ExplainRequest) -> ExplainResponse:
    try:
        out = explain_toy_pipeline(req.spec)
        return ExplainResponse(**out)
    except Exception as e:
        raise HTTPException(status_code=400, detail={"message": "Explain failed", "error": str(e)})

