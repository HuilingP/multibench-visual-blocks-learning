from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import Column
from sqlalchemy.types import JSON
from sqlmodel import Field, SQLModel


class BlockCategory(str, Enum):
    datasets = "datasets"
    unimodals = "unimodals"
    fusions = "fusions"
    objective_functions = "objective_functions"
    training_structures = "training_structures"
    robustness = "robustness"
    eval_scripts = "eval_scripts"


class BlockVersionStatus(str, Enum):
    draft = "draft"
    pending_review = "pending_review"
    approved = "approved"
    published = "published"
    deprecated = "deprecated"


class RunStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class ReviewState(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ReviewTargetType(str, Enum):
    block_version = "block_version"
    paper_candidate = "paper_candidate"


class PaperSource(str, Enum):
    arxiv = "arxiv"


class PaperCandidateStatus(str, Enum):
    draft = "draft"
    pending_review = "pending_review"
    approved = "approved"
    rejected = "rejected"


class Block(SQLModel, table=True):
    __tablename__ = "blocks"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    slug: str = Field(index=True)
    category: BlockCategory = Field(index=True)
    display_name: str
    description: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class BlockVersion(SQLModel, table=True):
    __tablename__ = "block_versions"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    block_id: str = Field(foreign_key="blocks.id", index=True)
    version: str = Field(index=True)
    status: BlockVersionStatus = Field(default=BlockVersionStatus.draft, index=True)

    digest: str = Field(index=True)
    input_schema: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    output_schema: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))

    changelog: str = ""
    permissions: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    tests: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    published_at: Optional[datetime] = Field(default=None, index=True)


class Pipeline(SQLModel, table=True):
    __tablename__ = "pipelines"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str
    description: str = ""
    spec: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class PipelineRun(SQLModel, table=True):
    __tablename__ = "pipeline_runs"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    pipeline_id: Optional[str] = Field(default=None, foreign_key="pipelines.id", index=True)
    status: RunStatus = Field(default=RunStatus.queued, index=True)

    spec: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    locked_blocks: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    runtime_env: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    metrics: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    artifacts: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    started_at: Optional[datetime] = Field(default=None, index=True)
    finished_at: Optional[datetime] = Field(default=None, index=True)
    error: str = ""


class Paper(SQLModel, table=True):
    __tablename__ = "papers"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    source: PaperSource = Field(default=PaperSource.arxiv, index=True)
    arxiv_id: str = Field(index=True)
    url: str
    title: str
    authors: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    categories: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    summary: str = ""
    published_at: Optional[datetime] = Field(default=None, index=True)
    dedup_hash: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class PaperCandidate(SQLModel, table=True):
    __tablename__ = "paper_candidates"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    paper_id: str = Field(foreign_key="papers.id", index=True)
    status: PaperCandidateStatus = Field(default=PaperCandidateStatus.draft, index=True)

    proposed_blocks: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    llm_prompt: str = ""
    llm_output: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class Review(SQLModel, table=True):
    __tablename__ = "reviews"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    target_type: ReviewTargetType = Field(index=True)
    target_id: str = Field(index=True)
    state: ReviewState = Field(default=ReviewState.pending, index=True)
    reviewer: str = "admin"
    notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    decided_at: Optional[datetime] = Field(default=None, index=True)

