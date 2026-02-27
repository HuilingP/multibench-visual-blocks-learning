from __future__ import annotations

import hashlib
import os
from datetime import datetime
from typing import Generator

from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    Block,
    BlockCategory,
    BlockVersion,
    BlockVersionStatus,
    Paper,
    PaperCandidate,
    PaperCandidateStatus,
    PaperSource,
)


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./multibench_mvp.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def _digest_for(block_slug: str, version: str, input_schema: dict, output_schema: dict) -> str:
    h = hashlib.sha256()
    payload = {
        "slug": block_slug,
        "version": version,
        "input_schema": input_schema,
        "output_schema": output_schema,
    }
    h.update(repr(payload).encode("utf-8"))
    return h.hexdigest()[:16]


def seed_registry(session: Session) -> None:
    now = datetime.utcnow()

    def ensure_block(slug: str, category: BlockCategory, display_name: str, description: str) -> Block:
        b = session.exec(select(Block).where(Block.slug == slug)).first()
        if b:
            # keep display fields reasonably fresh for MVP
            b.category = category
            b.display_name = display_name
            b.description = description
            session.add(b)
            session.commit()
            session.refresh(b)
            return b
        b = Block(slug=slug, category=category, display_name=display_name, description=description, created_at=now)
        session.add(b)
        session.commit()
        session.refresh(b)
        return b

    def ensure_version(block: Block, version: str, input_schema: dict, output_schema: dict, changelog: str) -> BlockVersion:
        existing = session.exec(select(BlockVersion).where(BlockVersion.block_id == block.id, BlockVersion.version == version)).first()
        if existing:
            return existing
        digest = _digest_for(block.slug, version, input_schema, output_schema)
        bv = BlockVersion(
            block_id=block.id,
            version=version,
            status=BlockVersionStatus.published,
            digest=digest,
            input_schema=input_schema,
            output_schema=output_schema,
            changelog=changelog,
            permissions={"network": False, "filesystem": False, "gpu": False},
            tests={"smoke": True},
            created_at=now,
            published_at=now,
        )
        session.add(bv)
        session.commit()
        session.refresh(bv)
        return bv

    # Dataset
    ds = ensure_block(
        "datasets.toy_av",
        BlockCategory.datasets,
        "Toy AV Dataset",
        "Deterministic synthetic audio+vision toy dataset for MVP.",
    )
    ensure_version(
        ds,
        "1.0.0",
        {"type": "object", "properties": {"n": {"type": "integer", "minimum": 100}}, "additionalProperties": True},
        {
            "type": "object",
            "properties": {
                "audio": {"type": "array"},
                "vision": {"type": "array"},
                "labels": {"type": "array"},
            },
            "required": ["audio", "vision", "labels"],
        },
        "Initial published toy dataset block.",
    )
    # Unified batch contract (v1)
    ensure_version(
        ds,
        "1.1.0",
        {
            "type": "object",
            "properties": {
                "n": {"type": "integer", "minimum": 100},
                "audioDim": {"type": "integer", "minimum": 2, "default": 20},
                "visionDim": {"type": "integer", "minimum": 2, "default": 30},
                "trainRatio": {"type": "number", "minimum": 0.5, "maximum": 0.95, "default": 0.8},
            },
            "additionalProperties": True,
        },
        {
            "type": "object",
            "properties": {
                "batch": {
                    "type": "object",
                    "description": "Standardized batch.multimodal.v1 contract.",
                    "properties": {
                        "modalities": {"type": "object"},
                        "labels": {"type": "array"},
                        "meta": {"type": "object"},
                    },
                    "required": ["modalities"],
                },
                "labels": {"type": "array"},
            },
            "required": ["batch", "labels"],
        },
        "Add standardized batch.multimodal.v1 output contract for unified data loading.",
    )

    # Encoders
    enc_id = ensure_block("unimodals.identity", BlockCategory.unimodals, "Identity Encoder", "Pass-through encoder.")
    ensure_version(
        enc_id,
        "1.0.0",
        {"type": "object", "properties": {"scale": {"type": "number"}}, "additionalProperties": False},
        {"type": "object", "properties": {"embed": {"type": "array"}}, "required": ["embed"]},
        "Initial published identity encoder.",
    )
    ensure_version(
        enc_id,
        "1.1.0",
        {
            "type": "object",
            "properties": {
                "scale": {"type": "number", "default": 1.0},
                "modalityKey": {"type": "string", "minLength": 1, "description": "Which modality to read from batch.modalities"},
            },
            "required": ["modalityKey"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"embed": {"type": "array"}}, "required": ["embed"]},
        "Add modalityKey to support unified batch input.",
    )

    enc_lin = ensure_block(
        "unimodals.linear",
        BlockCategory.unimodals,
        "Linear Encoder",
        "Simple deterministic linear projection encoder (seeded).",
    )
    ensure_version(
        enc_lin,
        "1.0.0",
        {
            "type": "object",
            "properties": {"outDim": {"type": "integer", "minimum": 2}},
            "required": ["outDim"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"embed": {"type": "array"}}, "required": ["embed"]},
        "Initial published linear encoder.",
    )
    ensure_version(
        enc_lin,
        "1.1.0",
        {
            "type": "object",
            "properties": {
                "outDim": {"type": "integer", "minimum": 2},
                "modalityKey": {"type": "string", "minLength": 1, "description": "Which modality to read from batch.modalities"},
            },
            "required": ["outDim", "modalityKey"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"embed": {"type": "array"}}, "required": ["embed"]},
        "Add modalityKey to support unified batch input.",
    )

    # Fusion
    fus_cat = ensure_block("fusions.concat", BlockCategory.fusions, "Concat Fusion", "Concatenate embeddings.")
    ensure_version(
        fus_cat,
        "1.0.0",
        {"type": "object", "properties": {}, "additionalProperties": False},
        {"type": "object", "properties": {"fused": {"type": "array"}}, "required": ["fused"]},
        "Initial published concat fusion.",
    )
    fus_sum = ensure_block("fusions.sum", BlockCategory.fusions, "Sum Fusion", "Element-wise sum embeddings (same dim).")
    ensure_version(
        fus_sum,
        "1.0.0",
        {"type": "object", "properties": {}, "additionalProperties": False},
        {"type": "object", "properties": {"fused": {"type": "array"}}, "required": ["fused"]},
        "Initial published sum fusion.",
    )

    # Objective (placeholder for now; runner uses log-loss internally)
    obj = ensure_block(
        "objective_functions.cross_entropy",
        BlockCategory.objective_functions,
        "Cross Entropy",
        "Classification cross entropy objective (placeholder in MVP).",
    )
    ensure_version(
        obj,
        "1.0.0",
        {"type": "object", "properties": {}, "additionalProperties": False},
        {"type": "object", "properties": {}, "additionalProperties": False},
        "Initial published objective placeholder.",
    )

    # Trainer
    tr = ensure_block(
        "training_structures.sgd_classifier",
        BlockCategory.training_structures,
        "SGD Trainer",
        "Train a linear classifier with SGD (scikit-learn).",
    )
    ensure_version(
        tr,
        "1.0.0",
        {
            "type": "object",
            "properties": {
                "maxIter": {"type": "integer", "minimum": 10},
                "alpha": {"type": "number", "minimum": 0},
            },
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"model": {"type": "string"}}, "required": ["model"]},
        "Initial published trainer block.",
    )

    # Evaluator
    ev = ensure_block(
        "eval_scripts.basic",
        BlockCategory.eval_scripts,
        "Basic Evaluator",
        "Compute performance/complexity/robustness (MVP simplified).",
    )
    ensure_version(
        ev,
        "1.0.0",
        {"type": "object", "properties": {"noiseStd": {"type": "number", "minimum": 0}}, "additionalProperties": False},
        {"type": "object", "properties": {"metrics": {"type": "object"}}, "required": ["metrics"]},
        "Initial published evaluator block.",
    )


