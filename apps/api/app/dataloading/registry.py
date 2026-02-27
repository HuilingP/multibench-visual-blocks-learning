from __future__ import annotations

from typing import Any

from app.dataloading.toy_av import load_toy_av_splits
from app.dataloading.types import DataSplits


def load_splits(*, dataset_block_id: str, seed: int, config: dict[str, Any]) -> DataSplits:
    """
    Standardized dataset interface entrypoint.

    In MultiBench, this is where we'd wrap 15 datasets + 10 modalities into a unified batch contract.
    """
    if dataset_block_id == "datasets.toy_av":
        return load_toy_av_splits(seed=seed, config=config)
    raise ValueError(f"Unsupported dataset block: {dataset_block_id}")

