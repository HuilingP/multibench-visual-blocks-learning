"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import {
  approvePaperCandidate,
  listPaperCandidates,
  materializeCandidateBlocks,
  proposeStubForCandidate,
  rejectPaperCandidate,
  updatePaperCandidate
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useHelp } from "@/lib/help";
import { Term } from "@/components/Term";

function pretty(obj: any) {
  return JSON.stringify(obj ?? {}, null, 2);
}

function safeJsonParse(s: string) {
  try {
    return { ok: true as const, value: JSON.parse(s) };
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? String(e) };
  }
}

const LS_KEY = "multibench_admin_key";

export function PaperCandidatesAdmin() {
  const { t } = useI18n();
  const { beginnerMode } = useHelp();
  const [adminKey, setAdminKey] = useState<string>("");
  const [tab, setTab] = useState<"pending_review" | "approved">("pending_review");
  const [rows, setRows] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const [editor, setEditor] = useState<string>("");

  useEffect(() => {
    const k = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
    if (k) setAdminKey(k);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, adminKey);
  }, [adminKey]);

  async function refresh(nextTab?: typeof tab) {
    try {
      setError(null);
      const t = nextTab ?? tab;
      const r = await listPaperCandidates(t);
      setRows(r);
      if (r.length > 0 && !r.find((x: any) => x.id === selectedId)) {
        setSelectedId(r[0].id);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!selected) return;
    setEditor(pretty(selected.proposedBlocks));
  }, [selectedId]); // intentionally only on selection

  async function doApprove() {
    if (!selected) return;
    try {
      setBusy("approve");
      setError(null);
      await approvePaperCandidate(selected.id, adminKey);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function doReject() {
    if (!selected) return;
    try {
      setBusy("reject");
      setError(null);
      await rejectPaperCandidate(selected.id, adminKey);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function doStub() {
    if (!selected) return;
    try {
      setBusy("stub");
      setError(null);
      const r = await proposeStubForCandidate(selected.id, adminKey);
      setEditor(pretty(r.proposedBlocks));
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function doSave() {
    if (!selected) return;
    const parsed = safeJsonParse(editor);
    if (!parsed.ok) {
      setError(t("admin.jsonParseFailed", { message: parsed.error }));
      return;
    }
    try {
      setBusy("save");
      setError(null);
      await updatePaperCandidate(selected.id, { proposedBlocks: parsed.value, llmOutput: editor }, adminKey);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function doMaterialize() {
    if (!selected) return;
    try {
      setBusy("materialize");
      setError(null);
      const r = await materializeCandidateBlocks(selected.id, adminKey);
      const created = (r.created ?? []).map((x: any) => `${x.blockId}@${x.version}`).join(", ");
      const skipped = (r.skipped ?? []).length;
      setError(t("admin.materializeResult", { created: created || "(none)", skipped }));
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-[360px_1fr] gap-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <div className="text-sm font-semibold text-zinc-100">{t("nav.admin")}</div>
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-zinc-400">{t("admin.adminKey")}</label>
          <input
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="dev-admin-key-change-me"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 outline-none"
          />
          <div className="text-[11px] text-zinc-500">{t("admin.adminKeyHint")}</div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            className={clsx(
              "rounded-md px-3 py-1.5 text-xs",
              tab === "pending_review" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
            )}
            onClick={() => setTab("pending_review")}
          >
            {t("admin.tabs.pending")}
          </button>
          <button
            className={clsx(
              "rounded-md px-3 py-1.5 text-xs",
              tab === "approved" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
            )}
            onClick={() => setTab("approved")}
          >
            {t("admin.tabs.approved")}
          </button>
          <button
            className="ml-auto rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700"
            onClick={() => refresh()}
          >
            {t("common.refresh")}
          </button>
        </div>

        {error ? <div className="mt-3 text-xs text-red-300">{error}</div> : null}

        <div className="mt-4 space-y-2">
          {rows.length === 0 ? (
            <div className="text-xs text-zinc-400">{t("admin.noCandidates")}</div>
          ) : (
            rows.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={clsx(
                  "block w-full rounded-lg border p-3 text-left",
                  selectedId === r.id ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-xs font-semibold text-zinc-100">{r.paper?.title ?? r.paperId}</div>
                  <div className="text-[11px] text-zinc-400">{r.status}</div>
                </div>
                <div className="mt-1 truncate font-mono text-[10px] text-zinc-400">{r.paper?.arxivId ?? r.id}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-100">{t("admin.detailTitle")}</div>
            <div className="mt-1 text-xs text-zinc-400">
              {selected?.paper?.arxivId ? (
                <a className="text-indigo-300 hover:underline" href={selected.paper.url} target="_blank" rel="noreferrer">
                  {selected.paper.arxivId}
                </a>
              ) : (
                <span className="font-mono">{selected?.paperId ?? "-"}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={doStub}
              disabled={!selected || !adminKey || busy !== null}
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
            >
              {t("admin.actions.stub")}
            </button>
            <button
              onClick={doSave}
              disabled={!selected || !adminKey || busy !== null}
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
            >
              {t("admin.actions.saveJson")}
            </button>
            {selected?.status === "pending_review" ? (
              <>
                <button
                  onClick={doApprove}
                  disabled={!selected || !adminKey || busy !== null}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {t("common.approve")}
                </button>
                <button
                  onClick={doReject}
                  disabled={!selected || !adminKey || busy !== null}
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {t("common.reject")}
                </button>
              </>
            ) : null}
            <button
              onClick={doMaterialize}
              disabled={!selected || !adminKey || busy !== null || selected?.status !== "approved"}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {t("admin.actions.materialize")}
            </button>
          </div>
        </div>

        {beginnerMode ? (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 text-[11px] text-zinc-300">
            <div>
              <Term id="paperCandidate" />：{t("glossary.entries.paperCandidate.oneLiner")}
            </div>
            <div className="mt-1 text-zinc-400">
              <Term id="reviewFlow" />：{t("glossary.entries.reviewFlow.oneLiner")}
            </div>
            <div className="mt-1 text-zinc-400">
              {t("admin.materializeHint", { action: t("admin.actions.materialize") })}
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs font-semibold text-zinc-100">{t("admin.promptReadonly")}</div>
            <pre className="mt-2 max-h-[280px] overflow-auto whitespace-pre-wrap text-[11px] text-zinc-300">
              {selected?.llmPrompt ?? ""}
            </pre>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs font-semibold text-zinc-100">{t("admin.proposedEditable")}</div>
            <textarea
              value={editor}
              onChange={(e) => setEditor(e.target.value)}
              className="mt-2 h-[280px] w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-200 outline-none"
              placeholder='{"candidates":[...]}'
            />
            <div className="mt-2 text-[11px] text-zinc-500">
              {t("admin.expectedFormat", {
                format: "{candidates:[{blockId,category,displayName,inputs,outputs,configSchema,permissions,tests,version}]}"
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

