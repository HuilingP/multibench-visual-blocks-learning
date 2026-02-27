"use client";

import { useEffect, useState } from "react";

import { listRuns } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useHelp } from "@/lib/help";
import { Term } from "@/components/Term";

export function RunHistory() {
  const { t } = useI18n();
  const { beginnerMode } = useHelp();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      const r = await listRuns();
      setRows(r);
    } catch (e: any) {
      setError(t("runs.loadFailed", { message: e?.message ?? String(e) }));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-100">{t("runs.historyTitle")}</div>
        <button
          className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700"
          onClick={refresh}
        >
          {t("common.refresh")}
        </button>
      </div>

      {error ? <div className="mt-3 text-xs text-red-300">{error}</div> : null}
      {beginnerMode ? (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/20 p-3 text-[11px] text-zinc-300">
          <div>
            <Term id="run" />：{t("glossary.entries.run.oneLiner")}
          </div>
          <div className="mt-1 text-zinc-400">
            {t("runs.beginnerHint")}
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <div className="text-xs text-zinc-400">{t("runs.empty")}</div>
        ) : (
          rows.map((r) => (
            <div key={r.runId} className="rounded-lg border border-zinc-800 p-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs text-zinc-200">{r.runId}</div>
                <div className="text-xs text-zinc-400">{r.status}</div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-zinc-900 p-2">
                  <div className="text-zinc-400">{t("metrics.performance")}</div>
                  <div className="mt-1 text-zinc-100">
                    {t("metrics.accuracy")}: {String(r.metrics?.performance?.accuracy ?? "-")}
                  </div>
                </div>
                <div className="rounded-md bg-zinc-900 p-2">
                  <div className="text-zinc-400">{t("metrics.complexity")}</div>
                  <div className="mt-1 text-zinc-100">
                    {t("metrics.params")}: {String(r.metrics?.complexity?.paramCount ?? "-")}
                  </div>
                </div>
                <div className="rounded-md bg-zinc-900 p-2">
                  <div className="text-zinc-400">{t("metrics.robustness")}</div>
                  <div className="mt-1 text-zinc-100">
                    {t("metrics.drop")}: {String(r.metrics?.robustness?.accuracyDrop ?? "-")}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

