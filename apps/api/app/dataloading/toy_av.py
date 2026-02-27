from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

from app.dataloading.types import DataSplits, MultiModalBatchV1


@dataclass(frozen=True)
class ToyAVConfig:
    n: int = 800
    audio_dim: int = 20
    vision_dim: int = 30
    train_ratio: float = 0.8


def _parse_config(config: dict[str, Any]) -> ToyAVConfig:
    return ToyAVConfig(
        n=int(config.get("n", 800)),
        audio_dim=int(config.get("audioDim", 20)),
        vision_dim=int(config.get("visionDim", 30)),
        train_ratio=float(config.get("trainRatio", 0.8)),
    )


def _make(seed: int, cfg: ToyAVConfig) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    audio = rng.normal(size=(cfg.n, cfg.audio_dim)).astype(np.float32)
    vision = rng.normal(size=(cfg.n, cfg.vision_dim)).astype(np.float32)

    # hidden rule: labels depend on both modalities
    wa = rng.normal(size=(cfg.audio_dim,)).astype(np.float32)
    wv = rng.normal(size=(cfg.vision_dim,)).astype(np.float32)
    logits = (audio @ wa) + (vision @ wv) + 0.1 * rng.normal(size=(cfg.n,)).astype(np.float32)
    y = (logits > np.median(logits)).astype(np.int64)
    return audio, vision, y


def load_toy_av_splits(*, seed: int, config: dict[str, Any]) -> DataSplits:
    cfg = _parse_config(config)
    audio, vision, y = _make(seed, cfg)

    idx = np.arange(cfg.n)
    rng = np.random.default_rng(seed)
    rng.shuffle(idx)
    split = int(cfg.train_ratio * cfg.n)
    tr_idx, te_idx = idx[:split], idx[split:]

    train = MultiModalBatchV1(
        modalities={"audio": audio[tr_idx], "vision": vision[tr_idx]},
        labels=y[tr_idx],
        meta={"batchVersion": "v1", "dataset": "datasets.toy_av"},
    )
    test = MultiModalBatchV1(
        modalities={"audio": audio[te_idx], "vision": vision[te_idx]},
        labels=y[te_idx],
        meta={"batchVersion": "v1", "dataset": "datasets.toy_av"},
    )
    return DataSplits(train=train, test=test)

