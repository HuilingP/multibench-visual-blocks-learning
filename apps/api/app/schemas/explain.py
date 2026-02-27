from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field

from app.schemas.pipeline import PipelineSpec


class ExplainPortIO(BaseModel):
    name: str
    portType: str
    shape: Optional[list[int]] = None
    preview: Optional[list[float]] = None
    note: Optional[str] = None


class ExplainStep(BaseModel):
    nodeId: str
    nodeType: str
    blockId: str
    version: str
    title: str
    config: dict[str, Any] = Field(default_factory=dict)
    inputs: list[ExplainPortIO] = Field(default_factory=list)
    outputs: list[ExplainPortIO] = Field(default_factory=list)
    formula: Optional[str] = None
    whyItWorks: Optional[str] = None
    impl: list[str] = Field(default_factory=list)


class ExplainRequest(BaseModel):
    spec: PipelineSpec


class ExplainResponse(BaseModel):
    traceVersion: str = "0.1.0"
    metrics: Optional[dict[str, Any]] = None
    steps: list[ExplainStep]

