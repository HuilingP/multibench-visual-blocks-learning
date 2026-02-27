import type { ExplainResponse, PipelineSpec, RunCreateResponse } from "@/types/pipeline";

// Default to 127.0.0.1 to match the common local dev origin in browsers.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

function withAdminKey(headers: Headers, adminKey?: string) {
  if (adminKey) headers.set("X-Admin-Key", adminKey);
  return headers;
}

export async function createRun(spec: PipelineSpec): Promise<RunCreateResponse> {
  const res = await fetch(`${API_BASE}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spec })
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail?.error ?? detail?.detail?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as RunCreateResponse;
}

export async function explainPipeline(spec: PipelineSpec): Promise<ExplainResponse> {
  const res = await fetch(`${API_BASE}/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spec })
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail?.error ?? detail?.detail?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as ExplainResponse;
}

export async function listRuns(): Promise<
  { runId: string; status: string; createdAt: string; finishedAt?: string; metrics: Record<string, unknown> }[]
> {
  const res = await fetch(`${API_BASE}/runs`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as any;
}

export async function listBlocks(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/blocks`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as any[];
}

export async function listPaperCandidates(status: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/paper_candidates?status=${encodeURIComponent(status)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as any[];
}

export async function updatePaperCandidate(candidateId: string, payload: any, adminKey: string): Promise<any> {
  const res = await fetch(`${API_BASE}/paper_candidates/${candidateId}`, {
    method: "PATCH",
    headers: withAdminKey(new Headers({ "Content-Type": "application/json" }), adminKey),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as any;
}

export async function approvePaperCandidate(candidateId: string, adminKey: string): Promise<any> {
  const res = await fetch(`${API_BASE}/paper_candidates/${candidateId}/approve`, {
    method: "POST",
    headers: withAdminKey(new Headers(), adminKey)
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as any;
}

export async function rejectPaperCandidate(candidateId: string, adminKey: string): Promise<any> {
  const res = await fetch(`${API_BASE}/paper_candidates/${candidateId}/reject`, {
    method: "POST",
    headers: withAdminKey(new Headers(), adminKey)
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as any;
}

export async function proposeStubForCandidate(candidateId: string, adminKey: string): Promise<any> {
  const res = await fetch(`${API_BASE}/paper_candidates/${candidateId}/propose_stub`, {
    method: "POST",
    headers: withAdminKey(new Headers(), adminKey)
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as any;
}

export async function materializeCandidateBlocks(candidateId: string, adminKey: string): Promise<any> {
  const res = await fetch(`${API_BASE}/paper_candidates/${candidateId}/materialize_blocks`, {
    method: "POST",
    headers: withAdminKey(new Headers(), adminKey)
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as any;
}

