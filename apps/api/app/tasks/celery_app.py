from __future__ import annotations

import os

from celery import Celery


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "multibench_mvp",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.paper_watcher", "app.tasks.run_pipeline"],
)

celery_app.conf.timezone = "UTC"
celery_app.conf.beat_schedule = {
    "paper-watcher-hourly": {
        "task": "app.tasks.paper_watcher.poll_arxiv",
        "schedule": 60 * 60,
    }
}

