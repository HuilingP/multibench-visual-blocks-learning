from __future__ import annotations

import platform
import time
from typing import Any

import numpy as np
from importlib.metadata import PackageNotFoundError, version as pkg_version
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import accuracy_score

from app.dataloading.registry import load_splits
from app.schemas.pipeline import PipelineSpec


def _pkg_ver(name: str) -> str:
    try:
        return pkg_version(name)
    except PackageNotFoundError:
        return "unknown"


def collect_runtime_env() -> dict[str, Any]:
    return {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "packages": {
            "fastapi": _pkg_ver("fastapi"),
            "sqlmodel": _pkg_ver("sqlmodel"),
            "numpy": _pkg_ver("numpy"),
            "scikit-learn": _pkg_ver("scikit-learn"),
        },
        "batchContract": {"name": "batch.multimodal.v1"},
    }


def _linear_encoder(seed: int, x: np.ndarray, out_dim: int, salt: int) -> tuple[np.ndarray, int]:
    rng = np.random.default_rng(seed + salt)
    w = rng.normal(scale=0.2, size=(x.shape[1], out_dim)).astype(np.float32)
    b = rng.normal(scale=0.01, size=(out_dim,)).astype(np.float32)
    return (x @ w + b), (w.size + b.size)


def _identity_encoder(x: np.ndarray, scale: float = 1.0) -> tuple[np.ndarray, int]:
    return (x * scale), 0


def _apply_encoder(block_slug: str, seed: int, x: np.ndarray, config: dict[str, Any], salt: int) -> tuple[np.ndarray, int]:
    if block_slug == "unimodals.identity":
        return _identity_encoder(x, float(config.get("scale", 1.0)))
    if block_slug == "unimodals.linear":
        out_dim = int(config.get("outDim", 16))
        return _linear_encoder(seed, x, out_dim=out_dim, salt=salt)
    raise ValueError(f"Unsupported encoder block: {block_slug}")


def _apply_fusion(block_slug: str, a: np.ndarray, v: np.ndarray) -> np.ndarray:
    if block_slug == "fusions.concat":
        return np.concatenate([a, v], axis=1)
    if block_slug == "fusions.sum":
        if a.shape[1] != v.shape[1]:
            raise ValueError("Sum fusion requires equal embedding dims.")
        return a + v
    raise ValueError(f"Unsupported fusion block: {block_slug}")


def run_toy_pipeline(spec: PipelineSpec) -> dict[str, Any]:
    seed = int(spec.runConfig.seed)

    # pick first occurrences by node type (MVP simplification)
    nodes = spec.graph.nodes
    dataset = next((n for n in nodes if n.type == "dataset"), None)
    encoders = [n for n in nodes if n.type == "encoder"]
    fusion = next((n for n in nodes if n.type == "fusion"), None)
    trainer = next((n for n in nodes if n.type == "trainer"), None)
    evaluator = next((n for n in nodes if n.type == "evaluator"), None)

    if not dataset or len(encoders) < 2 or not fusion or not trainer or not evaluator:
        raise ValueError("MVP runner expects: dataset + 2 encoders + fusion + trainer + evaluator.")

    splits = load_splits(dataset_block_id=dataset.blockRef.blockId, seed=seed, config=dataset.config)

    def modality_key(n: Any, default: str) -> str:
        k = (n.config or {}).get("modalityKey", default)
        if not isinstance(k, str) or not k:
            return default
        return k

    enc_a, enc_v = encoders[0], encoders[1]
    key_a = modality_key(enc_a, "audio")
    key_v = modality_key(enc_v, "vision")

    x_a_tr = splits.train.get_modality(key_a)
    x_v_tr = splits.train.get_modality(key_v)
    y_tr = splits.train.labels
    if y_tr is None:
        raise ValueError("Dataset did not provide labels for supervised training.")

    a_tr, a_params = _apply_encoder(enc_a.blockRef.blockId, seed, x_a_tr, enc_a.config, salt=101)
    v_tr, v_params = _apply_encoder(enc_v.blockRef.blockId, seed, x_v_tr, enc_v.config, salt=202)
    x_tr = _apply_fusion(fusion.blockRef.blockId, a_tr, v_tr)

    # train
    max_iter = int(trainer.config.get("maxIter", 300))
    alpha = float(trainer.config.get("alpha", 0.0001))
    clf = SGDClassifier(loss="log_loss", max_iter=max_iter, alpha=alpha, random_state=seed)

    t0 = time.perf_counter()
    clf.fit(x_tr, y_tr)
    train_ms = (time.perf_counter() - t0) * 1000.0

    # eval clean
    x_a_te = splits.test.get_modality(key_a)
    x_v_te = splits.test.get_modality(key_v)
    y_te = splits.test.labels
    if y_te is None:
        raise ValueError("Dataset did not provide labels for evaluation.")

    a_te, _ = _apply_encoder(enc_a.blockRef.blockId, seed, x_a_te, enc_a.config, salt=101)
    v_te, _ = _apply_encoder(enc_v.blockRef.blockId, seed, x_v_te, enc_v.config, salt=202)
    x_te = _apply_fusion(fusion.blockRef.blockId, a_te, v_te)
    y_pred = clf.predict(x_te)
    acc = float(accuracy_score(y_te, y_pred))

    # eval robustness (noise)
    noise_std = float(evaluator.config.get("noiseStd", 0.2))
    rng2 = np.random.default_rng(seed + 999)
    noisy_a = x_a_te + rng2.normal(scale=noise_std, size=x_a_te.shape).astype(np.float32)
    noisy_v = x_v_te + rng2.normal(scale=noise_std, size=x_v_te.shape).astype(np.float32)
    na, _ = _apply_encoder(enc_a.blockRef.blockId, seed, noisy_a, enc_a.config, salt=101)
    nv, _ = _apply_encoder(enc_v.blockRef.blockId, seed, noisy_v, enc_v.config, salt=202)
    nx = _apply_fusion(fusion.blockRef.blockId, na, nv)
    n_pred = clf.predict(nx)
    noisy_acc = float(accuracy_score(y_te, n_pred))

    # complexity (very simplified)
    model_params = int(getattr(clf, "coef_", np.zeros((1, x_tr.shape[1]))).size + getattr(clf, "intercept_", np.zeros((1,))).size)
    total_params = int(a_params + v_params + model_params)

    return {
        "performance": {"accuracy": acc},
        "complexity": {"paramCount": total_params, "trainTimeMs": train_ms},
        "robustness": {"noiseStd": noise_std, "noisyAccuracy": noisy_acc, "accuracyDrop": acc - noisy_acc},
    }

