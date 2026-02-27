from __future__ import annotations

import hashlib
import os
from datetime import datetime
from typing import Any

import feedparser
from dateutil import parser as dtparser
from sqlmodel import Session, select
from urllib.parse import quote

from app.db import engine
from app.models import Paper, PaperCandidate, PaperCandidateStatus, PaperSource
from app.tasks.celery_app import celery_app


ARXIV_API = "http://export.arxiv.org/api/query"


def build_arxiv_query() -> str:
    # MVP: conservative query; later可按类别/关键词/作者白名单/引用增长等扩展
    parts = [
        "cat:cs.CV",
        "cat:cs.LG",
        "cat:cs.AI",
        "cat:eess.AS",
    ]
    keywords = [
        'ti:"multimodal"',
        'abs:"multimodal"',
        'abs:"audio-visual"',
        'abs:"vision and language"',
    ]
    return "(" + " OR ".join(parts) + ") AND (" + " OR ".join(keywords) + ")"


def _dedup_hash(arxiv_id: str) -> str:
    return hashlib.sha256(arxiv_id.encode("utf-8")).hexdigest()


def _extract_arxiv_id(entry_id: str) -> str:
    # entry.id like: http://arxiv.org/abs/2502.12345v1
    return entry_id.rsplit("/", 1)[-1]


def propose_blocks_prompt(paper: Paper) -> str:
    return (
        "你是 MultiBench/MultiZoo 积木生成助手。根据论文信息生成候选积木（不自动发布）。\n"
        "要求：\n"
        "1) 将候选积木映射到分类：datasets / unimodals / fusions / objective_functions / training_structures / robustness / eval_scripts\n"
        "2) 每个候选积木给出：blockId(建议slug)、一句话描述、输入端口/输出端口（强类型portType）、config schema草案、最小测试建议、权限声明(network/filesystem/gpu)\n"
        "3) 输出 JSON：{candidates:[...]}\n\n"
        f"论文标题：{paper.title}\n"
        f"摘要：{paper.summary}\n"
        f"类别：{paper.categories}\n"
        f"作者：{paper.authors}\n"
    )


@celery_app.task(name="app.tasks.paper_watcher.poll_arxiv")
def poll_arxiv() -> dict[str, Any]:
    q = build_arxiv_query()
    url = (
        f"{ARXIV_API}?search_query={quote(q, safe='')}"
        "&sortBy=submittedDate&sortOrder=descending&start=0&max_results=30"
    )
    feed = feedparser.parse(url)

    created = 0
    skipped = 0

    with Session(engine) as session:
        for e in feed.entries:
            arxiv_id = _extract_arxiv_id(e.id)
            dh = _dedup_hash(arxiv_id)
            exists = session.exec(select(Paper).where(Paper.dedup_hash == dh)).first()
            if exists:
                skipped += 1
                continue

            published_at = None
            if getattr(e, "published", None):
                published_at = dtparser.parse(e.published)

            authors = [a.name for a in getattr(e, "authors", []) if getattr(a, "name", None)]
            categories = []
            for t in getattr(e, "tags", []) or []:
                term = getattr(t, "term", None)
                if term:
                    categories.append(term)

            paper = Paper(
                source=PaperSource.arxiv,
                arxiv_id=arxiv_id,
                url=e.link,
                title=e.title,
                authors=authors,
                categories=categories,
                summary=getattr(e, "summary", "") or "",
                published_at=published_at,
                dedup_hash=dh,
                created_at=datetime.utcnow(),
            )
            session.add(paper)
            session.commit()
            session.refresh(paper)

            candidate = PaperCandidate(
                paper_id=paper.id,
                status=PaperCandidateStatus.pending_review,
                proposed_blocks={},
                llm_prompt=propose_blocks_prompt(paper),
                llm_output="",
                created_at=datetime.utcnow(),
            )
            session.add(candidate)
            session.commit()

            created += 1

    return {"created": created, "skipped": skipped, "query": q}

