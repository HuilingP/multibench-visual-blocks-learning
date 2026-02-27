export type SemVer = string;

export type NodeKind =
  | "dataset"
  | "encoder"
  | "fusion"
  | "objective"
  | "trainer"
  | "evaluator";

export type PortType = string;

export type BlockRef = {
  blockId: string;
  version: SemVer;
};

export type PortDecl = {
  name: string;
  portType: PortType;
  schema?: Record<string, unknown>;
};

export type NodeInstance = {
  id: string;
  type: NodeKind;
  blockRef: BlockRef;
  inputs: PortDecl[];
  outputs: PortDecl[];
  config: Record<string, unknown>;
  ui?: { x: number; y: number };
};

export type EdgeInstance = {
  id: string;
  from: { nodeId: string; port: string };
  to: { nodeId: string; port: string };
};

export type LockedBlock = {
  blockId: string;
  version: SemVer;
  digest: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  changelog?: string;
  deprecated?: boolean;
};

export type PipelineSpec = {
  specVersion: "0.1.0";
  pipeline: { id: string; name: string; description?: string; createdAt: string };
  graph: { nodes: NodeInstance[]; edges: EdgeInstance[] };
  lockedBlocks: LockedBlock[];
  runConfig: { seed: number; mode: "sync" | "async" };
};

export type RunCreateResponse = {
  runId: string;
  status: string;
  metrics?: Record<string, unknown>;
};

export type ExplainPortIO = {
  name: string;
  portType: string;
  shape?: number[] | null;
  preview?: number[] | null;
  note?: string | null;
};

export type ExplainStep = {
  nodeId: string;
  nodeType: string;
  blockId: string;
  version: string;
  title: string;
  config: Record<string, unknown>;
  inputs: ExplainPortIO[];
  outputs: ExplainPortIO[];
  formula?: string | null;
  whyItWorks?: string | null;
  impl: string[];
};

export type ExplainResponse = {
  traceVersion: string;
  metrics?: Record<string, unknown>;
  steps: ExplainStep[];
};

