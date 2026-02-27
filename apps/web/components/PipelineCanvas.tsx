"use client";

import "reactflow/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import ReactFlow, {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlowInstance,
  useEdgesState,
  useNodesState
} from "reactflow";

import { createRun, explainPipeline, listBlocks } from "@/lib/api";
import { useHelp } from "@/lib/help";
import { useI18n } from "@/lib/i18n";
import type { ExplainResponse, LockedBlock, NodeInstance, PipelineSpec, PortDecl, RunCreateResponse } from "@/types/pipeline";
import { Term } from "@/components/Term";
import { BeginnerGuide } from "@/components/BeginnerGuide";
import { BlockHelpCard } from "@/components/BlockHelpCard";

type CanvasNodeData = {
  label: string;
  kind: NodeInstance["type"];
  blockId: string;
  version: string;
  inputs: PortDecl[];
  outputs: PortDecl[];
  config: Record<string, unknown>;
};

function PortHandle({
  side,
  id,
  label
}: {
  side: "left" | "right";
  id: string;
  label: string;
}) {
  const position = side === "left" ? Position.Left : Position.Right;
  const type = side === "left" ? "target" : "source";
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-300">
      {side === "left" ? <span>{label}</span> : null}
      <Handle
        id={id}
        type={type}
        position={position}
        className="!h-2 !w-2 !border-zinc-300 !bg-zinc-950"
      />
      {side === "right" ? <span>{label}</span> : null}
    </div>
  );
}

