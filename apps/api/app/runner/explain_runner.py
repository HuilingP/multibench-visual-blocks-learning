from __future__ import annotations

from typing import Any

import numpy as np

from app.dataloading.registry import load_splits
from app.runner.toy_runner import _apply_encoder, _apply_fusion, run_toy_pipeline
from app.schemas.pipeline import PipelineSpec


def _shape(x: Any) -> list[int] | None:
    if isinstance(x, np.ndarray):
        return [int(d) for d in x.shape]
    return None


def _preview(x: Any, n: int = 6) -> list[float] | None:
    if not isinstance(x, np.ndarray):
        return None
    flat = x.reshape(-1)
    return [float(v) for v in flat[:n]]


def explain_toy_pipeline(spec: PipelineSpec) -> dict[str, Any]:
    seed = int(spec.runConfig.seed)
    nodes = spec.graph.nodes
    dataset = next((n for n in nodes if n.type == "dataset"), None)
    encoders = [n for n in nodes if n.type == "encoder"]
    fusion = next((n for n in nodes if n.type == "fusion"), None)
    trainer = next((n for n in nodes if n.type == "trainer"), None)
    evaluator = next((n for n in nodes if n.type == "evaluator"), None)
    if not dataset or len(encoders) < 2 or not fusion or not trainer or not evaluator:
        raise ValueError("MVP explain expects: dataset + 2 encoders + fusion + trainer + evaluator.")

    splits = load_splits(dataset_block_id=dataset.blockRef.blockId, seed=seed, config=dataset.config)

    def modality_key(n: Any, default: str) -> str:
        k = (n.config or {}).get("modalityKey", default)
        return k if isinstance(k, str) and k else default

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

    steps: list[dict[str, Any]] = [
        {
            "nodeId": dataset.id,
            "nodeType": dataset.type,
            "blockId": dataset.blockRef.blockId,
            "version": dataset.blockRef.version,
            "title": "Dataset -> unified batch",
            "config": dataset.config,
            "inputs": [],
            "outputs": [
                {
                    "name": "batch.modalities",
                    "portType": "batch.multimodal.v1",
                    "shape": None,
                    "preview": None,
                    "note": f"keys={sorted(list(splits.train.modalities.keys()))}",
                },
                {"name": "labels", "portType": "labels.class", "shape": _shape(y_tr), "preview": _preview(y_tr)},
            ],
            "formula": "raw dataset -> standardized batch.multimodal.v1",
            "whyItWorks": "统一 batch 让下游模块不再关心各数据集的对齐细节。",
            "impl": ["apps/api/app/dataloading/registry.py", "apps/api/app/dataloading/toy_av.py"],
        },
        {
            "nodeId": enc_a.id,
            "nodeType": enc_a.type,
            "blockId": enc_a.blockRef.blockId,
            "version": enc_a.blockRef.version,
            "title": f"Encoder A ({key_a})",
            "config": enc_a.config,
            "inputs": [{"name": "batch", "portType": "batch.multimodal.v1", "shape": _shape(x_a_tr), "preview": _preview(x_a_tr)}],
            "outputs": [{"name": "embedA", "portType": "tensor.embed", "shape": _shape(a_tr), "preview": _preview(a_tr)}],
            "formula": "embed = x @ W + b (linear projection)",
            "whyItWorks": "把原始模态映射到统一 embedding 空间，便于融合。",
            "impl": ["apps/api/app/runner/toy_runner.py::_apply_encoder"],
        },
        {
            "nodeId": enc_v.id,
            "nodeType": enc_v.type,
            "blockId": enc_v.blockRef.blockId,
            "version": enc_v.blockRef.version,
            "title": f"Encoder V ({key_v})",
            "config": enc_v.config,
            "inputs": [{"name": "batch", "portType": "batch.multimodal.v1", "shape": _shape(x_v_tr), "preview": _preview(x_v_tr)}],
            "outputs": [{"name": "embedV", "portType": "tensor.embed", "shape": _shape(v_tr), "preview": _preview(v_tr)}],
            "formula": "embed = x @ W + b (linear projection)",
            "whyItWorks": "不同模态先各自编码，再统一融合。",
            "impl": ["apps/api/app/runner/toy_runner.py::_apply_encoder"],
        },
        {
            "nodeId": fusion.id,
            "nodeType": fusion.type,
            "blockId": fusion.blockRef.blockId,
            "version": fusion.blockRef.version,
            "title": "Fusion",
            "config": fusion.config,
            "inputs": [
                {"name": "embedA", "portType": "tensor.embed", "shape": _shape(a_tr), "preview": _preview(a_tr)},
                {"name": "embedV", "portType": "tensor.embed", "shape": _shape(v_tr), "preview": _preview(v_tr)},
            ],
            "outputs": [{"name": "fused", "portType": "tensor.fused", "shape": _shape(x_tr), "preview": _preview(x_tr)}],
            "formula": "concat: fused=[embedA; embedV] / sum: fused=embedA+embedV",
            "whyItWorks": "融合把多模态信息变成单一路径供 Trainer 学习。",
            "impl": ["apps/api/app/runner/toy_runner.py::_apply_fusion"],
        },
        {
            "nodeId": trainer.id,
            "nodeType": trainer.type,
            "blockId": trainer.blockRef.blockId,
            "version": trainer.blockRef.version,
            "title": "Trainer",
            "config": trainer.config,
            "inputs": [
                {"name": "fused", "portType": "tensor.fused", "shape": _shape(x_tr), "preview": _preview(x_tr)},
                {"name": "labels", "portType": "labels.class", "shape": _shape(y_tr), "preview": _preview(y_tr)},
            ],
            "outputs": [{"name": "model", "portType": "model.classifier", "shape": None, "preview": None, "note": "SGDClassifier"}],
            "formula": "optimize log-loss with SGD",
            "whyItWorks": "用监督标签拟合 fused 特征到类别的映射。",
            "impl": ["apps/api/app/runner/toy_runner.py::run_toy_pipeline"],
        },
        {
            "nodeId": evaluator.id,
            "nodeType": evaluator.type,
            "blockId": evaluator.blockRef.blockId,
            "version": evaluator.blockRef.version,
            "title": "Evaluator",
            "config": evaluator.config,
            "inputs": [{"name": "model", "portType": "model.classifier", "shape": None, "preview": None}],
            "outputs": [{"name": "metrics", "portType": "metrics.report", "shape": None, "preview": None}],
            "formula": "compute performance / complexity / robustness",
            "whyItWorks": "同一模型从三个维度评估，避免只看 accuracy。",
            "impl": ["apps/api/app/runner/toy_runner.py::run_toy_pipeline"],
        },
    ]

    metrics = run_toy_pipeline(spec)
    return {"traceVersion": "0.1.0", "metrics": metrics, "steps": steps}