def seed_demo_paper_candidate(session: Session) -> None:
    """
    Seed one demo paper + pending_review candidate for UI preview.
    Avoids requiring Celery/Redis/arXiv for the first look.
    """
    existing = session.exec(select(Paper)).first()
    if existing:
        return

    arxiv_id = "demo.00001v1"
    dh = hashlib.sha256(arxiv_id.encode("utf-8")).hexdigest()
    now = datetime.utcnow()
    paper = Paper(
        source=PaperSource.arxiv,
        arxiv_id=arxiv_id,
        url="https://arxiv.org/abs/demo.00001",
        title="Demo Paper: Multimodal Toy Fusion for MVP Preview",
        authors=["Demo Author"],
        categories=["cs.LG", "cs.CV"],
        summary="This is a seeded demo paper used to preview the human-in-the-loop block generation flow.",
        published_at=now,
        dedup_hash=dh,
        created_at=now,
    )
    session.add(paper)
    session.commit()
    session.refresh(paper)

    prompt = (
        "你是 MultiBench/MultiZoo 积木生成助手。根据论文信息生成候选积木（不自动发布）。\n"
        "输出 JSON：{candidates:[...]}\n\n"
        f"论文标题：{paper.title}\n"
        f"摘要：{paper.summary}\n"
        f"类别：{paper.categories}\n"
        f"作者：{paper.authors}\n"
    )

    candidate = PaperCandidate(
        paper_id=paper.id,
        status=PaperCandidateStatus.pending_review,
        proposed_blocks={"candidates": []},
        llm_prompt=prompt,
        llm_output="",
        created_at=now,
    )
    session.add(candidate)
    session.commit()

