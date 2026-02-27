from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np


@dataclass(frozen=True)
class MultiModalBatchV1:
    """
    Standardized multimodal batch contract (MVP).

    - modalities: mapping from modalityKey -> np.ndarray (batch-first)
    - labels: optional labels array for supervised tasks
    - meta: optional metadata (ids, masks, timestamps, etc.)

    Later we can extend modality payloads to include masks, lengths, and nested structures.
    """

    modalities: dict[str, np.ndarray]
    labels: np.ndarray | None = None
    meta: dict[str, Any] | None = None

    def get_modality(self, key: str) -> np.ndarray:
        if key not in self.modalities:
            raise KeyError(f"Unknown modalityKey '{key}'. Available: {sorted(self.modalities.keys())}")
        return self.modalities[key]


@dataclass(frozen=True)
class DataSplits:
    train: MultiModalBatchV1
    test: MultiModalBatchV1