function NodeCard({ data }: NodeProps<CanvasNodeData>) {
  const inputs = data.inputs ?? [];
  const outputs = data.outputs ?? [];

  return (
    <div className="min-w-[220px] rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-zinc-100">{data.label}</div>
        <div className="rounded-md bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
          {data.version}
        </div>
      </div>
      <div className="mt-1 font-mono text-[10px] text-zinc-500">{data.blockId}</div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="space-y-1">
          {inputs.map((p) => (
            <PortHandle key={p.name} side="left" id={`in:${p.name}`} label={p.name} />
          ))}
        </div>
        <div className="space-y-1">
          {outputs.map((p) => (
            <PortHandle key={p.name} side="right" id={`out:${p.name}`} label={p.name} />
          ))}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { card: NodeCard };

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

function handlePortName(handleId?: string | null) {
  if (!handleId) return "";
  const idx = handleId.indexOf(":");
  return idx === -1 ? handleId : handleId.slice(idx + 1);
}

export function PipelineCanvas() {
  const { t } = useI18n();
  const { beginnerMode } = useHelp();
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const rfWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [registry, setRegistry] = useState<Record<string, LockedBlock>>({});
  const [specJson, setSpecJson] = useState<string>("");
  const [runResp, setRunResp] = useState<RunCreateResponse | null>(null);
  const [traceResp, setTraceResp] = useState<ExplainResponse | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaletteKey, setSelectedPaletteKey] = useState<string>("dataset");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const blocks = await listBlocks();
        const map: Record<string, LockedBlock> = {};
        for (const b of blocks) {
          if (b.latestPublished) {
            map[b.blockId] = {
              blockId: b.blockId,
              version: b.latestPublished.version,
              digest: b.latestPublished.digest,
              inputSchema: b.latestPublished.inputSchema ?? {},
              outputSchema: b.latestPublished.outputSchema ?? {},
              changelog: b.latestPublished.changelog,
              deprecated: b.latestPublished.deprecated
            };
          }
        }
        setRegistry(map);
      } catch (e: any) {
        setError(t("canvas.loadRegistryFailed", { message: e?.message ?? String(e) }));
      }
    })();
  }, [t]);

  const palette = useMemo(
    () => [
      {
        key: "dataset",
        label: t("canvas.palette.datasetToyAV"),
        kind: "dataset" as const,
        blockId: "datasets.toy_av",
        inputs: [],
        outputs: [
          { name: "batch", portType: "batch.multimodal.v1" },
          { name: "labels", portType: "labels.class" }
        ],
        config: { n: 800 }
      },
      {
        key: "encA",
        label: t("canvas.palette.encLinearA"),
        kind: "encoder" as const,
        blockId: "unimodals.linear",
        inputs: [{ name: "batch", portType: "batch.multimodal.v1" }],
        outputs: [{ name: "embedA", portType: "tensor.embed" }],
        config: { modalityKey: "audio", outDim: 16 }
      },
      {
        key: "encV",
        label: t("canvas.palette.encLinearV"),
        kind: "encoder" as const,
        blockId: "unimodals.linear",
        inputs: [{ name: "batch", portType: "batch.multimodal.v1" }],
        outputs: [{ name: "embedV", portType: "tensor.embed" }],
        config: { modalityKey: "vision", outDim: 16 }
      },
      {
        key: "fusion",
        label: t("canvas.palette.fusionConcat"),
        kind: "fusion" as const,
        blockId: "fusions.concat",
        inputs: [
          { name: "embedA", portType: "tensor.embed" },
          { name: "embedV", portType: "tensor.embed" }
        ],
        outputs: [{ name: "fused", portType: "tensor.fused" }],
        config: {}
      },
      {
        key: "trainer",
        label: t("canvas.palette.trainerSGD"),
        kind: "trainer" as const,
        blockId: "training_structures.sgd_classifier",
        inputs: [
          { name: "fused", portType: "tensor.fused" },
          { name: "labels", portType: "labels.class" }
        ],
        outputs: [{ name: "model", portType: "model.classifier" }],
        config: { maxIter: 300, alpha: 0.0001 }
      },
      {
        key: "evaluator",
        label: t("canvas.palette.evaluatorBasic"),
        kind: "evaluator" as const,
        blockId: "eval_scripts.basic",
        inputs: [{ name: "model", portType: "model.classifier" }],
        outputs: [{ name: "metrics", portType: "metrics.report" }],
        config: { noiseStd: 0.2 }
      }
    ],
    [t]
  );

  const selectedPalette = useMemo(
    () => palette.find((p) => p.key === selectedPaletteKey) ?? palette[0],
    [palette, selectedPaletteKey]
  );

  const onConnect = useCallback((conn: Connection) => {
    setEdges((eds) => addEdge({ ...conn, animated: true, style: { stroke: "#71717a" } }, eds));
  }, []);

  const isValidConnection = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return false;
      const src = nodes.find((n) => n.id === conn.source);
      const dst = nodes.find((n) => n.id === conn.target);
      if (!src || !dst) return false;
      const srcPort = handlePortName(conn.sourceHandle);
      const dstPort = handlePortName(conn.targetHandle);
      const srcDecl = src.data.outputs.find((p) => p.name === srcPort);
      const dstDecl = dst.data.inputs.find((p) => p.name === dstPort);
      return Boolean(srcDecl && dstDecl && srcDecl.portType === dstDecl.portType);
    },
    [nodes]
  );

  const onDragStart = (ev: React.DragEvent, itemKey: string) => {
    ev.dataTransfer.setData("application/reactflow", itemKey);
    ev.dataTransfer.effectAllowed = "move";
  };

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSpecJson("");
    setRunResp(null);
    setError(null);
  }, [setEdges, setNodes]);

  const loadTemplate = useCallback(() => {
    // fixed positions; works without rf instance
    const lock = (blockId: string) => registry[blockId]?.version ?? "1.1.0";

    const idDs = "n_ds";
    const idEncA = "n_encA";
    const idEncV = "n_encV";
    const idFus = "n_fus";
    const idTr = "n_tr";
    const idEv = "n_ev";

    const ns: Node<CanvasNodeData>[] = [
      {
        id: idDs,
        type: "card",
        position: { x: 40, y: 120 },
        data: {
          label: t("canvas.palette.datasetToyAV"),
          kind: "dataset",
          blockId: "datasets.toy_av",
          version: lock("datasets.toy_av"),
          inputs: [],
          outputs: [
            { name: "batch", portType: "batch.multimodal.v1" },
            { name: "labels", portType: "labels.class" }
          ],
          config: { n: 800 }
        }
      },
      {
        id: idEncA,
        type: "card",
        position: { x: 320, y: 40 },
        data: {
          label: t("canvas.palette.encLinearA"),
          kind: "encoder",
          blockId: "unimodals.linear",
          version: lock("unimodals.linear"),
          inputs: [{ name: "batch", portType: "batch.multimodal.v1" }],
          outputs: [{ name: "embedA", portType: "tensor.embed" }],
          config: { modalityKey: "audio", outDim: 16 }
        }
      },
      {
        id: idEncV,
        type: "card",
        position: { x: 320, y: 220 },
        data: {
          label: t("canvas.palette.encLinearV"),
          kind: "encoder",
          blockId: "unimodals.linear",
          version: lock("unimodals.linear"),
          inputs: [{ name: "batch", portType: "batch.multimodal.v1" }],
          outputs: [{ name: "embedV", portType: "tensor.embed" }],
          config: { modalityKey: "vision", outDim: 16 }
        }
      },
      {
        id: idFus,
        type: "card",
        position: { x: 620, y: 120 },
        data: {
          label: t("canvas.palette.fusionConcat"),
          kind: "fusion",
          blockId: "fusions.concat",
          version: lock("fusions.concat"),
          inputs: [
            { name: "embedA", portType: "tensor.embed" },
            { name: "embedV", portType: "tensor.embed" }
          ],
          outputs: [{ name: "fused", portType: "tensor.fused" }],
          config: {}
        }
      },
      {
        id: idTr,
        type: "card",
        position: { x: 920, y: 120 },
        data: {
          label: t("canvas.palette.trainerSGD"),
          kind: "trainer",
          blockId: "training_structures.sgd_classifier",
          version: lock("training_structures.sgd_classifier"),
          inputs: [
            { name: "fused", portType: "tensor.fused" },
            { name: "labels", portType: "labels.class" }
          ],
          outputs: [{ name: "model", portType: "model.classifier" }],
          config: { maxIter: 300, alpha: 0.0001 }
        }
      },
      {
        id: idEv,
        type: "card",
        position: { x: 1200, y: 120 },
        data: {
          label: t("canvas.palette.evaluatorBasic"),
          kind: "evaluator",
          blockId: "eval_scripts.basic",
          version: lock("eval_scripts.basic"),
          inputs: [{ name: "model", portType: "model.classifier" }],
          outputs: [{ name: "metrics", portType: "metrics.report" }],
          config: { noiseStd: 0.2 }
        }
      }
    ];

    const mk = (source: string, sourceHandle: string, target: string, targetHandle: string) =>
      ({
        id: `e_${source}_${sourceHandle}_${target}_${targetHandle}`,
        source,
        sourceHandle,
        target,
        targetHandle,
        animated: true,
        style: { stroke: "#71717a" }
      }) as Edge;

    const es: Edge[] = [
      mk(idDs, "out:batch", idEncA, "in:batch"),
      mk(idDs, "out:batch", idEncV, "in:batch"),
      mk(idEncA, "out:embedA", idFus, "in:embedA"),
      mk(idEncV, "out:embedV", idFus, "in:embedV"),
      mk(idFus, "out:fused", idTr, "in:fused"),
      mk(idDs, "out:labels", idTr, "in:labels"),
      mk(idTr, "out:model", idEv, "in:model")
    ];

    setNodes(ns);
    setEdges(es);
    setSelectedNodeId(idDs);
  }, [registry, setEdges, setNodes, t]);

  const onDrop = useCallback(
    (ev: React.DragEvent) => {
      ev.preventDefault();
      const key = ev.dataTransfer.getData("application/reactflow");
      const item = palette.find((p) => p.key === key);
      if (!item || !rf || !rfWrapper.current) return;

      const bounds = rfWrapper.current.getBoundingClientRect();
      const position = rf.project({
        x: ev.clientX - bounds.left,
        y: ev.clientY - bounds.top
      });

      const locked = registry[item.blockId];
      const version = locked?.version ?? "1.0.0";

      const n: Node<CanvasNodeData> = {
        id: newId(item.key),
        type: "card",
        position,
        data: {
          label: item.label,
          kind: item.kind,
          blockId: item.blockId,
          version,
          inputs: item.inputs,
          outputs: item.outputs,
          config: item.config
        }
      };
      setNodes((ns) => ns.concat(n));
      setSelectedPaletteKey(item.key);
    },
    [palette, rf, registry]
  );

  const onDragOver = (ev: React.DragEvent) => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
  };

  const exportSpec = useCallback(() => {
    const lockedBlocks: LockedBlock[] = [];
    const uniq = new Set<string>();
    for (const n of nodes) {
      const b = registry[n.data.blockId];
      if (b && !uniq.has(b.blockId)) {
        uniq.add(b.blockId);
        lockedBlocks.push(b);
      }
    }

    const spec: PipelineSpec = {
      specVersion: "0.1.0",
      pipeline: {
        id: newId("pipe"),
        name: "MVP Pipeline",
        createdAt: new Date().toISOString()
      },
      graph: {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.data.kind,
          blockRef: { blockId: n.data.blockId, version: n.data.version },
          inputs: n.data.inputs,
          outputs: n.data.outputs,
          config: n.data.config,
          ui: { x: n.position.x, y: n.position.y }
        })),
        edges: edges.map((e) => ({
          id: e.id,
          from: { nodeId: e.source, port: handlePortName(e.sourceHandle) },
          to: { nodeId: e.target, port: handlePortName(e.targetHandle) }
        }))
      },
      lockedBlocks,
      runConfig: { seed: 0, mode: "sync" }
    };

    setSpecJson(JSON.stringify(spec, null, 2));
    return spec;
  }, [edges, nodes, registry]);

  const steps = useMemo(() => {
    const hasDataset = nodes.some((n) => n.data.kind === "dataset");
    const encs = nodes.filter((n) => n.data.kind === "encoder");
    const has2Enc = encs.length >= 2;
    const hasFusion = nodes.some((n) => n.data.kind === "fusion");
    const hasTrainer = nodes.some((n) => n.data.kind === "trainer");
    const hasEval = nodes.some((n) => n.data.kind === "evaluator");
    const hasAnyEdges = edges.length > 0;
    return [
      { id: "s1", label: t("canvas.quickstart.step1"), done: hasDataset },
      { id: "s2", label: t("canvas.quickstart.step2"), done: has2Enc },
      { id: "s3", label: t("canvas.quickstart.step3"), done: hasFusion && hasAnyEdges },
      { id: "s4", label: t("canvas.quickstart.step4"), done: hasTrainer && hasAnyEdges },
      { id: "s5", label: t("canvas.quickstart.step5"), done: hasEval && hasAnyEdges }
    ];
  }, [edges.length, nodes, t]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null),
    [nodes, selectedNodeId]
  );

  const run = useCallback(async () => {
    try {
      setError(null);
      const spec = exportSpec();
      const resp = await createRun(spec);
      setRunResp(resp);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [exportSpec]);

  const buildTrace = useCallback(async () => {
    try {
      setError(null);
      setTraceLoading(true);
      const spec = exportSpec();
      const resp = await explainPipeline(spec);
      setTraceResp(resp);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setTraceLoading(false);
    }
  }, [exportSpec]);

  const focusedTraceStep = useMemo(() => {
    if (!traceResp?.steps?.length) return null;
    if (selectedNodeId) {
      const byNode = traceResp.steps.find((s) => s.nodeId === selectedNodeId);
      if (byNode) return byNode;
    }
    return traceResp.steps[0];
  }, [selectedNodeId, traceResp]);

  return (
    <div className="grid grid-cols-[260px_1fr_380px] gap-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <div className="text-sm font-semibold text-zinc-100">{t("canvas.registryTitle")}</div>
        <div className="mt-3">
          <BeginnerGuide steps={steps} onLoadTemplate={loadTemplate} onClear={clearCanvas} />
        </div>
        <div className="mt-3 space-y-2">
          {palette.map((p) => (
            <div
              key={p.key}
              draggable
              onDragStart={(ev) => onDragStart(ev, p.key)}
              onClick={() => setSelectedPaletteKey(p.key)}
              className={clsx(
                "cursor-grab rounded-lg border p-3 active:cursor-grabbing",
                selectedPaletteKey === p.key ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900/50"
              )}
            >
              <div className="text-xs font-semibold text-zinc-100">{p.label}</div>
              <div className="mt-1 font-mono text-[10px] text-zinc-400">{p.blockId}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[11px] text-zinc-500">
          {t("canvas.ruleHint")}
        </div>
        {beginnerMode ? (
          <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/20 p-3 text-[11px] text-zinc-300">
            <div>
              <Term id="portType" />：{t("glossary.entries.portType.oneLiner")}
            </div>
            <div className="mt-1 text-zinc-400">
              <Term id="port" />：{t("glossary.entries.port.oneLiner")}
            </div>
            <div className="mt-1 text-zinc-400">
              <Term id="batch" />：{t("glossary.entries.batch.oneLiner")}
            </div>
          </div>
        ) : null}
        <div className="mt-4">
          <BlockHelpCard blockId={selectedPalette.blockId} />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-2">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="text-sm font-semibold text-zinc-100">{t("canvas.canvasTitle")}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportSpec()}
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700"
            >
              {t("canvas.exportSpec")}
            </button>
            <button
              onClick={run}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500"
            >
              {t("canvas.runToy")}
            </button>
            <button
              onClick={buildTrace}
              disabled={traceLoading}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {traceLoading ? t("canvas.buildingTrace") : t("canvas.buildTrace")}
            </button>
          </div>
        </div>

        <div ref={rfWrapper} className="h-[560px] w-full overflow-hidden rounded-lg">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onNodeClick={(_, n) => {
              setSelectedNodeId(n.id);
              setNodes((ns) => ns.map((x) => ({ ...x, selected: x.id === n.id })));
            }}
            fitView
            onInit={setRf}
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            <Background gap={20} color="#27272a" />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="text-sm font-semibold text-zinc-100">{t("canvas.specPreview")}</div>
          {error ? <div className="mt-2 text-xs text-red-300">{error}</div> : null}
          {selectedNode && beginnerMode ? (
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/20 p-3 text-[11px] text-zinc-300">
              <div className="text-zinc-100">
                选中节点：<span className="font-semibold">{selectedNode.data.label}</span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-zinc-400">{selectedNode.data.blockId}@{selectedNode.data.version}</div>
              <div className="mt-2 text-zinc-400">
                它属于：{selectedNode.data.kind === "dataset" ? <Term id="dataset" /> : null}
                {selectedNode.data.kind === "encoder" ? <Term id="encoder" /> : null}
                {selectedNode.data.kind === "fusion" ? <Term id="fusion" /> : null}
                {selectedNode.data.kind === "trainer" ? <Term id="trainer" /> : null}
                {selectedNode.data.kind === "evaluator" ? <Term id="evaluator" /> : null}
              </div>
              {selectedNode.data.kind === "encoder" ? (
                <div className="mt-1 text-zinc-400">
                  <Term id="modalityKey" />：{String((selectedNode.data.config as any)?.modalityKey ?? "-")}
                </div>
              ) : null}
            </div>
          ) : null}
          {beginnerMode ? (
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/20 p-3 text-[11px] text-zinc-300">
              <div>
                <Term id="spec" />：{t("glossary.entries.spec.oneLiner")}
              </div>
              <div className="mt-1 text-zinc-400">
                <Term id="lockedBlocks" /> / <Term id="digest" />：{t("glossary.entries.lockedBlocks.oneLiner")}
              </div>
              <div className="mt-1 text-zinc-400">
                <Term id="run" />：{t("glossary.entries.run.oneLiner")}
              </div>
            </div>
          ) : null}
          {runResp?.metrics ? (
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-zinc-400">{t("metrics.performance")}</div>
                <div className="mt-1 text-zinc-100">
                  {t("metrics.accuracy")}: {String((runResp.metrics as any)?.performance?.accuracy)}
                </div>
                {beginnerMode ? (
                  <div className="mt-1 text-[11px] text-zinc-400">
                    <Term id="performance" />：{t("glossary.entries.performance.oneLiner")}
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-zinc-400">{t("metrics.complexity")}</div>
                <div className="mt-1 text-zinc-100">
                  {t("metrics.params")}: {String((runResp.metrics as any)?.complexity?.paramCount)} / {t("metrics.trainMs")}
                  : {String((runResp.metrics as any)?.complexity?.trainTimeMs)}
                </div>
                {beginnerMode ? (
                  <div className="mt-1 text-[11px] text-zinc-400">
                    <Term id="complexity" />：{t("glossary.entries.complexity.oneLiner")}
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-zinc-400">{t("metrics.robustness")}</div>
                <div className="mt-1 text-zinc-100">
                  {t("metrics.drop")}: {String((runResp.metrics as any)?.robustness?.accuracyDrop)} (noiseStd{" "}
                  {String((runResp.metrics as any)?.robustness?.noiseStd)})
                </div>
                {beginnerMode ? (
                  <div className="mt-1 text-[11px] text-zinc-400">
                    <Term id="robustness" />：{t("glossary.entries.robustness.oneLiner")}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <textarea
            value={specJson}
            onChange={(e) => setSpecJson(e.target.value)}
            placeholder={t("canvas.specPlaceholder")}
            className="mt-3 h-[320px] w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-200 outline-none"
          />

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/20 p-3">
            <div className="text-sm font-semibold text-zinc-100">{t("canvas.inspectorTitle")}</div>
            {!focusedTraceStep ? (
              <div className="mt-2 text-xs text-zinc-400">{t("canvas.traceEmpty")}</div>
            ) : (
              <div className="mt-3 space-y-2 text-xs">
                <div className="text-zinc-300">
                  {t("canvas.traceFocus")}：<span className="font-semibold text-zinc-100">{focusedTraceStep.title}</span>
                </div>
                <div className="font-mono text-[11px] text-zinc-400">
                  {focusedTraceStep.blockId}@{focusedTraceStep.version}
                </div>
                {focusedTraceStep.formula ? (
                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2 text-zinc-200">{focusedTraceStep.formula}</div>
                ) : null}
                {focusedTraceStep.whyItWorks ? (
                  <div className="text-zinc-300">{focusedTraceStep.whyItWorks}</div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
                    <div className="mb-1 text-zinc-400">Inputs</div>
                    {focusedTraceStep.inputs.map((p) => (
                      <div key={`in-${p.name}`} className="mb-1">
                        <div className="font-mono text-zinc-200">
                          {p.name} <span className="text-zinc-500">({p.portType})</span>
                        </div>
                        <div className="text-zinc-500">shape: {p.shape ? `[${p.shape.join(", ")}]` : "-"}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
                    <div className="mb-1 text-zinc-400">Outputs</div>
                    {focusedTraceStep.outputs.map((p) => (
                      <div key={`out-${p.name}`} className="mb-1">
                        <div className="font-mono text-zinc-200">
                          {p.name} <span className="text-zinc-500">({p.portType})</span>
                        </div>
                        <div className="text-zinc-500">shape: {p.shape ? `[${p.shape.join(", ")}]` : "-"}</div>
                        {p.note ? <div className="text-zinc-500">{p.note}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

