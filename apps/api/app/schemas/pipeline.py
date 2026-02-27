from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class BlockRef(BaseModel):
    blockId: str = Field(min_length=1)
    version: str = Field(min_length=5)


class PortDecl(BaseModel):
    name: str = Field(min_length=1)
    portType: str = Field(min_length=1)
    schema: Optional[dict[str, Any]] = None


class NodeInstance(BaseModel):
    id: str = Field(min_length=1)
    type: Literal["dataset", "encoder", "fusion", "objective", "trainer", "evaluator"]
    blockRef: BlockRef
    inputs: list[PortDecl] = Field(default_factory=list)
    outputs: list[PortDecl] = Field(default_factory=list)
    config: dict[str, Any] = Field(default_factory=dict)
    ui: Optional[dict[str, Any]] = None


class EdgeEndpoint(BaseModel):
    nodeId: str = Field(min_length=1)
    port: str = Field(min_length=1)


class EdgeInstance(BaseModel):
    id: str = Field(min_length=1)
    from_: EdgeEndpoint = Field(alias="from")
    to: EdgeEndpoint


class Graph(BaseModel):
    nodes: list[NodeInstance]
    edges: list[EdgeInstance] = Field(default_factory=list)


class LockedBlock(BaseModel):
    blockId: str = Field(min_length=1)
    version: str = Field(min_length=5)
    digest: str = Field(min_length=8)
    inputSchema: dict[str, Any] = Field(default_factory=dict)
    outputSchema: dict[str, Any] = Field(default_factory=dict)
    changelog: Optional[str] = None
    deprecated: Optional[bool] = None


class PipelineMeta(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: Optional[str] = None
    createdAt: datetime


class RunResources(BaseModel):
    cpuLimit: Optional[float] = None
    memoryMB: Optional[int] = None
    timeoutSec: Optional[int] = None


class RunConfig(BaseModel):
    seed: int = Field(ge=0, default=0)
    mode: Literal["sync", "async"] = "sync"
    resources: Optional[RunResources] = None


class PipelineSpec(BaseModel):
    specVersion: Literal["0.1.0"] = "0.1.0"
    pipeline: PipelineMeta
    graph: Graph
    lockedBlocks: list[LockedBlock]
    runConfig: RunConfig


class RunCreateRequest(BaseModel):
    spec: PipelineSpec


class RunCreateResponse(BaseModel):
    runId: str
    status: str
    metrics: Optional[dict[str, Any]] = None


class RunListItem(BaseModel):
    runId: str
    status: str
    createdAt: datetime
    finishedAt: Optional[datetime] = None
    metrics: dict[str, Any] = Field(default_factory=dict)

